import { useState } from 'react';
import {
  normalizeEgyptianWhatsAppPhone,
} from './patientWhatsAppFollowUp';
import {
  savePatientWhatsAppContact,
  type PatientWhatsAppContact,
} from './patientWhatsAppContact';

export function PatientWhatsAppContactEditor({
  patientUid,
  phone,
  consentAt,
  onSaved,
}: {
  patientUid: string;
  phone: string | null | undefined;
  consentAt: string | null | undefined;
  onSaved: (contact: PatientWhatsAppContact) => void;
}) {
  const [value, setValue] = useState(phone ? `+${phone}` : '');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const normalized = normalizeEgyptianWhatsAppPhone(value);
  const hasSavedContact = Boolean(phone && consentAt);
  const showingSavedConsent = hasSavedContact && normalized === phone;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const contact = await savePatientWhatsAppContact({
        patientUid,
        phone: value,
        patientConsented: confirmed,
      });
      onSaved(contact);
      setValue(contact.whatsappPhone ? `+${contact.whatsappPhone}` : '');
      setConfirmed(false);
      setMessage(contact.whatsappPhone
        ? 'تم حفظ الرقم وتسجيل موافقة المريض.'
        : 'تم حذف رقم واتساب وموافقة التواصل.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر حفظ بيانات التواصل.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">التواصل عبر واتساب</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          يُستخدم الرقم لإعداد رسالة متابعة فقط. لن تُرسل الرسالة تلقائيًا؛ يراجعها الموظف ويرسلها من واتساب.
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="patient-whatsapp-phone">رقم واتساب المصري</label>
        <input
          id="patient-whatsapp-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="01012345678"
          maxLength={24}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-900 outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || (Boolean(value.trim()) && (!normalized || !confirmed)) || (!value.trim() && !hasSavedContact)}
          className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'جارٍ الحفظ…' : value.trim() ? 'حفظ رقم واتساب' : 'حذف الرقم وإلغاء الموافقة'}
        </button>
      </div>

      {value.trim() && !normalized && (
        <p className="mt-2 text-[11px] text-rose-600">أدخل رقمًا مصريًا صحيحًا يبدأ بـ 010 أو 011 أو 012 أو 015.</p>
      )}

      {value.trim() && (
        <label className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-1"
          />
          <span>أؤكد أن المريض وافق على تلقي رسائل متابعة من العيادة عبر واتساب، وأن الرقم يعود إليه أو إلى وسيلة التواصل التي اختارها.</span>
        </label>
      )}

      {showingSavedConsent && (
        <p className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-300">
          توجد موافقة مسجلة بتاريخ {new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(consentAt!))}.
        </p>
      )}

      {error && <p role="alert" className="mt-2 text-xs font-bold text-rose-600">{error}</p>}
      {message && <p role="status" className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">{message}</p>}

    </section>
  );
}
