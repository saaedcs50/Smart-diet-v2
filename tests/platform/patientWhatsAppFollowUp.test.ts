import { describe, expect, it } from 'vitest';
import {
  buildFollowUpWhatsAppUrl,
  normalizeEgyptianWhatsAppPhone,
} from '../../src/platform/patientWhatsAppFollowUp';

describe('Egyptian WhatsApp follow-up', () => {
  it.each([
    ['01012345678', '201012345678'],
    ['+20 10 1234 5678', '201012345678'],
    ['0020-101-234-5678', '201012345678'],
    ['01112345678', '201112345678'],
    ['01212345678', '201212345678'],
    ['01512345678', '201512345678'],
    ['٠١٠١٢٣٤٥٦٧٨', '201012345678'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeEgyptianWhatsAppPhone(input)).toBe(expected);
  });

  it.each([
    '',
    '0101234567',
    '01312345678',
    '02012345678',
    '20101234567',
    '1234567890',
    '+441234567890',
  ])('rejects invalid Egyptian mobile number %s', (input) => {
    expect(normalizeEgyptianWhatsAppPhone(input)).toBeNull();
  });

  it('does not expose a WhatsApp action without a recorded consent timestamp', () => {
    expect(buildFollowUpWhatsAppUrl({
      phone: '201012345678',
      consentAt: null,
      patientName: 'مريض تجريبي',
    })).toBeNull();
  });

  it('creates a prefilled generic message without sending it or embedding health details', () => {
    const url = buildFollowUpWhatsAppUrl({
      phone: '01012345678',
      consentAt: '2026-11-22T12:00:00.000Z',
      patientName: 'مريض تجريبي',
    });
    expect(url).toContain('https://wa.me/201012345678?text=');
    const message = decodeURIComponent(url!.split('text=')[1]);
    expect(message).toContain('مريض تجريبي');
    expect(message).toContain('متابعتك مؤخرًا');
    expect(message).not.toContain('وزن');
    expect(message).not.toContain('دواء');
  });
});
