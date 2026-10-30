// ============================================================================
// ملف إعدادات البراندنج: للاستخدام داخل كود React/TypeScript
// المصدر الحقيقي: src/config/brand.json
// PIN لا يُخزَّن هنا أبدًا: المصدر الوحيد: COACH_PIN في بيئة السيرفر
// ============================================================================

import brandData from './brand.json' with { type: 'json' };

export type BrandConfig = {
  appName: string;
  shortName: string;
  clinicName: string;
  doctorName: string;
  doctorNameAlt: string;
  description: string;
  /** اللون الأساسي (أزرار ثانوية / روابط / هوية) */
  themeColor: string;
  /** لون التمييز (أزرار رئيسية / CTA) */
  accentColor: string;
  /** لون وظيفي ثالث (تقدم/رسوم/تمييز هادئ) */
  tertiaryColor: string;
  /** لون أسطح مميزة فاتحة (كروت تنبيه/شارات) */
  tintColor: string;
  backgroundColor: string;
  whatsapp: string;
  logoPath: string;
  specialistTitle: string;
  specialistShort: string;
  specialistTo: string;
};

const raw = brandData as Partial<BrandConfig>;

export const BRAND: BrandConfig = {
  appName: raw.appName || 'Smart Diet',
  shortName: raw.shortName || raw.appName || 'Smart Diet',
  clinicName: raw.clinicName || '',
  doctorName: raw.doctorName || '',
  doctorNameAlt: raw.doctorNameAlt || raw.doctorName || '',
  description: raw.description || '',
  themeColor: (raw.themeColor || '').trim() || '#5B2482',
  accentColor: (raw.accentColor || '').trim() || '#E21B6D',
  tertiaryColor: (raw.tertiaryColor || '').trim() || '#70D6C5',
  tintColor: (raw.tintColor || '').trim() || '#CAE5BC',
  backgroundColor: (raw.backgroundColor || '').trim() || '#F8F7F9',
  whatsapp: raw.whatsapp || '',
  logoPath: raw.logoPath || '/icon.svg',
  specialistTitle: (raw.specialistTitle || '').trim() || 'أخصائي التغذية',
  specialistShort: (raw.specialistShort || '').trim() || 'الأخصائي',
  specialistTo: (raw.specialistTo || '').trim() || 'للأخصائي',
};

export const brandCopy = {
  coachPanel: `لوحة تحكم ${BRAND.specialistTitle}`,
  coachPanelNamed: `لوحة تحكم ${BRAND.specialistTitle} (${BRAND.doctorName})`,
  coachGuide: `دليل لوحة ${BRAND.specialistTitle}`,
  coachGuideBadge: `دليل ${BRAND.specialistTitle}`,
  addPlanCta: `إضافة خطة ${BRAND.specialistShort}`,
  reportWhatsApp: `إرسال التقرير ${BRAND.specialistTo} عبر واتساب`,
  shareProgress: `متابعة التطور ومشاركة ${BRAND.specialistShort}`,
  weeklyReportTip: `إرسال التقرير الأسبوعي ${BRAND.specialistTo} يساعد في تحديث خطتك وتعديل السعرات لكسر أي ثبات وزن بشكل مستمر!`,
  featureGuides: `توجيهات ${BRAND.specialistShort}`,
  approvedBy: `مُسجل ومُعتمد من قِبل ${BRAND.specialistShort}`,
  pinLabel: `رمز PIN الخاص بـ${BRAND.specialistShort}`,
  pinWrong: 'رمز PIN غير صحيح.',
  tipsFrom: `نصائح وتوجيهات ${BRAND.specialistShort}`,
  traineeNotes: `خانة رسائل المتدرب المباشرة ${BRAND.specialistTo} المرفقة بالتقرير اليومي`,
  helpHunger: `تسجيل مستوى الشبع والجوع: يمكنك تقييم شعورك قبل وبعد الوجبة لمساعدة ${BRAND.specialistShort} في ضبط الكميات لاحقاً.`,
  symptomsTitle: `ملاحظات الأعراض والرسالة المباشرة ${BRAND.specialistTo}`,
  reportHelpTitle: `إرسال تقرير المتابعة ${BRAND.specialistTo} عبر واتساب`,
  reportHelpStep: `في يوم المتابعة، اضغط على زر "إرسال التقرير ${BRAND.specialistTo} عبر واتساب".`,
  reportHelpTip: `إرسال التقرير بانتظام يساعد ${BRAND.specialistShort} في تعديل خطتك وتفادي أي ثبات وزن مبكراً.`,
};

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): [number, number, number] | null {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((x) => clamp(x).toString(16).padStart(2, '0')).join('');
}

