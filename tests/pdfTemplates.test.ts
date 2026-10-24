import { describe, it, expect } from 'vitest';
import {
  PLAN_PDF_TEMPLATES,
  resolvePlanPdfTemplate,
  resolveBrandHeader,
  isCompactTemplate,
} from '../src/utils/pdfTemplates';
import { BRAND } from '../src/config/brand';

describe('pdf templates — selection (Batch 3.2)', () => {
  it('exposes exactly the three spec templates', () => {
    expect(PLAN_PDF_TEMPLATES.map((t) => t.id)).toEqual(['classic', 'brand', 'compact']);
  });

  it('resolves known ids and falls back to classic for anything else', () => {
    expect(resolvePlanPdfTemplate('brand')).toBe('brand');
    expect(resolvePlanPdfTemplate('compact')).toBe('compact');
    expect(resolvePlanPdfTemplate('classic')).toBe('classic');
    expect(resolvePlanPdfTemplate('unknown')).toBe('classic');
    expect(resolvePlanPdfTemplate(undefined)).toBe('classic');
    expect(resolvePlanPdfTemplate(null)).toBe('classic');
  });

  it('isCompactTemplate only matches compact', () => {
    expect(isCompactTemplate('compact')).toBe(true);
    expect(isCompactTemplate('classic')).toBe(false);
    expect(isCompactTemplate('brand')).toBe(false);
  });
});

describe('pdf templates — brand header & logo fallback (Batch 3.2)', () => {
  it('uses the real clinic logo and brand colors when configured', () => {
    const h = resolveBrandHeader({
      clinicName: 'عيادة تجريبية',
      doctorName: 'د. تجريبية',
      logoPath: '/brands/clinic-logo.png',
      themeColor: '#5B2482',
      accentColor: '#E21B6D',
    });
    expect(h.showLogo).toBe(true);
    expect(h.logoSrc).toBe('/brands/clinic-logo.png');
    expect(h.primary).toBe('#5B2482');
    expect(h.accent).toBe('#E21B6D');
  });

  it('the live brand config is the neutral white-label identity (generic icon → text header)', () => {
    const h = resolveBrandHeader(BRAND);
    expect(BRAND.logoPath).toBe('/icon.svg');
    expect(h.showLogo).toBe(false);
    expect(h.logoSrc).toBeNull();
    expect(h.fallbackLabel).toBe(BRAND.clinicName);
    expect(h.primary).toBe(BRAND.themeColor);
  });

  it('generic /icon.svg does not count as a brand logo — falls back to text header', () => {
    const h = resolveBrandHeader({ clinicName: 'عيادة النور', logoPath: '/icon.svg' });
    expect(h.showLogo).toBe(false);
    expect(h.logoSrc).toBeNull();
    expect(h.fallbackLabel).toBe('عيادة النور');
  });

  it('missing logo falls back to clinic name, then doctor name, then default', () => {
    expect(resolveBrandHeader({ clinicName: 'عيادة أ', doctorName: 'د. ب', logoPath: '' }).fallbackLabel).toBe('عيادة أ');
    expect(resolveBrandHeader({ doctorName: 'د. ب', logoPath: '  ' }).fallbackLabel).toBe('د. ب');
    expect(resolveBrandHeader({}).fallbackLabel).toBe('Smart Diet Clinic');
    expect(resolveBrandHeader({}).showLogo).toBe(false);
  });

  it('missing colors fall back to the brand defaults', () => {
    const h = resolveBrandHeader({ logoPath: '/x.png', themeColor: ' ', accentColor: '' });
    expect(h.primary).toBe('#5B2482');
    expect(h.accent).toBe('#E21B6D');
  });
});
