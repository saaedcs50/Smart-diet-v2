// نموذج التجديد: تعليمات الدفع + إدخال رقم العملية.

import { useEffect, useState, type FormEvent } from 'react';
import {
  getPaymentMethods,
  submitActivationRequest,
  type PlatformPaymentMethods,
} from '../subscription';

const METHOD_LABELS = {
  instapay: 'انستاباي',
  vodafone_cash: 'فودافون كاش',
} as const;

type Method = keyof typeof METHOD_LABELS;

export function RenewalForm({
  clinicId,
  uid,
  onSubmitted,
}: {
  clinicId: string;
  uid: string;
  onSubmitted: () => void;
}) {
  const [methods, setMethods] = useState<PlatformPaymentMethods | null>(null);
  const [method, setMethod] = useState<Method>('instapay');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    void getPaymentMethods()
      .then(setMethods)
      .catch(() => {});
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await submitActivationRequest(clinicId, {
        method,
        amount: Number(amount),
        reference,
        note,
        submittedBy: uid,
      });
      setDone(true);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر الإرسال');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-emerald-50 p-4 text-center dark:bg-emerald-900/20">
        <p className="font-bold text-emerald-700 dark:text-emerald-300">
          تم إرسال طلب التفعيل
        </p>
        <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
          سنراجع رقم العملية ونفعّل اشتراكك — أرسل صورة الإيصال واتساب لتسريع
          المراجعة.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <h3 className="font-bold">طلب تجديد الاشتراك</h3>

      {methods && (
        <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
          <p className="mb-2 font-bold">حوّل الاشتراك إلى:</p>
          <p>
            {methods.instapay.label}:{' '}
            <span className="font-mono font-bold" dir="ltr">
              {methods.instapay.value || '—'}
            </span>
          </p>
          <p className="mt-1">
            {methods.vodafoneCash.label}:{' '}
            <span className="font-mono font-bold" dir="ltr">
              {methods.vodafoneCash.value || '—'}
            </span>
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        طريقة الدفع
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as Method)}
          className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        >
          {(Object.keys(METHOD_LABELS) as Method[]).map((m) => (
            <option key={m} value={m}>
              {METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        المبلغ (جنيه)
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          min="1"
          dir="ltr"
          className="rounded-lg border border-slate-300 px-3 py-2 text-left dark:border-slate-700 dark:bg-slate-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        رقم العملية
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          dir="ltr"
          placeholder="رقم التحويل من التطبيق"
          className="rounded-lg border border-slate-300 px-3 py-2 text-left font-mono dark:border-slate-700 dark:bg-slate-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        ملاحظة (اختياري)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>

      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? 'جارٍ الإرسال…' : 'إرسال طلب التفعيل'}
      </button>
    </form>
  );
}