/** amount: سالب = أغمق، موجب = أفتح */
export function adjustColor(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex(rgb[0] + amount, rgb[1] + amount, rgb[2] + amount);
}

function mixWithWhite(hex: string, ratio: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex(
    rgb[0] + (255 - rgb[0]) * ratio,
    rgb[1] + (255 - rgb[1]) * ratio,
    rgb[2] + (255 - rgb[2]) * ratio,
  );
}

function mixWithBlack(hex: string, ratio: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex(rgb[0] * (1 - ratio), rgb[1] * (1 - ratio), rgb[2] * (1 - ratio));
}

function setLinkHref(rel: string, href: string, extra?: { type?: string; sizes?: string }) {
  if (typeof document === 'undefined' || !href) return;
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
  if (extra?.type) el.type = extra.type;
  if (extra?.sizes) el.setAttribute('sizes', extra.sizes);
}

/**
 * يحدّث أيقونة التاب / PWA / عنوان أبل من logoPath في الهوية (وقت التشغيل).
 */
export function applyBrandHeadAssets(brand: BrandConfig = BRAND): void {
  if (typeof document === 'undefined') return;
  const logo = (brand.logoPath || '/icon.svg').trim();
  setLinkHref('icon', logo);
  setLinkHref('apple-touch-icon', logo);
  const theme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (theme) theme.content = brand.themeColor;
  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null;
  if (appleTitle) appleTitle.content = brand.shortName || brand.appName;
  if (document.title) {
    document.title = `${brand.appName} - ${brand.doctorName}`;
  }
}

/**
 * يحقن ألوان الهوية على :root و .dark و متغيرات Tailwind @theme
 * يُستدعى مرة عند الإقلاع من main.tsx
 */
