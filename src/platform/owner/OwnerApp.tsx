// ============================================================================
// لوحة صاحب المنصة (/owner) — المرحلة الثالثة من بناء B2B
// ----------------------------------------------------------------------------
// لصاحب المنصة (role='owner') فقط. تبويبات: العيادات، طلبات التفعيل،
// عيادة جديدة، إعدادات الدفع.
// ============================================================================

import { useEffect, useState } from 'react';
import { PlatformAuthProvider, usePlatformAuth } from '../auth';
import { isFirebaseConfigured } from '../firebase';
import { ClinicsTab } from './ClinicsTab';
import { ActivationsTab } from './ActivationsTab';
import { NewClinicTab } from './NewClinicTab';
import { PaymentSettingsTab } from './PaymentSettingsTab';

type Tab = 'clinics' | 'activations' | 'new' | 'payments';

const TABS: { id: Tab; label: string }[] = [
  { id: 'clinics', label: 'العيادات' },
  { id: 'activations', label: 'طلبات التفعيل' },
  { id: 'new', label: 'عيادة جديدة' },
  { id: 'payments', label: 'إعدادات الدفع' },
];

function OwnerShell() {
  const { user, profile, loading, signOutPlatform } = usePlatformAuth();
  const [tab, setTab] = useState<Tab>('clinics');

  useEffect(() => {
    document.title = 'لوحة صاحب المنصة';
  }, []);

  if (loading) {
    return (
      <div dir="rtl" className="mx-auto max-w-3xl p-6 text-center">
        جارٍ التحميل…
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div dir="rtl" className="mx-auto max-w-md p-6">
        <h1 className="mb-4 text-xl font-bold">لوحة صاحب المنصة</h1>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          سجّل الدخول بحساب صاحب المنصة للمتابعة.
        </p>
        <a
          href="/platform"
          className="inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white"
        >
          تسجيل الدخول
        </a>
      </div>
    );
  }

  if (profile.role !== 'owner') {
    return (
      <div dir="rtl" className="mx-auto max-w-md p-6 text-center">
        <h1 className="mb-2 text-xl font-bold">غير مصرّح</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          هذه اللوحة لصاحب المنصة فقط.
        </p>
        <button
          onClick={() => void signOutPlatform()}
          className="mt-4 rounded-xl border px-4 py-2 text-sm"
        >
          تسجيل الخروج
        </button>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between p-4">
          <h1 className="text-lg font-bold">لوحة صاحب المنصة</h1>
          <button
            onClick={() => void signOutPlatform()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700"
          >
            خروج
          </button>
        </div>
        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold ${
                tab === t.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl p-4">
        {tab === 'clinics' && <ClinicsTab ownerUid={profile.uid} />}
        {tab === 'activations' && <ActivationsTab ownerUid={profile.uid} />}
        {tab === 'new' && <NewClinicTab ownerUid={profile.uid} />}
        {tab === 'payments' && <PaymentSettingsTab />}
      </main>
    </div>
  );
}

export function OwnerApp() {
  if (!isFirebaseConfigured()) {
    return (
      <div dir="rtl" className="mx-auto max-w-md p-6 text-center">
        إعدادات Firebase غير موجودة.
      </div>
    );
  }
  return (
    <PlatformAuthProvider>
      <OwnerShell />
    </PlatformAuthProvider>
  );
}
