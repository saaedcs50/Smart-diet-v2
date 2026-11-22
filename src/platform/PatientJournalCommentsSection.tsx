import { useEffect, useState } from 'react';
import {
  createPatientJournalComment,
  type PatientJournalComment,
} from './patientJournalComments';

function formatCommentDate(value: string): string {
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function PatientJournalCommentsSection({
  patientUid,
  clinicId,
  logDate,
  comments,
  isStaffView,
}: {
  patientUid: string;
  clinicId: string;
  logDate: string;
  comments: PatientJournalComment[];
  isStaffView: boolean;
}) {
  const [items, setItems] = useState(comments);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    setItems(comments);
  }, [comments]);

  if (!isStaffView && items.length === 0) return null;

  const addComment = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const record = await createPatientJournalComment({
        clinicId,
        patientUid,
        logDate,
        content: draft,
      });
      setItems((current) => [...current, record].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      setDraft('');
      setExpanded(false);
      setSaved('تمت إضافة الملاحظة إلى سجل هذا اليوم.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر حفظ الملاحظة.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-3 rounded-xl border border-sky-100 bg-sky-50/60 p-3 dark:border-sky-900/60 dark:bg-sky-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">
          ملاحظات العيادة ({items.length})
        </h4>
        {isStaffView && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded-lg border border-sky-200 px-2.5 py-1.5 text-[11px] font-bold text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:text-sky-200 dark:hover:bg-sky-950/50"
          >
            {expanded ? 'إغلاق' : 'إضافة ملاحظة'}
          </button>
        )}
      </div>

      {items.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {items.map((comment) => (
            <li key={comment.id} className="rounded-lg bg-white/80 p-2.5 dark:bg-slate-900/70">
              <p className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-700 dark:text-slate-200">
                {comment.content}
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                ملاحظة من العيادة · {formatCommentDate(comment.created_at)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">لا توجد ملاحظات من العيادة لهذا اليوم.</p>
      )}

      {isStaffView && expanded && (
        <div className="mt-3 space-y-2">
          <label className="sr-only" htmlFor={`journal-comment-${patientUid}-${logDate}`}>ملاحظة للمتابعة</label>
          <textarea
            id={`journal-comment-${patientUid}-${logDate}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={1200}
            rows={3}
            placeholder="اكتب ملاحظة متابعة يراها المريض..."
            className="w-full resize-y rounded-lg border border-slate-200 bg-white p-2.5 text-xs leading-6 text-slate-800 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400">{draft.length}/1200</span>
            <button
              type="button"
              onClick={() => void addComment()}
              disabled={saving || !draft.trim()}
              className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'جارٍ الحفظ…' : 'حفظ الملاحظة'}
            </button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-xs font-bold text-rose-600">{error}</p>}
      {saved && <p role="status" className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">{saved}</p>}
    </section>
  );
}
