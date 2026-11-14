import { useMemo, useState } from 'react';
import type { DayLog, PlanConfig } from '../types';
import { summarizePatientDayLog } from './patientDashboardMetrics';

type DayEntry = { date: string; log: DayLog };
type ChartPoint = { date: string; value: number };

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function ProgressLineChart({
  title,
  points,
  unit,
  target,
  targetLabel,
}: {
  title: string;
  points: ChartPoint[];
  unit: string;
  target?: number | null;
  targetLabel?: string;
}) {
  if (points.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <h4 className="text-sm font-bold">{title}</h4>
        <p className="mt-2 text-xs text-slate-500">لا توجد قياسات كافية لرسم المسار بعد.</p>
      </section>
    );
  }

  const width = 640;
  const height = 190;
  const left = 32;
  const right = 608;
  const top = 26;
  const bottom = 148;
  const values = points.map((point) => point.value);
  const domainValues = target != null && Number.isFinite(target) && target > 0
    ? [...values, target]
    : values;
  const rawMin = Math.min(...domainValues);
  const rawMax = Math.max(...domainValues);
  const rawRange = rawMax - rawMin;
  const padding = rawRange > 0 ? rawRange * 0.18 : Math.max(Math.abs(rawMax) * 0.12, 1);
  const min = Math.max(0, rawMin - padding);
  const max = rawMax + padding || 1;
  const x = (index: number) => points.length === 1
    ? (left + right) / 2
    : left + (index / (points.length - 1)) * (right - left);
  const y = (value: number) => bottom - ((value - min) / (max - min || 1)) * (bottom - top);
  const polyline = points.map((point, index) => `${x(index)},${y(point.value)}`).join(' ');
  const targetVisible = target != null && Number.isFinite(target) && target > 0;
  const latest = points[points.length - 1];

  return (
    <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold">{title}</h4>
        <span className="text-xs font-black tabular-nums" dir="ltr">
          {latest.value.toLocaleString('en-US', { maximumFractionDigits: 1 })} {unit}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title}: ${points.length} سجلات، آخر قيمة ${latest.value} ${unit}`}
        className="mt-2 h-40 w-full overflow-visible text-indigo-600 dark:text-indigo-300"
      >
        <line x1={left} y1={top} x2={right} y2={top} stroke="currentColor" opacity="0.10" />
        <line x1={left} y1={(top + bottom) / 2} x2={right} y2={(top + bottom) / 2} stroke="currentColor" opacity="0.10" />
        <line x1={left} y1={bottom} x2={right} y2={bottom} stroke="currentColor" opacity="0.20" />
        {targetVisible && (
          <>
            <line
              x1={left}
              y1={y(target)}
              x2={right}
              y2={y(target)}
              stroke="#d97706"
              strokeWidth="2"
              strokeDasharray="6 5"
            />
            <text x={right} y={Math.max(12, y(target) - 7)} textAnchor="end" fill="#d97706" fontSize="11">
              {targetLabel ?? 'الهدف'}: {target}
            </text>
          </>
        )}
        <polyline
          points={polyline}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => (
          <circle
            key={point.date}
            cx={x(index)}
            cy={y(point.value)}
            r={index === points.length - 1 ? 5 : 3}
            fill="currentColor"
          >
            <title>{point.date}: {point.value} {unit}</title>
          </circle>
        ))}
        <text x={left} y={176} textAnchor="start" fill="currentColor" opacity="0.65" fontSize="11">
          {points[0].date.slice(5)}
        </text>
        <text x={right} y={176} textAnchor="end" fill="currentColor" opacity="0.65" fontSize="11">
          {latest.date.slice(5)}
        </text>
      </svg>
      <p className="text-[11px] text-slate-500">
        {points.length} يومًا مسجلًا — الخط المتقطع يوضح الهدف المحدد في الخطة، وليس حدًا طبيًا.
      </p>
    </section>
  );
}

export function PatientProgressCharts({
  entries,
  plan,
}: {
  entries: DayEntry[];
  plan: PlanConfig | null;
}) {
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);
  const ordered = useMemo(
    () => [...entries]
      .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.date))
      .sort((a, b) => a.date.localeCompare(b.date)),
    [entries],
  );

  const recentRange = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - (rangeDays - 1));
    const cutoff = localDateKey(start);
    const today = localDateKey(new Date());
    return ordered.filter((entry) => entry.date >= cutoff && entry.date <= today);
  }, [ordered, rangeDays]);

  const weightPoints = ordered
    .filter((entry) => typeof entry.log.weight === 'number' && Number.isFinite(entry.log.weight) && entry.log.weight > 0)
    .slice(-30)
    .map((entry) => ({ date: entry.date, value: Number(entry.log.weight) }));

  const waterPoints = ordered
    .filter((entry) => typeof entry.log.water === 'number' && Number.isFinite(entry.log.water))
    .slice(-30)
    .map((entry) => ({ date: entry.date, value: Number(entry.log.water) }));

  const completion = recentRange.map(({ date, log }) => {
    const summary = summarizePatientDayLog(log, plan);
    return {
      date,
      meals: summary.plannedMeals && summary.plannedMeals > 0
        ? Math.round((summary.recordedMeals / summary.plannedMeals) * 100)
        : null,
      tasks: summary.plannedTasks && summary.plannedTasks > 0
        ? Math.round((summary.completedTasks / summary.plannedTasks) * 100)
        : null,
    };
  });
  const mealAverage = average(completion.flatMap((item) => item.meals == null ? [] : [Math.min(100, item.meals)]));
  const taskAverage = average(completion.flatMap((item) => item.tasks == null ? [] : [Math.min(100, item.tasks)]));

  if (ordered.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-slate-100">مسار التقدم</h3>
          <p className="mt-1 text-xs text-slate-500">رسوم من السجلات اليومية المحفوظة. لا تستبدل التقييم السريري.</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-slate-200 p-1 dark:border-slate-700" aria-label="فترة ملخص الالتزام">
          {([7, 30] as const).map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={rangeDays === days}
              onClick={() => setRangeDays(days)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${rangeDays === days ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
            >
              {days} يوم
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ProgressLineChart
          title="تغير الوزن عبر الزمن"
          points={weightPoints}
          unit="كجم"
          target={plan?.targetWeight ?? null}
          targetLabel="الوزن المستهدف"
        />
        <ProgressLineChart
          title="شرب الماء مقابل الهدف اليومي"
          points={waterPoints}
          unit="مل"
          target={plan?.dailyWaterGoalMl ?? null}
          targetLabel="هدف الماء"
        />
      </div>

      <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-bold">إكمال الوجبات وبنود المتابعة — آخر {rangeDays} يومًا</h4>
          <span className="text-[11px] text-slate-500">{recentRange.length} أيام بها سجل</span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span>متوسط إكمال الوجبات</span>
              <strong className="tabular-nums">{mealAverage == null ? '—' : `${mealAverage}%`}</strong>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-indigo-600" style={{ width: `${mealAverage ?? 0}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs">
              <span>متوسط إكمال بنود المتابعة</span>
              <strong className="tabular-nums">{taskAverage == null ? '—' : `${taskAverage}%`}</strong>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${taskAverage ?? 0}%` }} />
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-slate-500">
          هذه نسب إكمال حسابية من الأيام التي لها خطة قابلة للمقارنة فقط؛ لا تمثل درجة الالتزام التي يسجلها الطبيب.
        </p>
      </section>
    </div>
  );
}