export function applyBrandTheme(brand: BrandConfig = BRAND): void {
  if (typeof document === 'undefined') return;

  const secondary = brand.themeColor || '#5B2482';
  const hero = brand.accentColor || '#E21B6D';
  const pageBg = brand.backgroundColor || '#F8F7F9';
  const tertiary = brand.tertiaryColor || '#70D6C5';
  const tint = brand.tintColor || '#CAE5BC';
  const tertiaryHover = adjustColor(tertiary, -18);
  const heroHover = adjustColor(hero, -20);
  const secondaryHover = adjustColor(secondary, -25);
  const muted = mixWithWhite(secondary, 0.88);
  const border = mixWithWhite(secondary, 0.55);
  const textPrimary = mixWithBlack(secondary, 0.55);
  const textSecondary = mixWithBlack(secondary, 0.38); // 0.38 لضمان تباين 4.5:1 على الخلفيات الفاتحة

  const root = document.documentElement;

  // Clear any existing inline styles on root element so CSS stylesheet rules take precedence cleanly
  const allVarKeys = [
    '--app-bg', '--app-card', '--app-card-muted', '--app-border',
    '--app-text-primary', '--app-text-secondary', '--app-hero', '--app-hero-hover',
    '--app-secondary', '--app-secondary-hover', '--app-tertiary', '--app-tertiary-hover', '--app-tint', '--app-gold', '--app-gold-light',
    '--color-brand-primary-text', '--color-brand-secondary-text', '--color-brand-bg',
    '--color-brand-card', '--color-brand-muted', '--color-brand-border',
    '--color-brand-hero', '--color-brand-hero-hover', '--color-brand-secondary',
    '--color-brand-secondary-hover', '--color-brand-gold', '--color-brand-gold-light',
    '--color-brand-neon'
  ];
  for (const k of allVarKeys) {
    root.style.removeProperty(k);
  }

  // Dark palette calculations: clean, high-contrast dark theme
  const darkBg = '#0b0f19';
  const darkCard = '#111827';
  const darkMuted = '#1e293b';
  const darkBorder = '#334155';
  const darkText = '#f8fafc';
  const darkTextSec = '#94a3b8';
  const darkHeroHover = mixWithWhite(hero, 0.2);
  const darkSecondary = mixWithWhite(secondary, 0.3);
  const darkSecondaryHover = mixWithWhite(secondary, 0.45);
  const darkTertiaryHover = mixWithWhite(tertiary, 0.18);
  const darkTint = '#353E3D'; // sage ممزوج مع خلفية الداكن

  let themeStyle = document.getElementById('brand-theme-vars') as HTMLStyleElement | null;
  if (!themeStyle) {
    themeStyle = document.createElement('style');
    themeStyle.id = 'brand-theme-vars';
    document.head.appendChild(themeStyle);
  }

  themeStyle.textContent = `
:root {
  --app-bg: ${pageBg};
  --app-card: #FFFFFF;
  --app-card-muted: ${muted};
  --app-border: ${border};
  --app-text-primary: ${textPrimary};
  --app-text-secondary: ${textSecondary};
  --app-hero: ${hero};
  --app-hero-hover: ${heroHover};
  --app-secondary: ${secondary};
  --app-secondary-hover: ${secondaryHover};
  --app-tertiary: ${tertiary};
  --app-tertiary-hover: ${tertiaryHover};
  --app-tint: ${tint};
  --app-gold: #E0922D;
  --app-gold-light: #F2C66D;

  --color-brand-primary-text: ${textPrimary};
  --color-brand-secondary-text: ${textSecondary};
  --color-brand-bg: ${pageBg};
  --color-brand-card: #FFFFFF;
  --color-brand-muted: ${muted};
  --color-brand-border: ${border};
  --color-brand-hero: ${hero};
  --color-brand-hero-hover: ${heroHover};
  --color-brand-secondary: ${secondary};
  --color-brand-secondary-hover: ${secondaryHover};
  --color-brand-gold: #E0922D;
  --color-brand-gold-light: #F2C66D;
  --color-brand-neon: ${mixWithWhite(hero, 0.15)};
}

.dark, html.dark, :root.dark {
  --app-bg: ${darkBg};
  --app-card: ${darkCard};
  --app-card-muted: ${darkMuted};
  --app-border: ${darkBorder};
  --app-text-primary: ${darkText};
  --app-text-secondary: ${darkTextSec};
  --app-hero: ${hero};
  --app-hero-hover: ${darkHeroHover};
  --app-secondary: ${darkSecondary};
  --app-secondary-hover: ${darkSecondaryHover};
  --app-tertiary: ${tertiary};
  --app-tertiary-hover: ${darkTertiaryHover};
  --app-tint: ${darkTint};
  --app-gold: #F2C66D;
  --app-gold-light: #FFE3A8;

  --color-brand-primary-text: ${darkText};
  --color-brand-secondary-text: ${darkTextSec};
  --color-brand-bg: ${darkBg};
  --color-brand-card: ${darkCard};
  --color-brand-muted: ${darkMuted};
  --color-brand-border: ${darkBorder};
  --color-brand-hero: ${hero};
  --color-brand-hero-hover: ${darkHeroHover};
  --color-brand-secondary: ${darkSecondary};
  --color-brand-secondary-hover: ${darkSecondaryHover};
  --color-brand-gold: #F2C66D;
  --color-brand-gold-light: #FFE3A8;
  --color-brand-neon: ${mixWithWhite(hero, 0.25)};
}
`;
}
