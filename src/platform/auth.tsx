// ============================================================================
// سياق مصادقة المنصة — المرحلة الأولى (Firebase Auth)
// ----------------------------------------------------------------------------
// - الدخول بالبريد وكلمة المرور، ودخول Google، والخروج.
// - الدور والعيادة يُقرآن من مستند `users/{uid}` في Firestore (role +
//   clinicId). حساب بلا مستند مستخدم لا يحمل أي دور ولا يصل إلى أي بيانات
//   منصة — قواعد Firestore (firestore.rules) ترفضه افتراضيًا.
// - ملف الدور يُقرأ باستماع مستمر (onSnapshot) لا بقراءة واحدة: عند
//   إنشاء الحساب يصل حدث الدخول قبل إنشاء المستند، فكانت القراءة
//   الواحدة تثبّت «بلا ملف دور» حتى إعادة التحميل؛ المستمع يحدّث
//   الملف لحظة إنشاء المستند، ويُلغى عند تبدّل المستخدم أو الخروج.
// - ملاحظة تصميمية موثقة (تقوية لاحقة، ليست جزءًا من هذه المرحلة):
//   دراسة §٥ تفترض أن الدور والعيادة يأتيان من claims مخصصة في ID token
//   (تُمنح عبر Cloud Function)، لأن claims لا يستطيع العميل تعديلها بينما
//   مستند المستخدم يخضع لقواعد الكتابة فقط. هذه المرحلة تستخدم مستند
//   المستخدم كمصدر للدور مع قواعد تمنع غير الأدمن من تعديل دوره أو عيادته.
//   الانتقال إلى claims هو خطوة تقوية لاحقة موثقة في الـ PR ولا تغيّر واجهة
//   هذا السياق (سيقرأ الـ claims بدل المستند عندها).
// - دخول Google متاح للطبيب/الأدمن فقط حسب القرار المسجل — وهذا يُفرض عند
//   إنشاء الحساب (الأدمن ينشئ حسابات الطاقم)، لا عند زر الدخول نفسه: زر
//   Google لا يمنح دورًا؛ الدور يأتي من مستند المستخدم حصرًا. مريض يدخل
//   بـ Google بلا مستند مستخدم بدور مريض يبقى بلا وصول.
// - لا يوجد تسجيل ذاتي هنا: لا createUserWithEmailAndPassword ولا روابط
//   دعوة في هذه المرحلة. إنشاء الحسابات وظيفة إدارة لاحقة.
// ============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebaseAuth, getFirestoreDb } from './firebase';
import type { PlatformRole, PlatformUserProfile } from './firestore';

export type { PlatformRole, PlatformUserProfile };

const PLATFORM_ROLES: ReadonlySet<string> = new Set([
  'patient',
  'coach',
  'admin',
  'owner',
]);

// تحقق خالص (قابل للاختبار بلا Firebase) من شكل مستند المستخدم.
// يُقبل المستند فقط عندما يحمل دورًا معروفًا ومعرّف عيادة غير فارغ.
export function parseUserProfile(
  uid: string,
  data: unknown,
): PlatformUserProfile | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  const role = record.role;
  const clinicId = record.clinicId;
  if (typeof role !== 'string' || !PLATFORM_ROLES.has(role)) return null;
  if (typeof clinicId !== 'string' || clinicId.length === 0) return null;
  return {
    uid,
    role: role as PlatformRole,
    clinicId,
    email: typeof record.email === 'string' ? record.email : null,
    displayName:
      typeof record.displayName === 'string' ? record.displayName : null,
    disabled: record.disabled === true,
  };
}

export interface PlatformAuthState {
  /** مستخدم Firebase الحالي، أو null قبل الدخول. */
  user: User | null;
  /** ملف الدور والعيادة من users/{uid}، أو null إن لم يوجد/لم يُتحقق. */
  profile: PlatformUserProfile | null;
  /** true أثناء تحقق الجلسة الأولى. */
  loading: boolean;
  /** true عندما يكون للمستخدم جلسة لكن بلا ملف دور صالح. */
  profileMissing: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOutPlatform: () => Promise<void>;
}

const PlatformAuthContext = createContext<PlatformAuthState | null>(null);

export function PlatformAuthProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<PlatformUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileMissing, setProfileMissing] = useState(false);

  useEffect(() => {
    // مستمع مستمر لمستند المستخدم بدل قراءة واحدة: عند إنشاء الحساب
    // يطلق Firebase حدث تغيّر حالة الدخول فورًا قبل إنشاء مستند
    // المستخدم (الذي يُنشأ لاحقًا داخل مسار التسجيل)، فكانت القراءة
    // الواحدة تثبّت الملف على «مفقود» ولا شيء يعيد قراءته — فيظهر
    // «حسابك بلا ملف دور» مع كل تسجيل جديد حتى إعادة التحميل. مع
    // onSnapshot يظهر الملف لحظة إنشائه بلا إعادة تحميل.
    let docUnsubscribe: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (nextUser) => {
      // إلغاء مستمع المستند السابق عند تبدّل المستخدم أو الخروج، حتى
      // لا تتسرب مستمعات ولا تصل تحديثات من مستخدم قديم.
      docUnsubscribe?.();
      docUnsubscribe = null;
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setProfileMissing(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      docUnsubscribe = onSnapshot(
        doc(getFirestoreDb(), 'users', nextUser.uid),
        (snap) => {
          const parsed = snap.exists()
            ? parseUserProfile(nextUser.uid, snap.data())
            : null;
          setProfile(parsed);
          setProfileMissing(parsed === null);
          setLoading(false);
        },
        () => {
          setProfile(null);
          setProfileMissing(true);
          setLoading(false);
        },
      );
    });
    return () => {
      docUnsubscribe?.();
      unsubscribe();
    };
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<void> => {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    },
    [],
  );

  const signInWithGoogle = useCallback(async (): Promise<void> => {
    await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
  }, []);

  const signOutPlatform = useCallback(async (): Promise<void> => {
    await signOut(getFirebaseAuth());
  }, []);

  const value = useMemo<PlatformAuthState>(
    () => ({
      user,
      profile,
      loading,
      profileMissing,
      signInWithEmail,
      signInWithGoogle,
      signOutPlatform,
    }),
    [user, profile, loading, profileMissing, signInWithEmail, signInWithGoogle, signOutPlatform],
  );

  return (
    <PlatformAuthContext.Provider value={value}>
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth(): PlatformAuthState {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) {
    throw new Error('usePlatformAuth يجب أن يُستخدم داخل PlatformAuthProvider');
  }
  return ctx;
}
