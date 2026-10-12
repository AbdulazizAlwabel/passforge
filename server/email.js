const nodemailer = require('nodemailer');

const SITE_URL = (process.env.SITE_URL || 'https://nicelydone.qd.je').replace(/\/$/, '');
const FROM = `"${process.env.MAIL_FROM_NAME || 'Nicely Done'}" <${process.env.MAIL_FROM_ADDRESS}>`;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: +(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
});

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function layout({ preheader, title, body, button, url, note }) {
  return `<!doctype html><html><body style="margin:0;background:#f5f3ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#161613">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;border:1px solid #e7e4dc">
<tr><td style="padding:36px 36px 0">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:30px;height:30px;background:#0f1210;border-radius:9px;text-align:center;color:#7ee2b0;font-size:18px;font-weight:700;line-height:30px">&#10003;</td>
    <td style="padding-left:10px;font-family:Georgia,serif;font-size:20px">nicely<i style="color:#0f8a5c">done</i></td>
  </tr></table>
</td></tr>
<tr><td style="padding:28px 36px 8px">
  <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:30px;line-height:1.15">${title}</h1>
  <div style="font-size:15px;line-height:1.6;color:#5b5a54">${body}</div>
  ${button ? `<p style="margin:28px 0"><a href="${url}" style="display:inline-block;background:#0f8a5c;color:#ffffff;text-decoration:none;font-weight:600;padding:13px 24px;border-radius:999px;font-size:15px">${button}</a></p>
  <p style="font-size:12px;color:#9a988f;word-break:break-all">Or paste this link into your browser:<br>${url}</p>` : ''}
</td></tr>
<tr><td style="padding:8px 36px 32px;font-size:12px;color:#9a988f;border-top:1px solid #efede6">${note || ''}<br>Nicely Done · <a href="${SITE_URL}" style="color:#9a988f">${SITE_URL.replace(/^https?:\/\//, '')}</a></td></tr>
</table></td></tr></table></body></html>`;
}

async function send(to, subject, html, text) {
  await transporter.sendMail({ from: FROM, to, subject, html, text });
}

exports.sendVerification = (email, username, token) => {
  const url = `${SITE_URL}/api/verify-email?token=${token}`;
  return send(email, 'Verify your Nicely Done email', layout({
    preheader: 'One click to confirm your email address.',
    title: `Hi ${esc(username)}, confirm your <i style="color:#0f8a5c">email</i>`,
    body: '<p style="margin:0">Thanks for creating an account. Please confirm this is your email address.</p>',
    button: 'Verify email', url,
    note: 'This link expires in 24 hours. If you didn’t sign up, you can ignore this email.',
  }), `Hi ${username},\n\nConfirm your email: ${url}\n\nThis link expires in 24 hours.`);
};

exports.sendWelcome = (email, username) => send(email, 'Welcome to Nicely Done', layout({
  preheader: 'Your account is ready.',
  title: `Welcome, <i style="color:#0f8a5c">${esc(username)}</i>`,
  body: '<p style="margin:0 0 12px">Your email is verified and your account is ready.</p><p style="margin:0">Every tool — passwords, hashes, JSON, Base64, Hijri dates and more — still runs entirely in your browser. Press <b>Ctrl K</b> on any page to jump straight to one.</p>',
  button: 'Open the toolkit', url: SITE_URL + '/',
}), `Welcome, ${username}! Your account is ready: ${SITE_URL}/`);

exports.sendPasswordReset = (email, username, token) => {
  const url = `${SITE_URL}/reset-password/?token=${token}`;
  return send(email, 'Reset your Nicely Done password', layout({
    preheader: 'Choose a new password — link valid for one hour.',
    title: 'Reset your <i style="color:#0f8a5c">password</i>',
    body: `<p style="margin:0">Hi ${esc(username)}, someone (hopefully you) asked to reset your password. Click below to choose a new one.</p>`,
    button: 'Choose a new password', url,
    note: 'This link expires in 1 hour and works once. If you didn’t ask for this, ignore this email — your password won’t change.',
  }), `Hi ${username},\n\nReset your password: ${url}\n\nThis link expires in 1 hour.`);
};
