import nodemailer from 'nodemailer';

let transporter = null;

const isConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransporter = () => {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      pool: true,
      maxConnections: 3,
    });
  }
  return transporter;
};

const esc = (v = '') =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Brand-consistent responsive wrapper. All dynamic values must be passed through esc(). */
export const layout = ({ heading, bodyHtml, cta }) => {
  const client = process.env.CLIENT_URL || 'http://localhost:5173';
  const button = cta
    ? `<p style="margin:28px 0"><a href="${esc(cta.url.startsWith('http') ? cta.url : client + cta.url)}" style="background:#242019;color:#fff;padding:12px 26px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px">${esc(cta.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f7f3ec;font-family:Inter,Arial,sans-serif;color:#242019">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="text-align:center;letter-spacing:6px;font-size:22px;font-weight:700;margin-bottom:24px">SVARA</div>
    <div style="background:#fff;border-radius:20px;padding:32px;border:1px solid #eadfcd">
      <h1 style="font-size:20px;margin:0 0 16px">${esc(heading)}</h1>
      <div style="font-size:14px;line-height:1.7;color:#4a4339">${bodyHtml}</div>${button}
    </div>
    <p style="text-align:center;font-size:11px;color:#9a8f7e;margin-top:20px">You are receiving this because of activity on your SVARA account.</p>
  </div></body></html>`;
};

export { esc };

/**
 * Send an email with retry logic (up to 3 attempts with exponential backoff).
 */
export const sendEmail = async ({ to, subject, html, text, strict = false, retries = 2 }) => {
  if (!to) return false;
  if (!isConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      const err = new Error('SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS).');
      if (strict) throw err;
      console.error('[email]', err.message);
      return false;
    }
    console.log(`\n[email:dev] To: ${to}\n[email:dev] Subject: ${subject}\n[email:dev] ${text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300)}\n`);
    return true;
  }

  let attempt = 0;
  while (attempt <= retries) {
    try {
      await getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `SVARA <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      });
      return true;
    } catch (err) {
      attempt++;
      console.error(`[email] send attempt ${attempt} failed:`, err.message);
      if (attempt > retries) {
        if (strict) throw err;
        return false;
      }
      // Wait before retry
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
  return false;
};

export const sendOtpEmail = (to, code, purpose) => {
  const titles = {
    login: { subject: `${code} is your SVARA sign-in code`, heading: 'Confirm your sign-in', action: 'finish signing in' },
    register: { subject: `${code} is your SVARA verification code`, heading: 'Verify your email address', action: 'verify your email' },
    'password-reset': { subject: `${code} is your SVARA password reset code`, heading: 'Reset your password', action: 'reset your password' },
  };
  const config = titles[purpose] || titles.register;

  return sendEmail({
    to,
    strict: true,
    subject: config.subject,
    html: layout({
      heading: config.heading,
      bodyHtml: `<p>Use this code to ${config.action}:</p>
        <p style="font-size:34px;letter-spacing:10px;font-weight:700;margin:20px 0;color:#242019">${esc(code)}</p>
        <p>The code expires in <strong>3 minutes</strong>. If you didn't request it, you can ignore this email — your account remains secure.</p>`,
    }),
    text: `Your SVARA code is ${code}. It expires in 3 minutes.`,
  });
};

export const sendPasswordResetConfirmationEmail = (to, name = 'there') => {
  return sendEmail({
    to,
    subject: 'Your SVARA password has been reset',
    html: layout({
      heading: 'Password Reset Successful',
      bodyHtml: `<p>Hi ${esc(name)},</p>
        <p>The password for your SVARA account has been successfully changed.</p>
        <p>If you did not perform this change, please contact SVARA Support immediately.</p>`,
      cta: { label: 'Sign in to SVARA', url: '/login' },
    }),
    text: 'Your SVARA password has been successfully reset. If you did not make this change, contact support immediately.',
  });
};
