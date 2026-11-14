import { useEffect, useState } from 'react';
import {
  MAX_PATIENT_TAGS,
  MAX_PATIENT_TAG_LABEL_LENGTH,
  PATIENT_TAG_COLORS,
  normalizePatientTags,
  patientTagColorClass,
  type PatientTag,
  type PatientTagColor,
} from './patientTags';
import { savePatientTags } from './firestore';

const COLOR_LABELS: Record<PatientTagColor, string> = {
  slate: 'رمادي',
  blue: 'أزرق',
  green: 'أخضر',
  amber: 'برتقالي',
  rose: 'وردي',
  violet: 'بنفسجي',
  teal: 'فيروزي',
};

export function PatientTagsEditor({
  patientUid,
  tags,
  onSaved,
}: {
  patientUid: string;
  tags?: PatientTag[];
  onSaved: (patientUid: string, tags: PatientTag[]) => void;
}) {
  const [draft, setDraft] = useState<PatientTag[]>(() => normalizePatientTags(tags));
  const [label, setLabel] = useState('');
  const [color, setColor] = useState<PatientTagColor>('blue');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setDraft(normalizePatientTags(tags));
  }, [tags]);

  const currentTags = normalizePatientTags(tags);
  const dirty = JSON.stringify(draft) !== JSON.stringify(currentTags);

  function addTag() {
    const cleanLabel = label.trim().replace(/\s+/g, ' ').slice(0, MAX_PATIENT_TAG_LABEL_LENGTH);
    if (!cleanLabel) return;
    if (draft.length >= MAX_PATIENT_TAGS) {
      setError(`الحد الأقصى ${MAX_PATIENT_TAGS} وسمًا للمريض الواحد.`);
      return;
    }
    if (draft.some((tag) => tag.label.localeCompare(cleanLabel, 'ar', { sensitivity: 'base' }) === 0)) {
      setError('هذا الوسم موجود بالفعل لهذا المريض.');
      return;
    }
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    setDraft((current) => [...current, { id, label: cleanLabel, color }]);
    setLabel('');
    setError(null);
    setNotice(null);
  }

  async function persist() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const normalized = normalizePatientTags(draft);
      await savePatientTags(patientUid, normalized);
      onSaved(patientUid, normalized);
      setOpen(false);
      setNotice('تم حفظ الوسوم.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر حفظ الوسوم.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2" onClick={(event) => event.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-1.5">
        {draft.map((tag) => (
          <span
            key={tag.id}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${patientTagColorClass(tag.color)}`}
          >
            {tag.label}
            {open && (
              <button
                type="button"
                aria-label={`إزالة وسم ${tag.label}`}
                className="font-black opacity-70 hover:opacity-100"
                onClick={() => setDraft((current) => current.filter((item) => item.id !== tag.id))}
              >
                ×
              </button>
            )}
          </span>
        ))}
        <button
          type="button"
          className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={() => { setOpen((value) => !value); setError(null); }}
        >
          {open ? 'إغلاق الوسوم' : '+ إدارة الوسوم'}
        </button>
      </div>

      {open && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={label}
              maxLength={MAX_PATIENT_TAG_LABEL_LENGTH}
              onChange={(event) => setLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addTag();
                }
              }}
              placeholder="اسم الوسم، مثل: متابعة أسبوعية"
              aria-label="اسم الوسم الجديد"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />
            <select
              value={color}
              onChange={(event) => setColor(event.target.value as PatientTagColor)}
              aria-label="لون الوسم"
              className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            >
              {PATIENT_TAG_COLORS.map((item) => (
                <option key={item} value={item}>{COLOR_LABELS[item]}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={addTag}
              disabled={!label.trim() || draft.length >= MAX_PATIENT_TAGS}
              className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-40 dark:bg-slate-200 dark:text-slate-900"
            >
              إضافة
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-500">{draft.length}/{MAX_PATIENT_TAGS} وسوم</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setDraft(currentTags); setOpen(false); setError(null); }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold dark:border-slate-600"
                disabled={saving}
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={persist}
                disabled={!dirty || saving}
                className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
              >
                {saving ? 'جارٍ الحفظ…' : 'حفظ الوسوم'}
              </button>
            </div>
          </div>
          {error && <p role="alert" className="mt-2 text-xs font-bold text-red-600">{error}</p>}
        </div>
      )}
      {notice && <p role="status" className="mt-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">{notice}</p>}
    </div>
  );
}
