// ============================================================================
// سياق مصادقة المنصة — ترحيل 2026-10-31: Firebase Auth ← Supabase Auth
// ----------------------------------------------------------------------------
// - الدخول بالبريد وكلمة المرور، ودخول Google (OAuth)، والخروج.
// - الدور والعيادة يُقرآن من جدول `profiles` (id = auth.uid()).
//   حساب بلا ملف لا يحمل أي دور ولا يصل إلى أي بيانات — سياسات RLS
//   ترفضه افتراضيًا.
// - ملف الدور يُقرأ عند تغيّر الجلسة + اشتراك realtime: عند إنشاء الحساب
//   يصل حدث الدخول قبل إنشاء الملف، فكانت القراءة الواحدة تثبّت
//   «بلا ملف دور» حتى إعادة التحميل؛ الاشتراك يحدّث الملف لحظة إنشائه.
// - دخول Google متاح للطبيب/الأدمن فقط حسب القرار المسجل — وهذا يُفرض عند
//   إنشاء الحساب (الأدمن ينشئ حسابات الطاقم)، لا عند زر الدخول نفسه.
// - لا يوجد تسجيل ذاتي هنا: إنشاء الحسابات وظيفة الدعوات (invitations.ts).
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
import type { User } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import type { PlatformRole, PlatformUserProfile } from './firestore';

export type { PlatformRole, PlatformUserProfile };

const PLATFORM_ROLES: ReadonlySet<string> = new Set([
  'patient',
  'coach',
  'admin',
  'owner',
]);

// تحقق خالص (قابل للاختبار بلا شبكة) من شكل ملف المستخدم.
// يُقبل الملف فقط عندما يحمل دورًا معروفًا ومعرّف عيادة غير فارغ.
// يدعم snake_case (Supabase) وcamelCase معًا.
export function parseUserProfile(
  uid: string,
  data: unknown,
): PlatformUserProfile | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  const role = record.role;
  const clinicId = record.clinicId ?? record.clinic_id;
  if (typeof role !== 'string' || !PLATFORM_ROLES.has(role)) return null;
  if (typeof clinicId !== 'string' || clinicId.length === 0) return null;
  const email = record.email;
  const displayName = record.displayName ?? record.display_name;
  const disabled = record.disabled;
  return {
    uid,
    role: role as PlatformRole,
    clinicId,
    email: typeof email === 'string' ? email : null,
    displayName: typeof displayName === 'string' ? displayName : null,
    disabled: disabled === true,
  };
}

export interface PlatformAuthState {
  /** مستخدم Supabase الحالي، أو null قبل الدخول. */
  user: User | null;
  /** ملف الدور والعيادة من profiles، أو null إن لم يوجد/لم يُتحقق. */
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

async function fetchProfile(uid: string): Promise<PlatformUserProfile | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select()
    .eq('id', uid)
    .single();
  if (error || !data) return null;
  return parseUserProfile(uid, data);
}

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
    const sb = getSupabase();
    let cancelled = false;
    let channel: ReturnType<typeof sb.channel> | null = null;

    const loadProfile = async (uid: string) => {
      setLoading(true);
      const parsed = await fetchProfile(uid);
      if (cancelled) return;
      // SDV2-INT-005: لا تعتمد على Realtime وحده (قد لا تكون الجداول منشورة).
      // إذا لم يوجد الملف بعد، أعد المحاولة بتراجع — قد يُنشأ الملف بعد حدث الدخول.
      if (parsed === null) {
        for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          if (cancelled) return;
          const retry = await fetchProfile(uid);
          if (retry !== null) {
            setProfile(retry);
            setProfileMissing(false);
            setLoading(false);
            return;
          }
        }
      }
      // اشتراك realtime على صف الملف: عند إنشاء الحساب يصل حدث الدخول
      // قبل إنشاء الملف، فيحدّث الاشتراك الملف لحظة إنشائه بلا إعادة تحميل.
      channel?.unsubscribe();
      channel = sb
        .channel(`profile-${uid}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${uid}`,
          },
          (payload) => {
            if (cancelled) return;
            const next = parseUserProfile(
              uid,
              (payload.new as Record<string, unknown> | undefined) ?? {},
            );
            setProfile(next);
            setProfileMissing(next === null);
            setLoading(false);
          },
        )
        .subscribe();
      setProfile(parsed);
      setProfileMissing(parsed === null);
      setLoading(false);
    };

    // الجلسة الحالية أولًا (قد تكون موجودة من زيارة سابقة)
    void sb.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setProfileMissing(false);
        setLoading(false);
        return;
      }
      void loadProfile(nextUser.id);
    });

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, session) => {
      channel?.unsubscribe();
      channel = null;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setProfileMissing(false);
        setLoading(false);
        return;
      }
      void loadProfile(nextUser.id);
    });

    return () => {
      cancelled = true;
      channel?.unsubscribe();
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<void> => {
      const { error } = await getSupabase().auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw new Error(error.message);
    },
    [],
  );

  const signInWithGoogle = useCallback(async (): Promise<void> => {
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/platform' },
    });
    if (error) throw new Error(error.message);
  }, []);

  const signOutPlatform = useCallback(async (): Promise<void> => {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw new Error(error.message);
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
