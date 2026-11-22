import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { PatientReflectionDraft } from './patientReflectionUtils';
import {
  createPatientReflection,
  deletePatientReflection,
  listPatientReflections,
  type PatientReflectionRecord,
} from './patientReflections';

function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatReflectionDate(value: string): string {
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
  }).format(new Date(`${value}T00:00:00`));
}

const moodLabels: Record<number, string> = {
  1: 'صعب جدًا',
  2: 'صعب',
  3: 'متوسط',
  4: 'جيد',
  5: 'جيد جدًا',
};

export function PatientReflectionsSection({
  patientUid,
  clinicId,
  isStaffView,
}: {
  patientUid: string;
  clinicId: string;
  isStaffView: boolean;
}) {
  const [records, setRecords] = useState<PatientReflectionRecord[]>([]);
  const [entryDate, setEntryDate] = useState(localDateKey);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'shared'>('private');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listPatientReflections(patientUid, isStaffView)
      .then((rows) => {
        if (!active) return;
        setRecords(rows);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'تعذّر تحميل اليوميات.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [patientUid, isStaffView]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    const draft: PatientReflectionDraft = {
      entryDate,
      content,
      mood: mood ? Number(mood) : null,
      symptoms,
      visibility,
    };
    try {
      const record = await createPatientReflection({
        clinicId,
        patientUid,
        draft,
      });
      setRecords((current) => [record, ...current].sort((a, b) =>
        b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at),
      ));
      setContent('');
      setMood('');
      setSymptoms('');
      setVisibility('private');
      setEntryDate(localDateKey());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر حفظ اليوميات.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (record: PatientReflectionRecord) => {
    if (deletingId) return;
    setDeletingId(record.id);
    setError(null);
    try {
      await deletePatientReflection({ patientUid, reflectionId: record.id });
      setRecords((current) => current.filter((item) => item.id !== record.id));
      setConfirmDeleteId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر حذف اليوميات.');
    } finally {
      setDeletingId(null);
    }
  };

  const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
          {isStaffView ? 'اليوميات التي شاركها المريض' : 'يومياتي بين الزيارات'}
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {isStaffView
            ? 'لا تظهر هنا إلا الإدخالات التي اختار المريض مشاركتها مع العيادة.'
            : 'يمكنك تدوين حالتك أو ملاحظاتك بين الزيارات. الخاص لا يراه فريق العيادة، والمشترك يظهر لمقدم الرعاية المعيّن.'}
        </p>
      </div>

      {!isStaffView && (
        <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300" htmlFor="patient-reflection-date">التاريخ</label>
              <input id="patient-reflection-date" type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300" htmlFor="patient-reflection-mood">المزاج حسب تقييمك (اختياري)</label>
              <select id="patient-reflection-mood" value={mood} onChange={(event) => setMood(event.target.value)} className={inputClass}>
                <option value="">بدون تقييم</option>
                {Object.entries(moodLabels).map(([value, label]) => (
                  <option key={value} value={value}>{value} — {label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300" htmlFor="patient-reflection-content">ملاحظاتك وتأملاتك</label>
            <textarea id="patient-reflection-content" value={content} onChange={(event) => setContent(event.target.value)} maxLength={2000} rows={3} className={inputClass} placeholder="ما الذي ترغب في تذكره أو مناقشته في الزيارة القادمة؟" />
            <p className="mt-1 text-[10px] text-slate-400">{content.length}/2000</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300" htmlFor="patient-reflection-symptoms">أعراض أو ملاحظات جسدية (اختياري)</label>
            <textarea id="patient-reflection-symptoms" value={symptoms} onChange={(event) => setSymptoms(event.target.value)} maxLength={1000} rows={2} className={inputClass} placeholder="دوّن ما تلاحظه دون الحاجة لتفسيره أو تشخيصه." />
            <p className="mt-1 text-[10px] text-slate-400">{symptoms.length}/1000</p>
          </div>

          <fieldset className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <legend className="px-1 text-xs font-bold text-slate-700 dark:text-slate-300">خصوصية الإدخال</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-xs ${visibility === 'private' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
                <input type="radio" name="reflection-visibility" checked={visibility === 'private'} onChange={() => setVisibility('private')} />
                <span><strong className="block">خاص بي</strong><span className="mt-1 block text-[11px] text-slate-500">لا يراه إلا أنت.</span></span>
              </label>
              <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-xs ${visibility === 'shared' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
                <input type="radio" name="reflection-visibility" checked={visibility === 'shared'} onChange={() => setVisibility('shared')} />
                <span><strong className="block">مشاركة مع العيادة</strong><span className="mt-1 block text-[11px] text-slate-500">يراها الطبيب المعيّن وفريق العيادة المخوّل.</span></span>
              </label>
            </div>
          </fieldset>

          <button type="submit" disabled={saving || (!content.trim() && !symptoms.trim() && !mood)} className="rounded-xl bg-sky-700 px-4 py-2.5 text-xs font-black text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'جارٍ الحفظ…' : 'حفظ اليوميات'}
          </button>
        </form>
      )}

      {error && <p role="alert" className="mt-3 text-xs font-bold text-rose-600">{error}</p>}

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-slate-500">جارٍ تحميل اليوميات…</p>
        ) : records.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700">
            {isStaffView ? 'لم يشارك المريض يوميات مع العيادة بعد.' : 'لم تضف يوميات بعد.'}
          </div>
        ) : (
          <ul className="space-y-2">
            {records.map((record) => (
              <li key={record.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{formatReflectionDate(record.entry_date)}</span>
                  <div className="flex items-center gap-2">
                    {!isStaffView && (
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${record.visibility === 'shared' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200' : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200'}`}>
                        {record.visibility === 'shared' ? 'مشارك' : 'خاص'}
                      </span>
                    )}
                    {record.mood != null && (
                      <span className="text-[11px] text-slate-500">المزاج: {record.mood}/5</span>
                    )}
                  </div>
                </div>
                {record.content && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-200">{record.content}</p>}
                {record.symptoms && <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600 dark:text-slate-300"><strong>أعراض/ملاحظات جسدية:</strong> {record.symptoms}</p>}

                {!isStaffView && confirmDeleteId === record.id ? (
                  <div className="mt-3 flex items-center gap-2">
                    <button type="button" onClick={() => void remove(record)} disabled={deletingId === record.id} className="rounded-lg bg-rose-700 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">
                      {deletingId === record.id ? 'جارٍ الحذف…' : 'تأكيد الحذف'}
                    </button>
                    <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">إلغاء</button>
                  </div>
                ) : !isStaffView ? (
                  <button type="button" onClick={() => setConfirmDeleteId(record.id)} className="mt-3 text-[11px] font-bold text-rose-700 underline dark:text-rose-300">
                    حذف إدخالي
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
