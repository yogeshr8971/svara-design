/** Normalise Indian mobile numbers to E.164 (+91XXXXXXXXXX). Returns null if invalid. */
export const normalizePhone = (raw) => {
  if (!raw) return null;
  let digits = String(raw).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    return /^\+\d{11,14}$/.test(digits) ? digits : null;
  }
  digits = digits.replace(/^0+/, '');
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
};

export const maskPhone = (p) => (p ? p.replace(/.(?=.{3})/g, '•') : '');
export const maskEmail = (e) => {
  if (!e) return '';
  const [u, d] = e.split('@');
  return `${u.slice(0, 2)}${'•'.repeat(Math.max(1, u.length - 2))}@${d}`;
};
