import bcrypt from 'bcryptjs';
import { createHash, createHmac, randomBytes } from 'crypto';
import { z } from 'zod';

import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { signToken } from '../middleware/auth.js';

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

export async function register(req, res) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados invalidos.' });
  }

  const { name, email, password } = parsed.data;
  const normalizedPassword = normalizeIncomingPassword(password);

  try {
    const [existing] = await pool.query('select id from users where email = ? limit 1', [email]);
    if (existing.length) {
      return res.status(409).json({ message: 'Email ja cadastrado.' });
    }

    const passwordHash = await bcrypt.hash(normalizedPassword, 10);

    const [userInsert] = await pool.query(
      'insert into users (name, email, password_hash) values (?, ?, ?)',
      [name, email, passwordHash]
    );

    await pool.query(
      'insert into profiles (user_id, name, status_social, premium_status) values (?, ?, ?, ?)',
      [userInsert.insertId, name, 'observando', 0]
    );

    const token = signToken({ id: userInsert.insertId, email, premium_status: 0, role: 'user' });
    return res.status(201).json({ token, user: { id: userInsert.insertId, name, email, role: 'user' } });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao registrar usuario.' });
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
        u.password_hash,
        case
          when p.premium_status = 1 and (p.premium_expires_at is null or p.premium_expires_at > current_timestamp)
            then 1
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

    const token = signToken(user);
    return res.json({
      token,
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
      case
        when p.premium_status = 1 and (p.premium_expires_at is null or p.premium_expires_at > current_timestamp)
          then 1
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
    const authUser = toAuthPayload(user);
    const token = signToken(user);
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
    const authUser = toAuthPayload(user);
    const token = signToken(user);
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
    const authUser = toAuthPayload(user);
    const token = signToken(user);
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
    const authUser = toAuthPayload(user);
    const token = signToken(user);
    return res.json({
      token,
      user: authUser,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao autenticar com login social.' });
  }
}
