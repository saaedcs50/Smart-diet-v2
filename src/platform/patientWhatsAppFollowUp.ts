const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function toWesternDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)));
}

/**
 * Accepts Egyptian mobile numbers in local or international notation and
 * returns E.164 digits without the leading plus (201xxxxxxxxx).
 */
export function normalizeEgyptianWhatsAppPhone(value: string): string | null {
  let digits = toWesternDigits(String(value ?? '')).replace(/[^0-9]/g, '');
  if (digits.startsWith('0020')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `20${digits.slice(1)}`;
  else if (!digits.startsWith('20')) return null;

  return /^201[0125][0-9]{8}$/.test(digits) ? digits : null;
}

export function buildFollowUpWhatsAppUrl(input: {
  phone: string | null | undefined;
  consentAt: string | null | undefined;
  patientName: string;
}): string | null {
  if (!input.consentAt) return null;
  const phone = normalizeEgyptianWhatsAppPhone(input.phone ?? '');
  if (!phone) return null;

  const safeName = input.patientName.trim().slice(0, 100);
  const greeting = safeName ? `أهلًا ${safeName}،` : 'أهلًا،';
  const message = [
    greeting,
    'نتمنى أن تكون بخير. لاحظنا عدم تسجيل متابعتك مؤخرًا.',
    'هل تحتاج أي مساعدة من فريق العيادة؟ يسعدنا الاطمئنان عليك.',
  ].join(' ');

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
