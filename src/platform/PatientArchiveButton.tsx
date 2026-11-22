import { useState } from 'react';
import { setPatientArchiveStatus } from './patientArchive';

export function PatientArchiveButton({
  patientUid,
  clinicId,
  patientName,
  archivedAt,
  onSaved,
}: {
  patientUid: string;
  clinicId: string;
  patientName: string;
  archivedAt: string | null | undefined;
  onSaved: (patientUid: string, status: { archivedAt: string | null; archivedBy: string | null }) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const archived = Boolean(archivedAt);

  const toggle = async () => {
    if (saving) return;
    if (!archived && !window.confirm(
      `أرشفة ملف «${patientName}»؟ سيختفي من القوائم النشطة، لكن الخطة والسجلات والمواعيد ستظل محفوظة ويمكن استعادته لاحقًا.`,
    )) return;

    setSaving(true);
    setError(null);
    try {
      const status = await setPatientArchiveStatus({
        patientUid,
        clinicId,
        archived: !archived,
      });
      onSaved(patientUid, status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر تحديث حالة الملف.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={saving}
        className={`shrink-0 rounded-xl border px-2.5 py-2 text-[10px] font-bold disabled:opacity-50 ${archived
          ? 'border-emerald-200 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/40'
          : 'border-amber-200 text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/40'}`}
      >
        {saving ? 'جارٍ الحفظ…' : archived ? 'استعادة' : 'أرشفة'}
      </button>
      {error && <p role="alert" className="max-w-40 text-[10px] text-rose-600">{error}</p>}
    </div>
  );
}
