// ============================================================================
// سياق مصادقة المنصة — المرحلة الأولى (Firebase Auth)
// ----------------------------------------------------------------------------
// - الدخول بالبريد وكلمة المرور، ودخول Google، والخروج.
// - الدور والعيادة يُقرآن من مستند `users/{uid}` في Firestore (role +
//   clinicId). حساب بلا مستند مستخدم لا يحمل أي دور ولا يصل إلى أي بيانات
//   منصة — قواعد Firestore (firestore.rules) ترفضه افتراضيًا.
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
import { doc, getDoc } from 'firebase/firestore';
import { firebaseAuth, firestoreDb } from './firebase';
import type { PlatformRole, PlatformUserProfile } from './firestore';

export type { PlatformRole, PlatformUserProfile };

const PLATFORM_ROLES: ReadonlySet<string> = new Set([
  'patient',
  'coach',
  'admin',
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
    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setProfileMissing(false);
        setLoading(false);
        return;
      }
      void getDoc(doc(firestoreDb, 'users', nextUser.uid))
        .then((snap) => {
          const parsed = snap.exists()
            ? parseUserProfile(nextUser.uid, snap.data())
            : null;
          setProfile(parsed);
          setProfileMissing(parsed === null);
        })
        .catch(() => {
          setProfile(null);
          setProfileMissing(true);
        })
        .finally(() => setLoading(false));
    });
    return unsubscribe;
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<void> => {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
    },
    [],
  );

  const signInWithGoogle = useCallback(async (): Promise<void> => {
    await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
  }, []);

  const signOutPlatform = useCallback(async (): Promise<void> => {
    await signOut(firebaseAuth);
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
