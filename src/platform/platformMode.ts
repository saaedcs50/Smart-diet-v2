// ============================================================================
// مفتاح وضع المنصة — معطّل افتراضيًا (opt-in)
// ----------------------------------------------------------------------------
// وضع العيادة الواحدة الحالي (PIN المحلي) هو السلوك الافتراضي دائمًا.
// لا ينشط وضع المنصة إلا بمتغير بيئة صريح عند البناء:
//   VITE_PLATFORM_ENABLED=true
// وبدون هذا المتغير (أي القيمة الافتراضية) لا يحدث أي تغيير في سلوك
// التطبيق، ولا تُقرأ ولا تُكتب أي بيانات سحابية، ولا يُرحَّل أي شيء.
// تفعيل المتغير وحده لا يرحّل بيانات ولا ينشئ مستخدمين: إنشاء الحسابات
// يتم لاحقًا من لوحة الإدارة فقط (دراسة §٢: لا تسجيل ذاتي).
// تُقرأ القيمة عند كل استدعاء (لا عند تحميل الوحدة) حتى تعمل الاختبارات
// التي تغيّر البيئة، وحتى لا يلتقط البناء قيمة قديمة.
// ============================================================================

function readFlag(): string | undefined {
  const metaEnv = (import.meta as unknown as {
    env?: Record<string, string | undefined>;
  }).env?.VITE_PLATFORM_ENABLED;
  if (metaEnv !== undefined) return metaEnv;
  const procEnv = (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env?.VITE_PLATFORM_ENABLED;
  return procEnv;
}

export function isPlatformEnabled(): boolean {
  return readFlag() === 'true';
}
