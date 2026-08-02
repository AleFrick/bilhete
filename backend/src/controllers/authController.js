import bcrypt from 'bcryptjs';
import { createHash, createHmac, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { signToken, revokeToken, revokeAllUserTokens } from '../middleware/auth.js';
import { sendRegistrationVerificationEmail, sendPasswordResetEmail } from '../services/emailService.js';

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(3),
});

const socialLoginSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(120).optional(),
});

const verifyEmailQuerySchema = z.object({
  token: z.string().min(40).max(200),
});

function resolveHashAlgorithm() {
  return env.passwordHashAlgorithm === 'sha256' ? 'sha256' : 'sha512';
}

function normalizeIncomingPassword(password) {
  if (!env.passwordClientHashEnabled) {
    return password;
  }

  const algorithm = resolveHashAlgorithm();
  const expectedLength = algorithm === 'sha256' ? 64 : 128;
  const value = String(password || '').trim();

  // Accept already-hashed values sent by the client to avoid double hashing.
  if (new RegExp(`^[a-f0-9]{${expectedLength}}$`, 'i').test(value)) {
    return value.toLowerCase();
  }

  return createHash(algorithm).update(`${value}:${env.passwordHashSecret}`).digest('hex');
}

function buildVerificationToken() {
  return randomBytes(32).toString('hex');
}

function hashVerificationToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex');
}

function computePasswordStrengthScore(password) {
  const value = String(password || '');
  let score = 0;

  if (value.length >= 8) {
    score += 1;
  }
  if (value.length >= 12) {
    score += 1;
  }
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) {
    score += 1;
  }
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) {
    score += 1;
  }

  return score;
}

function buildEmailVerificationLink(token) {
  const url = new URL('/api/auth/verify-email', env.emailVerificationBaseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

export async function register(req, res) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos.' });
  }

  const { name, email, password } = parsed.data;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const passwordStrength = computePasswordStrengthScore(password);
  if (passwordStrength < env.authPasswordMinStrength) {
    return res.status(400).json({
      message: `Senha fraca. Use pelo menos nivel ${env.authPasswordMinStrength} de forca.`,
      minStrength: env.authPasswordMinStrength,
      currentStrength: passwordStrength,
    });
  }

  const normalizedPassword = normalizeIncomingPassword(password);
  const verificationToken = buildVerificationToken();
  const verificationTokenHash = hashVerificationToken(verificationToken);
  const verificationLink = buildEmailVerificationLink(verificationToken);
  const verificationExpiresAt = new Date(Date.now() + env.emailVerificationTtlHours * 60 * 60 * 1000);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existing] = await connection.query('select id from users where email = ? limit 1', [normalizedEmail]);
    if (existing.length) {
      await connection.rollback();
      return res.status(409).json({ message: 'Email ja cadastrado.' });
    }

    const passwordHash = await bcrypt.hash(normalizedPassword, 10);

    const [userInsert] = await connection.query(
      `insert into users (
        name,
        email,
        password_hash,
        is_active,
        email_verification_token_hash,
        email_verification_expires_at
      ) values (?, ?, ?, 0, ?, ?)`,
      [name, normalizedEmail, passwordHash, verificationTokenHash, verificationExpiresAt]
    );

    await connection.query(
      'insert into profiles (user_id, name, status_social, premium_status) values (?, ?, ?, ?)',
      [userInsert.insertId, name, 'observando', 0]
    );

    const [activeTerms] = await connection.query(
      'select id, version from lgpd_terms where is_active = 1 order by created_at desc limit 1'
    );
    if (activeTerms.length > 0) {
      const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
      const userAgent = req.headers['user-agent'] || null;
      await connection.query(
        'insert into user_terms_acceptance (user_id, terms_id, terms_version, ip_address, user_agent) values (?, ?, ?, ?, ?)',
        [userInsert.insertId, activeTerms[0].id, activeTerms[0].version, ipAddress, userAgent]
      );
    }

    await sendRegistrationVerificationEmail({
      to: normalizedEmail,
      name,
      verificationLink,
    });

    await connection.commit();

    return res.status(201).json({
      message: 'Cadastro criado. Confirme seu e-mail para ativar a conta.',
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}
    console.error('[auth:register] failed', error?.stack || error?.message || String(error));
    return res.status(500).json({ message: 'Erro ao registrar usuario.' });
  } finally {
    connection.release();
  }
}

