// بوابة الاشتراك: تفحص حالة اشتراك العيادة عند التحميل.
// - منتهي (expired): شاشة إيقاف كامل + نموذج التجديد (لا وصول لأي شيء)
// - سماح (grace): بانر يومي + وصول طبيعي
// - نشط: وصول طبيعي

import { useEffect, useState, type ReactNode } from 'react';
import {
  daysUntilExpiry,
  getSubscription,
  type ClinicSubscriptionDoc,
} from '../subscription';
import { RenewalForm } from './RenewalForm';

export function GraceBanner({ daysLeft }: { daysLeft: number | null }) {
  return (
    <div
      dir="rtl"
      className="bg-amber-100 px-4 py-2.5 text-center text-sm font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
    >
      ⚠️ اشتراك العيادة انتهى — فترة السماح:
      {daysLeft != null ? ` باقي ${daysLeft} أيام` : ''} — جدّد الآن لتفادي
      الإيقاف الكامل
    </div>
  );
}

function ExpiredBlock({
  clinicId,
  uid,
}: {
  clinicId: string;
  uid: string;
}) {
  const [showForm, setShowForm] = useState(false);
  return (
    <div
      dir="rtl"
      className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <div className="text-5xl">🔒</div>
      <h1 className="text-xl font-black">اشتراك العيادة متوقف</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        انتهت فترة السماح ولم يتم التجديد — لا يمكن الوصول إلى بيانات العيادة
        حتى يتم تفعيل الاشتراك.
      </p>
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white"
        >
          طلب التجديد
        </button>
      ) : (
        <div className="w-full">
          <RenewalForm
            clinicId={clinicId}
            uid={uid}
            onSubmitted={() => {}}
          />
        </div>
      )}
      <p className="text-xs text-slate-500">
        للاستفسار تواصل مع إدارة المنصة
      </p>
    </div>
  );
}

export function SubscriptionGate({
  clinicId,
  uid,
  role,
  children,
}: {
  clinicId: string;
  uid: string;
  role: string;
  children: ReactNode;
}) {
  const [sub, setSub] = useState<ClinicSubscriptionDoc | null | undefined>(
    undefined,
  );

  // صاحب المنصة لا يخضع لبوابة الاشتراك — لا فحص أصلًا
  const skipCheck = role === 'owner';

  useEffect(() => {
    if (skipCheck) return;
    let cancelled = false;
    void getSubscription(clinicId)
      .then((s) => {
        if (!cancelled) setSub(s);
      })
      .catch(() => {
        if (!cancelled) setSub(null);
      });
    return () => {
      cancelled = true;
    };
  }, [clinicId, skipCheck]);

  if (skipCheck) return <>{children}</>;

  // جارٍ الفحص — لا نعرض المحتوى حتى نتأكد
  if (sub === undefined) {
    return (
      <div dir="rtl" className="p-6 text-center text-sm text-slate-500">
        جارٍ التحقق من الاشتراك…
      </div>
    );
  }

  const status = sub?.status;
  // بلا اشتراك أو منتهي: إيقاف كامل (القواعد تمنع البيانات أصلًا)
  if (!sub || status === 'expired') {
    return <ExpiredBlock clinicId={clinicId} uid={uid} />;
  }

  const daysLeft = daysUntilExpiry(sub);
  return (
    <>
      {status === 'grace' && <GraceBanner daysLeft={daysLeft} />}
      {children}
    </>
  );
}
