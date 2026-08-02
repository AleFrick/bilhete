import nodemailer from 'nodemailer';

import { env } from '../config/env.js';

let transporter = null;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: env.smtpUser
      ? {
          user: env.smtpUser,
          pass: env.smtpPass,
        }
      : undefined,
  });

  return transporter;
}

export async function sendRegistrationVerificationEmail({ to, name, verificationLink }) {
  const recipient = String(to || '').trim().toLowerCase();
  const recipientName = String(name || '').trim() || 'Usuario';

  if (env.emailTransport !== 'smtp') {
    console.log(
      `[mail:verification] transport=log status=simulated to=${recipient} name=${recipientName} link=${verificationLink}`,
    );
    return;
  }

  if (!env.smtpHost) {
    throw new Error('SMTP_HOST nao configurado.');
  }

  const result = await getTransporter().sendMail({
    from: env.smtpFrom,
    to: recipient,
    subject: 'Confirme seu cadastro no Bilhete',
    text: [
      `Ola, ${recipientName}!`,
      '',
      'Recebemos seu cadastro no Bilhete.',
      'Clique no link abaixo para ativar sua conta:',
      verificationLink,
      '',
      `Esse link expira em ${env.emailVerificationTtlHours} horas.`,
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
        <p>Ola, <strong>${recipientName}</strong>!</p>
        <p>Recebemos seu cadastro no Bilhete.</p>
        <p>Clique no link abaixo para ativar sua conta:</p>
        <p><a href="${verificationLink}" target="_blank" rel="noreferrer">${verificationLink}</a></p>
        <p>Esse link expira em ${env.emailVerificationTtlHours} horas.</p>
      </div>
    `,
  });

  console.log(
    `[mail:verification] transport=smtp status=sent to=${recipient} messageId=${result?.messageId || 'n/a'}`,
  );
}

export async function sendEmailChangeVerification({ to, name, verificationLink }) {
  const recipient = String(to || '').trim().toLowerCase();
  const recipientName = String(name || '').trim() || 'Usuario';

  if (env.emailTransport !== 'smtp') {
    console.log(
      `[mail:email-change] transport=log status=simulated to=${recipient} name=${recipientName} link=${verificationLink}`,
    );
    return;
  }

  const transporter = getTransporter();

  const result = await transporter.sendMail({
    from: env.emailFrom,
    to: recipient,
    subject: 'Confirme seu novo e-mail - Bilhete',
    text: [
      `Ola, ${recipientName}!`,
      '',
      'Voce solicitou a troca do e-mail da sua conta no Bilhete.',
      'Clique no link abaixo para confirmar o novo e-mail:',
      verificationLink,
      '',
      `Esse link expira em ${env.emailVerificationTtlHours} horas.`,
      '',
      'Se voce nao solicitou esta troca, ignore este e-mail.',
    ].join('\n'),
    html: `
      <div>
        <p>Ola, <strong>${recipientName}</strong>!</p>
        <p>Voce solicitou a troca do e-mail da sua conta no Bilhete.</p>
        <p>Clique no link abaixo para confirmar o novo e-mail:</p>
        <p><a href="${verificationLink}" target="_blank" rel="noreferrer">${verificationLink}</a></p>
        <p>Esse link expira em ${env.emailVerificationTtlHours} horas.</p>
        <p style="color:#999;font-size:12px;">Se voce nao solicitou esta troca, ignore este e-mail.</p>
      </div>
    `,
  });

  console.log(
    `[mail:email-change] transport=smtp status=sent to=${recipient} messageId=${result?.messageId || 'n/a'}`,
  );
}

export async function sendPasswordResetEmail({ to, name, resetLink }) {
  const recipient = String(to || '').trim().toLowerCase();
  const recipientName = String(name || '').trim() || 'Usuario';

  if (env.emailTransport !== 'smtp') {
    console.log(
      `[mail:password-reset] transport=log status=simulated to=${recipient} name=${recipientName} link=${resetLink}`,
    );
    return;
  }

  if (!env.smtpHost) {
    throw new Error('SMTP_HOST nao configurado.');
  }

  const result = await getTransporter().sendMail({
    from: env.smtpFrom,
    to: recipient,
    subject: 'Recuperacao de senha - Bilhete',
    text: [
      `Ola, ${recipientName}!`,
      '',
      'Voce solicitou a recuperacao de sua senha no Bilhete.',
      'Clique no link abaixo para definir uma nova senha:',
      resetLink,
      '',
      `Esse link expira em ${env.passwordResetTtlHours} horas.`,
      '',
      'Se voce nao solicitou esta recuperacao, ignore este email.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
        <p>Ola, <strong>${recipientName}</strong>!</p>
        <p>Voce solicitou a recuperacao de sua senha no Bilhete.</p>
        <p>Clique no link abaixo para definir uma nova senha:</p>
        <p><a href="${resetLink}" target="_blank" rel="noreferrer">${resetLink}</a></p>
        <p>Esse link expira em ${env.passwordResetTtlHours} horas.</p>
        <p style="color: #666; font-size: 0.85em;">Se voce nao solicitou esta recuperacao, ignore este email.</p>
      </div>
    `,
  });

  console.log(
    `[mail:password-reset] transport=smtp status=sent to=${recipient} messageId=${result?.messageId || 'n/a'}`,
  );
}