export async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos.' });
  }

  const { email, password } = parsed.data;
  const normalizedPassword = normalizeIncomingPassword(password);

  try {
    const [rows] = await pool.query(
      `select
        u.id,
        u.name,
        u.email,
        u.role,
        u.is_active as isActive,
        u.password_hash,
        case
          when exists (
            select 1 from premium_subscriptions ps
            where ps.user_id = u.id
              and ps.status = 'active'
              and ps.ends_at > current_timestamp
          ) then 1
          else 0
        end as premiumStatus,
        p.premium_expires_at as premiumExpiresAt
      from users u
      left join profiles p on p.user_id = u.id
      where u.email = ?
      limit 1`,
      [email]
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ message: 'Credenciais invalidas.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Confirme seu e-mail antes de entrar.' });
    }

    const isBcryptHash = typeof user.password_hash === 'string' && user.password_hash.startsWith('$2');
    let validPassword = false;

    if (isBcryptHash) {
      validPassword = await bcrypt.compare(normalizedPassword, user.password_hash);
      if (!validPassword && env.passwordClientHashEnabled && normalizedPassword !== password) {
        validPassword = await bcrypt.compare(password, user.password_hash);
      }
    } else {
      validPassword =
        process.env.NODE_ENV !== 'production' &&
        (normalizedPassword === user.password_hash || password === user.password_hash);
    }

    if (!validPassword) {
      return res.status(401).json({ message: 'Credenciais invalidas.' });
    }

    const [activeTerms] = await pool.query(
      'select id, version from lgpd_terms where is_active = 1 order by created_at desc limit 1'
    );
    let needsTermsAcceptance = false;
    if (activeTerms.length > 0) {
      const [acceptRows] = await pool.query(
        'select id from user_terms_acceptance where user_id = ? and terms_id = ? limit 1',
        [user.id, activeTerms[0].id]
      );
      needsTermsAcceptance = acceptRows.length === 0;
    }

    const token = await signToken(user);
    return res.json({
      token,
      needsTermsAcceptance,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        premiumStatus: Boolean(user.premiumStatus),
        premiumExpiresAt: user.premiumExpiresAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao autenticar.' });
  }
}

export async function loginGoogle(req, res) {
  return loginWithSocialProvider(req, res, 'google');
}

export async function verifyRegistrationEmail(req, res) {
  const parsed = verifyEmailQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).send('Link de confirmacao invalido.');
  }

  const tokenHash = hashVerificationToken(parsed.data.token);

  try {
    const [rows] = await pool.query(
      `select
        id,
        is_active as isActive,
        email_verification_expires_at as verificationExpiresAt
      from users
      where email_verification_token_hash = ?
      limit 1`,
      [tokenHash]
    );

    const user = rows[0];
    if (!user) {
      return res.status(400).send('Token de confirmacao invalido ou expirado.');
    }

    const expiresAt = user.verificationExpiresAt ? new Date(user.verificationExpiresAt) : null;
    if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      return res.status(400).send('Token de confirmacao expirado.');
    }

    if (user.isActive) {
      return res.status(200).send('Cadastro ja confirmado. Voce pode entrar normalmente.');
    }

    await pool.query(
      `update users
       set is_active = 1,
           email_verified_at = current_timestamp,
           email_verification_token_hash = null,
           email_verification_expires_at = null
       where id = ?`,
      [user.id]
    );

    return res.status(200).send('Cadastro confirmado com sucesso. Voce ja pode entrar.');
  } catch (error) {
    return res.status(500).send('Erro ao confirmar cadastro.');
  }
}

