/** Fail fast in production if security/delivery-critical configuration is missing or unsafe. */
export const validateEnv = () => {
  if (process.env.NODE_ENV !== 'production') return;
  const problems = [];
  const need = (k) => !process.env[k] && problems.push(`${k} is required`);

  ['MONGODB_URI', 'JWT_SECRET', 'CLIENT_URL', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMS_PROVIDER'].forEach(need);
  if ((process.env.JWT_SECRET || '').length < 32) problems.push('JWT_SECRET must be at least 32 characters');
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'Admin@123') problems.push('ADMIN_PASSWORD must be set to a strong, non-default value');
  if (process.env.SMS_PROVIDER === 'console') problems.push('SMS_PROVIDER=console is dev-only');
  if (process.env.SMS_PROVIDER === 'msg91') ['MSG91_AUTH_KEY', 'MSG91_TEMPLATE_ID'].forEach(need);
  if (process.env.SMS_PROVIDER === 'twilio') ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'].forEach(need);

  if (problems.length) {
    console.error('❌ Invalid production configuration:\n - ' + problems.join('\n - '));
    process.exit(1);
  }
  const warn = [];
  if (!process.env.VAPID_PUBLIC_KEY) warn.push('VAPID keys missing — web push disabled');
  if (!process.env.UPI_VPA) warn.push('UPI_VPA missing — UPI payment option disabled');
  warn.forEach((w) => console.warn('⚠️ ', w));
};
