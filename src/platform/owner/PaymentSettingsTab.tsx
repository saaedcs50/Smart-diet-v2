// تبويب إعدادات الدفع: أرقام انستاباي وفودافون كاش.

import { useEffect, useState, type FormEvent } from 'react';
import { getPaymentMethods, savePaymentMethods } from '../owner';

export function PaymentSettingsTab() {
  const [instapayLabel, setInstapayLabel] = useState('انستاباي');
  const [instapayValue, setInstapayValue] = useState('');
  const [vcLabel, setVcLabel] = useState('فودافون كاش');
  const [vcValue, setVcValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const m = await getPaymentMethods();
        if (m) {
          setInstapayLabel(m.instapay.label || 'انستاباي');
          setInstapayValue(m.instapay.value || '');
          setVcLabel(m.vodafoneCash.label || 'فودافون كاش');
          setVcValue(m.vodafoneCash.value || '');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'تعذّر التحميل');
      }
    })();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setDone(false);
    setBusy(true);
    try {
      await savePaymentMethods({
        instapay: { label: instapayLabel.trim(), value: instapayValue.trim() },
        vodafoneCash: { label: vcLabel.trim(), value: vcValue.trim() },
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 className="font-bold">إعدادات الدفع اليدوي</h2>
      <p className="text-xs text-slate-500">
        هذه البيانات تظهر لأصحاب العيادات عند التجديد.
      </p>
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}
      {done && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
          تم الحفظ.
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        اسم وسيلة الدفع الأولى
        <input
          value={instapayLabel}
          onChange={(e) => setInstapayLabel(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        الرقم / العنوان
        <input
          value={instapayValue}
          onChange={(e) => setInstapayValue(e.target.value)}
          dir="ltr"
          className="rounded-lg border border-slate-300 px-3 py-2 text-left dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        اسم وسيلة الدفع الثانية
        <input
          value={vcLabel}
          onChange={(e) => setVcLabel(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        الرقم / العنوان
        <input
          value={vcValue}
          onChange={(e) => setVcValue(e.target.value)}
          dir="ltr"
          className="rounded-lg border border-slate-300 px-3 py-2 text-left dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? 'جارٍ الحفظ…' : 'حفظ'}
      </button>
    </form>
  );
}
