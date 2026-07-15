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