export async function loginApple(req, res) {
  return loginWithSocialProvider(req, res, 'icloud');
}

export async function loginFacebook(req, res) {
  return loginWithSocialProvider(req, res, 'facebook');
}

function buildFrontendRedirectUrl({ token, user, errorMessage }) {
  const url = new URL(env.frontendAppUrl);

  if (errorMessage) {
    url.searchParams.set('social_error', errorMessage);
    return url.toString();
  }

  const encodedUser = Buffer.from(JSON.stringify(user), 'utf8').toString('base64url');
  url.searchParams.set('social_token', token);
  url.searchParams.set('social_user', encodedUser);
  return url.toString();
}

function buildOAuthState(provider) {
  const payload = `${provider}:${Date.now()}:${randomBytes(16).toString('hex')}`;
  const signature = createHmac('sha256', env.jwtSecret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`, 'utf8').toString('base64url');
}

function validateOAuthState(state, expectedProvider) {
  if (!state) {
    return false;
  }

  try {
    const decoded = Buffer.from(String(state), 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4) {
      return false;
    }

    const [provider, issuedAtRaw, nonce, signature] = parts;
    if (provider !== expectedProvider) {
      return false;
    }

    const issuedAt = Number(issuedAtRaw);
    if (!Number.isFinite(issuedAt)) {
      return false;
    }

    if (Date.now() - issuedAt > 10 * 60 * 1000) {
      return false;
    }

    const payload = `${provider}:${issuedAtRaw}:${nonce}`;
    const expectedSignature = createHmac('sha256', env.jwtSecret).update(payload).digest('hex');
    return signature === expectedSignature;
  } catch {
    return false;
  }
}

async function postForm(url, params) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Falha no provedor OAuth.');
  }

  return data;
}

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || data.error || 'Falha ao buscar dados do provedor OAuth.');
  }
  return data;
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string' || token.split('.').length < 2) {
    return {};
  }

  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

async function findOrCreateSocialUser({ provider, email, name }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const fallbackName = normalizedEmail.split('@')[0] || 'Usuario';
  const normalizedName = String(name || fallbackName)
    .trim()
    .slice(0, 120) || fallbackName;

  const [rows] = await pool.query(
    `select
      u.id,
      u.name,
      u.email,
      u.role,
      u.is_active as isActive,
      case
        when exists (
          select 1 from premium_subscriptions ps
          where ps.user_id = u.id
            and ps.status = 'active'
            and ps.ends_at > current_timestamp
        ) then 1
        else 0
      end as premiumStatus,
      p.premium_expires_at as premiumExpiresAt
    from users u
    left join profiles p on p.user_id = u.id
    where u.email = ?
    limit 1`,
    [normalizedEmail]
  );

  if (rows[0]) {
    return rows[0];
  }

  const pseudoPassword = `${provider}:${normalizedEmail}:${Date.now()}`;
  const passwordHash = await bcrypt.hash(pseudoPassword, 10);

  const [userInsert] = await pool.query(
    'insert into users (name, email, password_hash) values (?, ?, ?)',
    [normalizedName, normalizedEmail, passwordHash]
  );

  await pool.query(
    'insert into profiles (user_id, name, status_social, premium_status) values (?, ?, ?, ?)',
    [userInsert.insertId, normalizedName, 'observando', 0]
  );

  return {
    id: userInsert.insertId,
    name: normalizedName,
    email: normalizedEmail,
    role: 'user',
    isActive: 1,
    premiumStatus: 0,
    premiumExpiresAt: null,
  };
}

function toAuthPayload(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    premiumStatus: Boolean(user.premiumStatus),
    premiumExpiresAt: user.premiumExpiresAt,
  };
}

function ensureProviderConfig(values) {
  return values.every((value) => String(value || '').trim().length > 0);
}

export async function startGoogleOAuth(req, res) {
  if (!ensureProviderConfig([env.googleClientId, env.googleClientSecret, env.googleRedirectUri])) {
    return res.status(500).json({ message: 'Configuração OAuth do Google incompleta.' });
  }

  const state = buildOAuthState('google');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', env.googleClientId);
  url.searchParams.set('redirect_uri', env.googleRedirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'select_account');

  return res.redirect(url.toString());
}

export async function googleOAuthCallback(req, res) {
  try {
    const { code, state } = req.query;
    if (!code || !validateOAuthState(state, 'google')) {
      throw new Error('Falha ao validar retorno do Google.');
    }

    const tokenData = await postForm('https://oauth2.googleapis.com/token', {
      code: String(code),
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: env.googleRedirectUri,
      grant_type: 'authorization_code',
    });

    const profile = await getJson('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profile?.email) {
      throw new Error('Google nao retornou email para este login.');
    }

    const user = await findOrCreateSocialUser({ provider: 'google', email: profile.email, name: profile.name });
    if (!user.isActive) {
      throw new Error('Confirme seu e-mail antes de entrar.');
    }
    const authUser = toAuthPayload(user);
    const token = await signToken(user);
    return res.redirect(buildFrontendRedirectUrl({ token, user: authUser }));
  } catch (error) {
    return res.redirect(buildFrontendRedirectUrl({ errorMessage: error.message || 'Erro no login Google.' }));
  }
}

export async function startFacebookOAuth(req, res) {
  if (!ensureProviderConfig([env.facebookClientId, env.facebookClientSecret, env.facebookRedirectUri])) {
    return res.status(500).json({ message: 'Configuração OAuth do Facebook incompleta.' });
  }

  const state = buildOAuthState('facebook');
  const url = new URL('https://www.facebook.com/v20.0/dialog/oauth');
  url.searchParams.set('client_id', env.facebookClientId);
  url.searchParams.set('redirect_uri', env.facebookRedirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'email,public_profile');
  url.searchParams.set('state', state);

  return res.redirect(url.toString());
}

export async function facebookOAuthCallback(req, res) {
  try {
    const { code, state } = req.query;
    if (!code || !validateOAuthState(state, 'facebook')) {
      throw new Error('Falha ao validar retorno do Facebook.');
    }

    const tokenUrl = new URL('https://graph.facebook.com/v20.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', env.facebookClientId);
    tokenUrl.searchParams.set('client_secret', env.facebookClientSecret);
    tokenUrl.searchParams.set('redirect_uri', env.facebookRedirectUri);
    tokenUrl.searchParams.set('code', String(code));
    const tokenData = await getJson(tokenUrl.toString());

    const profileUrl = new URL('https://graph.facebook.com/me');
    profileUrl.searchParams.set('fields', 'id,name,email');
    profileUrl.searchParams.set('access_token', tokenData.access_token);
    const profile = await getJson(profileUrl.toString());

    if (!profile?.email) {
      throw new Error('Facebook nao retornou email para este login.');
    }

    const user = await findOrCreateSocialUser({ provider: 'facebook', email: profile.email, name: profile.name });
    if (!user.isActive) {
      throw new Error('Confirme seu e-mail antes de entrar.');
    }
    const authUser = toAuthPayload(user);
    const token = await signToken(user);
    return res.redirect(buildFrontendRedirectUrl({ token, user: authUser }));
  } catch (error) {
    return res.redirect(buildFrontendRedirectUrl({ errorMessage: error.message || 'Erro no login Facebook.' }));
  }
}

export async function startAppleOAuth(req, res) {
  if (!ensureProviderConfig([env.appleClientId, env.appleClientSecret, env.appleRedirectUri])) {
    return res.status(500).json({ message: 'Configuração OAuth do iCloud incompleta.' });
  }

  const state = buildOAuthState('apple');
  const url = new URL('https://appleid.apple.com/auth/authorize');
  url.searchParams.set('client_id', env.appleClientId);
  url.searchParams.set('redirect_uri', env.appleRedirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', 'name email');
  url.searchParams.set('state', state);

  return res.redirect(url.toString());
}

export async function appleOAuthCallback(req, res) {
  try {
    const { code, state } = req.query;
    if (!code || !validateOAuthState(state, 'apple')) {
      throw new Error('Falha ao validar retorno do iCloud.');
    }

    const tokenData = await postForm('https://appleid.apple.com/auth/token', {
      grant_type: 'authorization_code',
      code: String(code),
      client_id: env.appleClientId,
      client_secret: env.appleClientSecret,
      redirect_uri: env.appleRedirectUri,
    });

    const idPayload = decodeJwtPayload(tokenData.id_token);
    const email = idPayload?.email;
    const name = idPayload?.name || 'Usuario iCloud';

    if (!email) {
      throw new Error('iCloud nao retornou email para este login.');
    }

    const user = await findOrCreateSocialUser({ provider: 'icloud', email, name });
    if (!user.isActive) {
      throw new Error('Confirme seu e-mail antes de entrar.');
    }
    const authUser = toAuthPayload(user);
    const token = await signToken(user);
    return res.redirect(buildFrontendRedirectUrl({ token, user: authUser }));
  } catch (error) {
    return res.redirect(buildFrontendRedirectUrl({ errorMessage: error.message || 'Erro no login iCloud.' }));
  }
}

async function loginWithSocialProvider(req, res, provider) {
  const parsed = socialLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos para login social.' });
  }

  try {
    const user = await findOrCreateSocialUser({
      provider,
      email: parsed.data.email,
      name: parsed.data.name,
    });
    if (!user.isActive) {
      return res.status(403).json({ message: 'Confirme seu e-mail antes de entrar.' });
    }
    const authUser = toAuthPayload(user);
    const token = await signToken(user);
    return res.json({
      token,
      user: authUser,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao autenticar com login social.' });
  }
}

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function forgotPassword(req, res) {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Email invalido.' });
  }

  const normalizedEmail = String(parsed.data.email || '').trim().toLowerCase();

  try {
    const [rows] = await pool.query(
      'select id, name from users where email = ? limit 1',
      [normalizedEmail]
    );

    const user = rows[0];
    if (!user) {
      return res.json({ message: 'Se o email existir, voce recebera um link de recuperacao.' });
    }

    const resetToken = randomBytes(32).toString('hex');
    const resetTokenHash = hashVerificationToken(resetToken);
    const expiresAt = new Date(Date.now() + env.passwordResetTtlHours * 60 * 60 * 1000);

    await pool.query(
      `update users
       set password_reset_token_hash = ?,
           password_reset_expires_at = ?
       where id = ?`,
      [resetTokenHash, expiresAt, user.id]
    );

    const resetLink = new URL('/reset-password', env.frontendAppUrl);
    resetLink.searchParams.set('token', resetToken);

    await sendPasswordResetEmail({
      to: normalizedEmail,
      name: user.name,
      resetLink: resetLink.toString(),
    });

    return res.json({ message: 'Se o email existir, voce recebera um link de recuperacao.' });
  } catch (error) {
    console.error('[auth:forgotPassword] failed', error?.stack || error?.message || String(error));
    return res.status(500).json({ message: 'Erro ao processar recuperacao de senha.' });
  }
}

const resetPasswordSchema = z.object({
  token: z.string().min(40).max(200),
  password: z.string().min(6),
});

export async function resetPassword(req, res) {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos para redefinir senha.' });
  }

  const { token, password } = parsed.data;
  const tokenHash = hashVerificationToken(token);

  try {
    const [rows] = await pool.query(
      `select
        id,
        password_reset_expires_at as expiresAt
      from users
      where password_reset_token_hash = ?
      limit 1`,
      [tokenHash]
    );

    const user = rows[0];
    if (!user) {
      return res.status(400).json({ message: 'Token de recuperacao invalido ou expirado.' });
    }

    const expiresAt = user.expiresAt ? new Date(user.expiresAt) : null;
    if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: 'Token de recuperacao expirado.' });
    }

    const passwordStrength = computePasswordStrengthScore(password);
    if (passwordStrength < env.authPasswordMinStrength) {
      return res.status(400).json({
        message: `Senha fraca. Use pelo menos nivel ${env.authPasswordMinStrength} de forca.`,
        minStrength: env.authPasswordMinStrength,
        currentStrength: passwordStrength,
      });
    }

    const normalizedPassword = normalizeIncomingPassword(password);
    const passwordHash = await bcrypt.hash(normalizedPassword, 10);

    await pool.query(
      `update users
       set password_hash = ?,
           password_reset_token_hash = null,
           password_reset_expires_at = null
       where id = ?`,
      [passwordHash, user.id]
    );

    await revokeAllUserTokens(user.id);

    return res.json({ message: 'Senha redefinida com sucesso. Voce ja pode entrar normalmente.' });
  } catch (error) {
    console.error('[auth:resetPassword] failed', error?.stack || error?.message || String(error));
    return res.status(500).json({ message: 'Erro ao redefinir senha.' });
  }
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export async function changePassword(req, res) {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos para troca de senha.' });
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    const [rows] = await pool.query(
      'select id, password_hash from users where id = ? limit 1',
      [req.user.id]
    );

    const user = rows[0];
    if (!user) {
      return res.status(404).json({ message: 'Usuario nao encontrado.' });
    }

    const isBcryptHash = typeof user.password_hash === 'string' && user.password_hash.startsWith('$2');
    let validPassword = false;

    if (isBcryptHash) {
      const normalizedCurrent = normalizeIncomingPassword(currentPassword);
      validPassword = await bcrypt.compare(normalizedCurrent, user.password_hash);
      if (!validPassword && env.passwordClientHashEnabled && normalizedCurrent !== currentPassword) {
        validPassword = await bcrypt.compare(currentPassword, user.password_hash);
      }
    } else {
      validPassword =
        process.env.NODE_ENV !== 'production' &&
        (normalizeIncomingPassword(currentPassword) === user.password_hash || currentPassword === user.password_hash);
    }

    if (!validPassword) {
      return res.status(401).json({ message: 'Senha atual incorreta.' });
    }

    const passwordStrength = computePasswordStrengthScore(newPassword);
    if (passwordStrength < env.authPasswordMinStrength) {
      return res.status(400).json({
        message: `Senha fraca. Use pelo menos nivel ${env.authPasswordMinStrength} de forca.`,
        minStrength: env.authPasswordMinStrength,
        currentStrength: passwordStrength,
      });
    }

    const normalizedNew = normalizeIncomingPassword(newPassword);
    const passwordHash = await bcrypt.hash(normalizedNew, 10);

    await pool.query('update users set password_hash = ? where id = ?', [passwordHash, user.id]);

    await revokeAllUserTokens(user.id);

    return res.json({ message: 'Senha alterada com sucesso. Faca login novamente.' });
  } catch (error) {
    console.error('[auth:changePassword] failed', error?.stack || error?.message || String(error));
    return res.status(500).json({ message: 'Erro ao alterar senha.' });
  }
}

export async function logout(req, res) {
  try {
    const authHeader = req.headers.authorization || '';
    const [, token] = authHeader.split(' ');

    if (token && req.user?.jti) {
      const decoded = jwt.decode(token);
      const expiresAt = decoded?.exp
        ? new Date(decoded.exp * 1000).toISOString().slice(0, 19).replace('T', ' ')
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      await revokeToken(req.user.jti, req.user.id, expiresAt);
    }

    return res.json({ message: 'Logout realizado com sucesso.' });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao fazer logout.' });
  }
}
