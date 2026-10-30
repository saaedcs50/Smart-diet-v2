import React, { useMemo } from 'react';
import { TrendingDown, Info } from 'lucide-react';
import { PlanConfig } from '../types';
import { getAllStoredDayLogs } from '../utils/storage';
import { buildTrajectory, collectWeightPoints } from '../utils/weightTrajectory';

interface WeightTrajectoryCardProps {
  plan: PlanConfig;
}

/**
 * Batch 2.2 — الوزن المتوقع مقابل الفعلي: منحنى SVG بنفس نمط LabChart
 * (خط فعلي + خط متوقع متقطع) مع شارة حالة بهامش ±0.5 كجم.
 * المسار استرشادي فقط — ليس وعدًا طبيًا.
 */
export const WeightTrajectoryCard: React.FC<WeightTrajectoryCardProps> = ({ plan }) => {
  // plan في الاعتماديات قصدًا: أي حفظ خطة/يوم جديد يعيد قراءة السجلات
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const logs = useMemo(() => getAllStoredDayLogs(), [plan]);
  const trajectory = useMemo(
    () => buildTrajectory(logs, plan.startWeight, plan.targetWeight),
    [logs, plan.startWeight, plan.targetWeight]
  );
  const pointsCount = useMemo(() => collectWeightPoints(logs).length, [logs]);

  if (!trajectory) {
    // رسالة إرشادية واحدة فقط عند وجود بيانات جزئية — وإلا لا شيء
    if (pointsCount === 0) return null;
    const missingInputs = !plan.startWeight || !plan.targetWeight;
    return (
      <div className="bg-[var(--app-card)] border border-peacock-pale dark:border-peacock-ink/40 rounded-3xl p-4 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-brand-secondary shrink-0 mt-0.5" />
        <p className="text-xs font-bold text-brand-secondary-text dark:text-peacock-teal-light leading-relaxed">
          {missingInputs
            ? 'حدد وزن البداية والهدف من الأخصائية'
            : 'سجّل 3 قياسات وزن على الأقل ليظهر منحنى «المتوقع مقابل الفعلي» هنا.'}
        </p>
      </div>
    );
  }

  const { actualPoints, expectedPoints, latestActual, expectedToday, statusLabel } = trajectory;

  // مقياس الرسم بنمط LabChart
  const allWeights = [...actualPoints, ...expectedPoints].map((p) => p.weight);
  const minVal = Math.min(...allWeights);
  const maxVal = Math.max(...allWeights);
  const range = maxVal - minVal || 1;
  const chartMin = minVal - range * 0.15;
  const chartMax = maxVal + range * 0.15;
  const fullRange = chartMax - chartMin || 1;

  const allDates = [...actualPoints, ...expectedPoints].map((p) => p.date).sort();
  const minDate = allDates[0];
  const maxDate = allDates[allDates.length - 1];
  const totalDays = Math.max(
    1,
    (new Date(maxDate).getTime() - new Date(minDate).getTime()) / 86400000
  );

  const width = 480;
  const height = 190;
  const paddingX = 40;
  const paddingTop = 25;
  const paddingBottom = 35;

  const getX = (date: string) => {
    const t = (new Date(date).getTime() - new Date(minDate).getTime()) / 86400000;
    return paddingX + (t / totalDays) * (width - paddingX * 2);
  };
  const getY = (val: number) => {
    const norm = (val - chartMin) / fullRange;
    return height - paddingBottom - norm * (height - paddingTop - paddingBottom);
  };

  const actualLine = actualPoints.map((p) => `${getX(p.date)},${getY(p.weight)}`).join(' ');
  const expectedLine = expectedPoints.map((p) => `${getX(p.date)},${getY(p.weight)}`).join(' ');

  const statusColor =
    trajectory.status === 'on-track'
      ? 'bg-peacock-pale dark:bg-peacock-ink-deep text-peacock-indigo-deep dark:text-peacock-teal-light border-peacock-sage dark:border-peacock-indigo-deep'
      : trajectory.status === 'faster'
        ? 'bg-peacock-pale dark:bg-peacock-ink-deep text-peacock-indigo-deep dark:text-peacock-teal-light border-peacock-sage dark:border-peacock-indigo-deep'
        : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';

  const formatDateLabel = (dateStr: string) => {
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;
  };

  return (
    <div className="bg-[var(--app-card)] border border-peacock-pale dark:border-peacock-ink/40 rounded-3xl p-5 transition-colors space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl text-brand-secondary dark:text-peacock-teal-light flex items-center justify-center font-bold text-sm">
            <TrendingDown className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-brand-text dark:text-peacock-pale text-sm">الوزن المتوقع مقابل الفعلي</h3>
            <span className="text-[12px] text-brand-secondary-text dark:text-peacock-teal-light/70">
              آخر قياس {latestActual.weight} كجم • المتوقع الآن {expectedToday} كجم
            </span>
          </div>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusColor}`}>{statusLabel}</span>
      </div>

      <div className="w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
          <line
            x1={paddingX - 10}
            y1={height - paddingBottom}
            x2={width - paddingX + 10}
            y2={height - paddingBottom}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-700/60"
            strokeWidth="1"
          />
          {/* المتوقع: خط متقطع */}
          <polyline
            points={expectedLine}
            fill="none"
            stroke="currentColor"
            className="text-slate-400 dark:text-slate-500"
            strokeWidth="2"
            strokeDasharray="6 5"
            strokeLinecap="round"
          />
          {/* الفعلي */}
          <polyline
            points={actualLine}
            fill="none"
            stroke="currentColor"
            className="text-peacock-blue"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {actualPoints.map((p, i) => (
            <g key={p.date}>
              <circle
                cx={getX(p.date)}
                cy={getY(p.weight)}
                r={i === actualPoints.length - 1 ? '6' : '4.5'}
                fill="#ffffff"
                stroke="currentColor"
                className="text-peacock-blue dark:fill-slate-900"
                strokeWidth="2.5"
              />
              <text
                x={getX(p.date)}
                y={getY(p.weight) - 9}
                textAnchor="middle"
                className="text-[12px] font-extrabold fill-slate-700 dark:fill-slate-300"
              >
                {p.weight}
              </text>
              <text
                x={getX(p.date)}
                y={height - paddingBottom + 16}
                textAnchor="middle"
                className="text-[9.5px] font-medium fill-slate-400 dark:fill-slate-500"
              >
                {formatDateLabel(p.date)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-0.5 bg-peacock-blue inline-block rounded" /> فعلي
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 border-t-2 border-dashed border-slate-400 inline-block" /> متوقع (معدل آمن)
        </span>
      </div>

      <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
        مسار استرشادي مبني على معدل آمن (0.5%–1% من الوزن أسبوعيًا) — ليس وعدًا طبيًا، والتقلبات اليومية طبيعية.
      </p>
    </div>
  );
};
