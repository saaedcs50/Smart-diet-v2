// قسم الالتزام في صفحة المريض: الإعداد (دكتور) + إدخال الدرجات (دكتور)
// + السجل والرسم البياني (دكتور ومريض).

import { useEffect, useState, type FormEvent } from 'react';
import {
  addAdherenceScore,
  adherenceBand,
  BAND_COLORS,
  BAND_LABELS,
  calcOverall,
  DEFAULT_AXES,
  getAdherenceConfig,
  listAdherenceScores,
  saveAdherenceConfig,
  type AdherenceAxis,
  type AdherenceScore,
} from '../adherence';

function BandBadge({ overall }: { overall: number }) {
  const band = adherenceBand(overall);
  return (
    <span className={`font-black ${BAND_COLORS[band]}`}>
      {overall}% — {BAND_LABELS[band]}
    </span>
  );
}

function HistoryChart({
  scores,
}: {
  scores: Array<{ id: string; score: AdherenceScore }>;
}) {
  if (scores.length === 0) return null;
  const recent = [...scores].reverse().slice(-12);
  const max = 100;
  return (
    <div dir="rtl" className="mt-3">
      <p className="mb-2 text-xs font-bold text-slate-500">الالتزام عبر الزمن</p>
      <div className="flex h-24 items-end gap-1">
        {recent.map(({ id, score }) => {
          const band = adherenceBand(score.overall);
          const color =
            band === 'excellent'
              ? 'bg-emerald-500'
              : band === 'average'
                ? 'bg-amber-500'
                : 'bg-red-500';
          return (
            <div
              key={id}
              className="flex flex-1 flex-col items-center justify-end gap-1"
              title={`${score.date}: ${score.overall}%`}
            >
              <div
                className={`w-full rounded-t ${color}`}
                style={{ height: `${Math.max(4, (score.overall / max) * 96)}px` }}
              />
              <span className="text-[10px] text-slate-400">
                {score.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConfigEditor({
  patientUid,
  uid,
  initial,
  onSaved,
}: {
  patientUid: string;
  uid: string;
  initial: AdherenceAxis[];
  onSaved: (axes: AdherenceAxis[]) => void;
}) {
  const [axes, setAxes] = useState<AdherenceAxis[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await saveAdherenceConfig(patientUid, axes, uid);
      onSaved(axes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  }

  const sum = axes.reduce((s, a) => s + Number(a.weight || 0), 0);

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800"
    >
      <p className="text-sm font-bold">إعداد محاور الالتزام</p>
      {axes.map((axis, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={axis.name}
            onChange={(e) => {
              const next = [...axes];
              next[i] = { ...next[i], name: e.target.value };
              setAxes(next);
            }}
            placeholder={`المحور ${i + 1}`}
            className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <input
            value={axis.weight}
            onChange={(e) => {
              const next = [...axes];
              next[i] = { ...next[i], weight: Number(e.target.value) };
              setAxes(next);
            }}
            type="number"
            min="1"
            max="100"
            dir="ltr"
            className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
      ))}
      <p className={`text-xs ${sum === 100 ? 'text-emerald-600' : 'text-red-600'}`}>
        المجموع: {sum} / 100
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? 'جارٍ الحفظ…' : 'حفظ المحاور'}
      </button>
    </form>
  );
}

function ScoreForm({
  patientUid,
  uid,
  axes,
  onAdded,
}: {
  patientUid: string;
  uid: string;
  axes: AdherenceAxis[];
  onAdded: () => void;
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [scores, setScores] = useState<number[]>(axes.map(() => 0));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const preview = calcOverall(scores, axes);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await addAdherenceScore(
        patientUid,
        { date, scores, note, enteredBy: uid },
        axes,
      );
      onAdded();
      setScores(axes.map(() => 0));
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر الإضافة');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800"
    >
      <p className="text-sm font-bold">تسجيل التزام جديد</p>
      <label className="flex flex-col gap-1 text-xs">
        التاريخ
        <input
          value={date}
          onChange={(e) => setDate(e.target.value)}
          type="date"
          dir="ltr"
          className="rounded-lg border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      {axes.map((axis, i) => (
        <label key={i} className="flex items-center gap-2 text-sm">
          <span className="w-24 truncate">{axis.name}</span>
          <input
            value={scores[i]}
            onChange={(e) => {
              const next = [...scores];
              next[i] = Number(e.target.value);
              setScores(next);
            }}
            type="number"
            min="0"
            max="100"
            dir="ltr"
            className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
          />
          <span className="text-xs text-slate-500">وزن {axis.weight}%</span>
        </label>
      ))}
      <p className="text-sm">
        النسبة: <BandBadge overall={preview} />
      </p>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="ملاحظة (اختياري)"
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? 'جارٍ التسجيل…' : 'تسجيل الالتزام'}
      </button>
    </form>
  );
}

export function AdherenceSection({
  patientUid,
  uid,
  isStaffView,
}: {
  patientUid: string;
  uid: string;
  isStaffView: boolean;
}) {
  const [axes, setAxes] = useState<AdherenceAxis[] | null>(null);
  const [scores, setScores] = useState<Array<{ id: string; score: AdherenceScore }>>([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAdherenceConfig(patientUid), listAdherenceScores(patientUid)])
      .then(([config, list]) => {
        if (cancelled) return;
        setAxes(config?.axes ?? null);
        setScores(list);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientUid]);

  const reload = () => {
    setLoading(true);
    Promise.all([getAdherenceConfig(patientUid), listAdherenceScores(patientUid)])
      .then(([config, list]) => {
        setAxes(config?.axes ?? null);
        setScores(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  if (loading) return <p className="text-sm text-slate-500">جاري تحميل الالتزام…</p>;

  const latest = scores[0]?.score;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">الالتزام</h3>
        {isStaffView && (
          <button
            onClick={() => setShowConfig((v) => !v)}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold dark:bg-slate-800"
          >
            {showConfig ? 'إخفاء الإعداد' : 'إعداد المحاور'}
          </button>
        )}
      </div>

      {isStaffView && showConfig && (
        <ConfigEditor
          patientUid={patientUid}
          uid={uid}
          initial={axes ?? DEFAULT_AXES}
          onSaved={(a) => {
            setAxes(a);
            setShowConfig(false);
          }}
        />
      )}

      {!axes ? (
        <p className="text-sm text-slate-500">
          {isStaffView
            ? 'لم يضبط الدكتور محاور الالتزام بعد — ابدأ من "إعداد المحاور".'
            : 'لم يضبط الدكتور محاور الالتزام بعد.'}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
            {axes.map((a, i) => (
              <span
                key={i}
                className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800"
              >
                {a.name} ({a.weight}%)
              </span>
            ))}
          </div>

          {latest && (
            <p className="text-sm">
              آخر تقييم ({latest.date}): <BandBadge overall={latest.overall} />
            </p>
          )}

          <HistoryChart scores={scores} />

          {scores.length > 0 && (
            <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto text-xs text-slate-600 dark:text-slate-400">
              {scores.slice(0, 20).map(({ id, score }) => (
                <li key={id} className="flex justify-between gap-2">
                  <span>{score.date}</span>
                  <BandBadge overall={score.overall} />
                </li>
              ))}
            </ul>
          )}

          {isStaffView && (
            <ScoreForm
              patientUid={patientUid}
              uid={uid}
              axes={axes}
              onAdded={reload}
            />
          )}
        </>
      )}
    </div>
  );
}
