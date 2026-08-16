const nodemailer = require('nodemailer');


const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

const FROM = `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`;
const SITE_URL = process.env.SITE_URL || 'https://www.nicelydone.qd.je';

async function sendWelcomeEmail(email, username) {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Welcome to PassForge!',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#01696f;">Welcome, ${username}! 🎉</h2>
        <p>Your PassForge account has been created successfully.</p>
        <p>You now have access to all free security & developer tools — password generator, hash generator, JSON formatter, and more.</p>
        <a href="${SITE_URL}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#01696f;color:#fff;text-decoration:none;border-radius:6px;">Go to PassForge</a>
        <p style="color:#888;font-size:12px;margin-top:32px;">If you didn't create this account, you can ignore this email.</p>
      </div>
    `
  });
}

async function sendVerificationEmail(email, username, token) {
  const link = `${SITE_URL}/api/verify-email?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Verify your PassForge account',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#01696f;">Hi ${username},</h2>
        <p>Please verify your email address to activate your PassForge account.</p>
        <a href="${link}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#01696f;color:#fff;text-decoration:none;border-radius:6px;">Verify Email</a>
        <p style="color:#888;font-size:12px;margin-top:16px;">This link expires in 24 hours.</p>
      </div>
    `
  });
  // Send welcome email right after triggering verification
  await sendWelcomeEmail(email, username);
}

async function sendPasswordResetEmail(email, username, token) {
  const link = `${SITE_URL}/reset-password.html?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Reset your PassForge password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#01696f;">Password Reset</h2>
        <p>Hi ${username}, click below to reset your password. This link expires in 1 hour.</p>
        <a href="${link}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#01696f;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a>
        <p style="color:#888;font-size:12px;margin-top:16px;">If you didn't request this, ignore this email.</p>
      </div>
    `
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail };
