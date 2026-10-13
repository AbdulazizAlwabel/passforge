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

/* Copy for each email, per language. `b()` wraps the accent word. */
const ACCENT = (s) => `<i style="color:#0f8a5c">${s}</i>`;
const ACCENT_AR = (s) => `<span style="color:#0f8a5c">${s}</span>`;
const COPY = {
  en: {
    dir: 'ltr', font: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif", serif: "Georgia,'Times New Roman',serif",
    orPaste: 'Or paste this link into your browser:',
    verify: (u) => ({
      subject: 'Verify your Nicely Done email', preheader: 'One click to confirm your email address.',
      title: `Hi ${esc(u)}, confirm your ${ACCENT('email')}`,
      body: '<p style="margin:0">Thanks for creating an account. Please confirm this is your email address.</p>',
      button: 'Verify email', note: 'This link expires in 24 hours. If you didn’t sign up, you can ignore this email.',
      text: (url) => `Hi ${u},\n\nConfirm your email: ${url}\n\nThis link expires in 24 hours.`,
    }),
    welcome: (u) => ({
      subject: 'Welcome to Nicely Done', preheader: 'Your account is ready.',
      title: `Welcome, ${ACCENT(esc(u))}`,
      body: '<p style="margin:0 0 12px">Your email is verified and your account is ready.</p><p style="margin:0">Every tool — passwords, one-time secrets, hashes, JSON, Hijri dates and more — still runs entirely in your browser. Press <b>Ctrl K</b> on any page to jump straight to one.</p>',
      button: 'Open the toolkit', note: '',
      text: (url) => `Welcome, ${u}! Your account is ready: ${url}`,
    }),
    reset: (u) => ({
      subject: 'Reset your Nicely Done password', preheader: 'Choose a new password — link valid for one hour.',
      title: `Reset your ${ACCENT('password')}`,
      body: `<p style="margin:0">Hi ${esc(u)}, someone (hopefully you) asked to reset your password. Click below to choose a new one.</p>`,
      button: 'Choose a new password', note: 'This link expires in 1 hour and works once. If you didn’t ask for this, ignore this email — your password won’t change.',
      text: (url) => `Hi ${u},\n\nReset your password: ${url}\n\nThis link expires in 1 hour.`,
    }),
  },
  ar: {
    dir: 'rtl', font: "'IBM Plex Sans Arabic',Tahoma,'Segoe UI',Arial,sans-serif", serif: "Amiri,'Times New Roman',serif",
    orPaste: 'أو الصق هذا الرابط في متصفحك:',
    verify: (u) => ({
      subject: 'أكّد بريدك الإلكتروني في Nicely Done', preheader: 'نقرة واحدة لتأكيد بريدك الإلكتروني.',
      title: `مرحبًا ${esc(u)}، أكّد ${ACCENT_AR('بريدك')}`,
      body: '<p style="margin:0">شكرًا لإنشاء حسابك. يُرجى تأكيد أن هذا هو بريدك الإلكتروني.</p>',
      button: 'تأكيد البريد', note: 'تنتهي صلاحية هذا الرابط خلال 24 ساعة. إن لم تنشئ حسابًا فتجاهل هذه الرسالة.',
      text: (url) => `مرحبًا ${u}،\n\nأكّد بريدك: ${url}\n\nتنتهي صلاحية الرابط خلال 24 ساعة.`,
    }),
    welcome: (u) => ({
      subject: 'أهلًا بك في Nicely Done', preheader: 'حسابك جاهز.',
      title: `أهلًا بك، ${ACCENT_AR(esc(u))}`,
      body: '<p style="margin:0 0 12px">تم تأكيد بريدك وحسابك جاهز.</p><p style="margin:0">كل أداة — كلمات المرور، والأسرار لمرة واحدة، والتجزئة، وJSON، والتاريخ الهجري وغيرها — تعمل بالكامل داخل متصفحك. اضغط <b>Ctrl K</b> في أي صفحة للانتقال مباشرة إلى أداة.</p>',
      button: 'افتح الأدوات', note: '',
      text: (url) => `أهلًا ${u}! حسابك جاهز: ${url}`,
    }),
    reset: (u) => ({
      subject: 'إعادة تعيين كلمة مرورك في Nicely Done', preheader: 'اختر كلمة مرور جديدة — الرابط صالح لساعة واحدة.',
      title: `إعادة تعيين ${ACCENT_AR('كلمة المرور')}`,
      body: `<p style="margin:0">مرحبًا ${esc(u)}، طلب أحدهم (نأمل أنه أنت) إعادة تعيين كلمة مرورك. اضغط أدناه لاختيار كلمة جديدة.</p>`,
      button: 'اختر كلمة مرور جديدة', note: 'تنتهي صلاحية هذا الرابط خلال ساعة ويعمل مرة واحدة. إن لم تطلب ذلك فتجاهل هذه الرسالة — لن تتغير كلمة مرورك.',
      text: (url) => `مرحبًا ${u}،\n\nأعد تعيين كلمة مرورك: ${url}\n\nتنتهي صلاحية الرابط خلال ساعة.`,
    }),
  },
};

function layout(L, { preheader, title, body, button, note }, url) {
  return `<!doctype html><html lang="${L === COPY.ar ? 'ar' : 'en'}" dir="${L.dir}"><body style="margin:0;background:#f5f3ee;font-family:${L.font};color:#161613">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px" dir="${L.dir}"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;border:1px solid #e7e4dc;text-align:${L.dir === 'rtl' ? 'right' : 'left'}">
<tr><td style="padding:36px 36px 0">
  <table role="presentation" cellpadding="0" cellspacing="0" dir="ltr"><tr>
    <td style="width:30px;height:30px;background:#0f1210;border-radius:9px;text-align:center;color:#7ee2b0;font-size:18px;font-weight:700;line-height:30px">&#10003;</td>
    <td style="padding-left:10px;font-family:Georgia,serif;font-size:20px">nicely<i style="color:#0f8a5c">done</i></td>
  </tr></table>
</td></tr>
<tr><td style="padding:28px 36px 8px">
  <h1 style="margin:0 0 14px;font-family:${L.serif};font-weight:400;font-size:30px;line-height:1.3">${title}</h1>
  <div style="font-size:15px;line-height:1.7;color:#5b5a54">${body}</div>
  ${button ? `<p style="margin:28px 0"><a href="${url}" style="display:inline-block;background:#0f8a5c;color:#ffffff;text-decoration:none;font-weight:600;padding:13px 24px;border-radius:999px;font-size:15px">${button}</a></p>
  <p style="font-size:12px;color:#9a988f;word-break:break-all">${L.orPaste}<br><span dir="ltr">${url}</span></p>` : ''}
</td></tr>
<tr><td style="padding:8px 36px 32px;font-size:12px;color:#9a988f;border-top:1px solid #efede6">${note || ''}<br>Nicely Done · <a href="${SITE_URL}" style="color:#9a988f">${SITE_URL.replace(/^https?:\/\//, '')}</a></td></tr>
</table></td></tr></table></body></html>`;
}

async function send(to, kind, username, url, lang) {
  const L = COPY[lang === 'ar' ? 'ar' : 'en'];
  const c = L[kind](username);
  await transporter.sendMail({ from: FROM, to, subject: c.subject, html: layout(L, c, url), text: c.text(url) });
}

const pre = (lang) => (lang === 'ar' ? '/ar' : '');

exports.sendVerification = (email, username, token, lang) =>
  send(email, 'verify', username, `${SITE_URL}/api/verify-email?token=${token}${lang === 'ar' ? '&lang=ar' : ''}`, lang);
exports.sendWelcome = (email, username, lang) => send(email, 'welcome', username, `${SITE_URL}${pre(lang)}/`, lang);
exports.sendPasswordReset = (email, username, token, lang) =>
  send(email, 'reset', username, `${SITE_URL}${pre(lang)}/reset-password/?token=${token}`, lang);
