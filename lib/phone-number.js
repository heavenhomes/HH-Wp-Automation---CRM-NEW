export function normalizePhoneNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');

  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;

  return digits;
}

export function getPhoneNumberLookupValues(value) {
  const normalized = normalizePhoneNumber(value);
  if (normalized.length === 12 && normalized.startsWith('91')) {
    const nationalNumber = normalized.slice(2);
    return [...new Set([normalized, nationalNumber, `0${nationalNumber}`])];
  }

  return normalized ? [normalized] : [];
}
