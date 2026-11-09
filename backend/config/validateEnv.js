/** Fail fast in production if security/delivery-critical configuration is missing or unsafe. */
export const validateEnv = () => {
  if (process.env.NODE_ENV !== 'production') return;
  const problems = [];
  const need = (k) => !process.env[k] && problems.push(`${k} is required`);

  ['MONGODB_URI', 'JWT_SECRET'].forEach(need);
  if ((process.env.JWT_SECRET || '').length < 32) problems.push('JWT_SECRET must be at least 32 characters');
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD === 'Admin@123') {
    problems.push('ADMIN_PASSWORD must be set to a strong, non-default value in production');
  }

  if (problems.length) {
    const msg = '❌ Invalid production configuration:\n - ' + problems.join('\n - ');
    console.error(msg);
    throw new Error(msg);
  }

  const warn = [];
  if (!process.env.CLIENT_URL) warn.push('CLIENT_URL missing — defaulting to localhost and *.netlify.app / *.vercel.app');
  if (!process.env.SMTP_HOST) warn.push('SMTP_HOST missing — email delivery disabled');
  if (!process.env.SMS_PROVIDER || process.env.SMS_PROVIDER === 'console') warn.push('SMS_PROVIDER is unset or dev-only (console) — SMS disabled');
  if (!process.env.VAPID_PUBLIC_KEY) warn.push('VAPID keys missing — web push disabled');
  if (!process.env.UPI_VPA) warn.push('UPI_VPA missing — UPI payment option disabled');
  warn.forEach((w) => console.warn('⚠️ ', w));
};
