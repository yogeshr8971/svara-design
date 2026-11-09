/**
 * SMS delivery (used for phone-number OTP only).
 * Providers: 'msg91' (recommended for India / DLT), 'twilio', or 'console' (dev only).
 * Implemented with fetch so there is no extra SDK dependency.
 */
const provider = () => (process.env.SMS_PROVIDER || (process.env.NODE_ENV === 'production' ? '' : 'console')).toLowerCase();

export const sendSms = async (toE164, message, { otp } = {}) => {
  const p = provider();

  if (p === 'console') {
    if (process.env.NODE_ENV === 'production') throw new Error('SMS_PROVIDER=console is not allowed in production.');
    console.log(`\n[sms:dev] To: ${toE164}\n[sms:dev] ${message}\n`);
    return true;
  }

  if (p === 'msg91') {
    // MSG91 OTP flow API v5 — template must be DLT-approved.
    const res = await fetch('https://control.msg91.com/api/v5/otp?' + new URLSearchParams({
      template_id: process.env.MSG91_TEMPLATE_ID,
      mobile: toE164.replace('+', ''),
      authkey: process.env.MSG91_AUTH_KEY,
      otp: otp || '',
    }), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.type === 'error') throw new Error(`MSG91 error: ${body.message || res.status}`);
    return true;
  }

  if (p === 'twilio') {
    const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = process.env;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: toE164, From: from, Body: message }),
    });
    if (!res.ok) throw new Error(`Twilio error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return true;
  }

  throw new Error('No SMS provider configured. Set SMS_PROVIDER to msg91 or twilio.');
};

export const sendOtpSms = (phone, code) =>
  sendSms(phone, `${code} is your SVARA verification code. Valid for 10 minutes. Do not share it with anyone.`, { otp: code });
