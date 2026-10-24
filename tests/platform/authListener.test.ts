// اختبارات ثابتة (static) لاستماع مزوّد المصادقة لملف المستخدم.
// هذه ليست تقييمًا حيًا للمستمع: لا توجد بنية اختبار لتصيير React ولا
// محاكي Firestore هنا، والتحقق الحي (تسجيل مريض تجريبي وظهور لوحته فورًا
// بلا إعادة تحميل) هو الإثبات النهائي بعد النشر. ما يُثبت هنا هو أن
// المزوّد يشترك باستماع مستمر على مستند المستخدم، ويلغيه عند تبدّل
// المستخدم أو إلغاء التحميل، ولا يعتمد على قراءة واحدة — وهو جوهر
// إصلاح «بلا ملف دور» المتكرر مع كل تسجيل جديد.
//
// الأسلوب متسق مع tests/platform/firestoreRules.test.ts (إثبات نصي).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const auth = readFileSync(
  path.join(repoRoot, 'src', 'platform', 'auth.tsx'),
  'utf8',
);

describe('PlatformAuthProvider profile listener', () => {
  it('يستمع باستمرار لمستند المستخدم بدل قراءة واحدة', () => {
    expect(auth).toContain('onSnapshot(');
    expect(auth).toContain("doc(getFirestoreDb(), 'users', nextUser.uid)");
    expect(auth).not.toContain('getDoc(');
  });

  it('يلغي مستمع المستند عند تبدّل المستخدم وعند إلغاء التحميل', () => {
    expect(auth).toContain('docUnsubscribe?.();');
    expect(auth).toContain('docUnsubscribe = onSnapshot(');
  });

  it('يحافظ على دلالات الملف المفقود وحالة التحميل', () => {
    expect(auth).toContain('setProfileMissing(parsed === null)');
    expect(auth).toContain('setProfileMissing(true)');
    expect(auth).toContain('setLoading(false)');
  });

  it('لا يغيّر واجهة حالة المصادقة', () => {
    expect(auth).toContain('profileMissing: boolean');
    expect(auth).toContain('signInWithEmail:');
    expect(auth).toContain('signInWithGoogle:');
    expect(auth).toContain('signOutPlatform:');
  });
});
