// تبويب عيادة جديدة: إنشاء العيادة ودعوة صاحبها.

import { useState, type FormEvent } from 'react';
import { createClinicWithOwner } from '../owner';

export function NewClinicTab({ ownerUid }: { ownerUid: string }) {
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setDone('');
    if (!name.trim() || !ownerName.trim() || !ownerEmail.trim()) {
      setError('اسم العيادة واسم المالك والبريد حقول مطلوبة');
      return;
    }
    setBusy(true);
    try {
      const id = await createClinicWithOwner({
        name,
        ownerName,
        ownerEmail,
        ownerPhone,
        createdBy: ownerUid,
      });
      setDone(`تم إنشاء العيادة ودعوة المالك (${id}). أخبره بالتسجيل من /platform بالبريد المدعو به.`);
      setName('');
      setOwnerName('');
      setOwnerEmail('');
      setOwnerPhone('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر الإنشاء');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 className="font-bold">عيادة جديدة</h2>
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}
      {done && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
          {done}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        اسم العيادة
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        اسم صاحب العيادة
        <input
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        بريد صاحب العيادة (للدعوة)
        <input
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          type="email"
          dir="ltr"
          className="rounded-lg border border-slate-300 px-3 py-2 text-left dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        هاتف صاحب العيادة
        <input
          value={ownerPhone}
          onChange={(e) => setOwnerPhone(e.target.value)}
          dir="ltr"
          className="rounded-lg border border-slate-300 px-3 py-2 text-left dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? 'جارٍ الإنشاء…' : 'إنشاء العيادة وإرسال الدعوة'}
      </button>
      <p className="text-xs text-slate-500">
        العيادة تُنشأ باشتراك منتهي — تُفعَّل بعد دفع المالك ومراجعة طلبه من
        تبويب «طلبات التفعيل».
      </p>
    </form>
  );
}
