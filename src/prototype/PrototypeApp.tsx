import React, { useMemo, useState } from 'react';
import { ArrowRight, BellRing, TrendingDown, Target, Award, Users, FlaskConical } from 'lucide-react';
import { QuickActionBar } from '../components/QuickActionBar';
import type { DayLog, PlanConfig } from '../types';
import {
  ABSENCE_THRESHOLD_DAYS,
  DEMO_PATIENTS,
  DEMO_PATIENT_DETAILS,
  getAbsentPatients,
  type DemoPatientDetail,
} from './prototypeData';

// ============================================================================
// النموذج الثابت للمنصة (/prototype) — شاشات عرض ببيانات وهمية فقط.
// لا يقرأ localStorage ولا يرسل أي بريد ولا يغيّر سلوك العيادة الواحدة.
// ملاحظة تصميمية صريحة: QuickActionBar مُعاد استخدامه كما هو (يعمل على
// props فقط). أما WeeklyFocusCard وWeightTrajectoryCard وMilestonesSection
// فتقرأ سجلات localStorage الحقيقية، فلا يجوز تركيبها في عرض تجريبي؛
// لذلك رُسمت هنا مكافئاتها البصرية بنفس لغة البطاقات، ببيانات وهمية.
// ============================================================================

function buildDemoPlan(detail: DemoPatientDetail): PlanConfig {
  return {
    clientName: detail.summary.alias,
    dailyWaterGoalMl: 2000,
    heightCm: 170,
    startWeight: detail.startWeight,
    targetWeight: detail.targetWeight,
    targetWaist: null,
    freezeDaysPerMonth: 2,
    adminPin: '',
    scoreWeights: { checklist: 25, water: 25, sleep: 25, meals: 25 },
    meals: detail.planMeals.map((name, i) => ({
      id: `demo-meal-${i}`,
      name,
      items: name,
      alternatives: [],
    })),
    checklist: [{ id: 'demo-check-1', label: 'تسجيل الوجبات' }],
    supplements: [],
    tips: [],
    symptomsList: [],
  };
}

function buildDemoDay(weight: number): DayLog {
  return {
    water: 1000,
    waterLogs: 4,
    sleep: '23:00',
    wake: '07:00',
    quality: 'جيد',
    meals: {},
    checks: {},
    supps: {},
    notes: '',
    weight,
    meas: { waist: null, chest: null, hips: null, arm: null, thigh: null, neck: null },
    symptoms: {},
    symNotes: '',
    mood: 4,
    exercise: 20,
    isFreeze: false,
  };
}

function WeightChart({ detail }: { detail: DemoPatientDetail }) {
  const points = detail.weightPoints;
  const weights = points.map((p) => p.weight);
  const min = Math.min(...weights, detail.targetWeight) - 1;
  const max = Math.max(...weights, detail.startWeight) + 1;
  const w = 320;
  const h = 140;
  const pad = 12;
  const x = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (h - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.weight)}`).join(' ');
  return (
    <div className="bg-[var(--app-card)] border border-purple-100 dark:border-purple-900/40 rounded-3xl p-4 space-y-2">
      <div className="flex items-center gap-2 font-bold text-sm">
        <TrendingDown className="w-4 h-4 text-brand-hero" />
        <span>الوزن المتوقع مقابل الفعلي (عرض تجريبي)</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" dir="ltr" role="img" aria-label="منحنى وزن تجريبي">
        <line x1={pad} x2={w - pad} y1={y(detail.targetWeight)} y2={y(detail.targetWeight)} stroke="#c4b5fd" strokeDasharray="5 5" />
        {points.map((p, i) => (
          <g key={p.date}>
            <circle cx={x(i)} cy={y(p.weight)} r="4" fill="#7c3aed" />
            <text x={x(i)} y={h - 2} fontSize="9" textAnchor="middle" fill="#64748b">{p.date}</text>
          </g>
        ))}
        <path d={path} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <p className="text-xs text-slate-500">البداية {detail.startWeight} كجم — الهدف {detail.targetWeight} كجم — الخط المتقطع هو الهدف.</p>
    </div>
  );
}

function PatientPage({ detail, onBack }: { detail: DemoPatientDetail; onBack: () => void }) {
  const plan = useMemo(() => buildDemoPlan(detail), [detail]);
  const [day, setDay] = useState<DayLog>(() => buildDemoDay(detail.summary.weightKg));
  return (
    <div className="space-y-4 pb-32">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-bold text-brand-hero cursor-pointer"
      >
        <ArrowRight className="w-4 h-4" /> عودة لقائمة المرضى
      </button>
      <div className="bg-white/90 dark:bg-slate-900/90 border border-violet-200/80 dark:border-violet-800/60 rounded-3xl p-4 space-y-1">
        <h2 className="text-lg font-black">{detail.summary.alias}</h2>
        <p className="text-xs text-slate-500">هدف الخطة: {detail.summary.goalLabel} — آخر نشاط: {detail.summary.lastActivityLabel}</p>
        <p className="text-xs text-slate-500">الوزن الحالي (تجريبي): {detail.summary.weightKg} كجم</p>
      </div>

      <div className="bg-white/90 dark:bg-slate-900/90 border border-violet-200/80 dark:border-violet-800/60 rounded-3xl p-4 space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Target className="w-4 h-4 text-violet-600" /> هدف الأسبوع (تجريبي)
        </div>
        <p className="text-sm">{detail.focusLabel}</p>
        <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${detail.focusProgressPct}%` }} />
        </div>
        <p className="text-xs text-slate-500">{detail.focusProgressPct}% مكتمل هذا الأسبوع</p>
      </div>

      <WeightChart detail={detail} />

      <div className="bg-[var(--app-card)] border border-purple-100 dark:border-purple-900/40 rounded-3xl p-4 space-y-2.5">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Award className="w-4 h-4 text-amber-500" /> إنجازاتي (تجريبية)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {detail.milestonesUnlocked.map((m) => (
            <span key={m} className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">{m}</span>
          ))}
        </div>
        <p className="text-xs text-slate-500">المعلم التالي: {detail.milestonesNext}</p>
      </div>

      <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-700/60 rounded-3xl p-4 space-y-1.5">
        <p className="font-bold text-sm">وجبات اليوم (تجريبية)</p>
        {detail.planMeals.map((m) => (
          <p key={m} className="text-xs text-slate-600 dark:text-slate-300">• {m}</p>
        ))}
      </div>

      {/* شريط الإجراءات الأصلي — يعمل على بيانات اليوم الوهمية المحلية فقط، بلا حفظ. */}
      <QuickActionBar plan={plan} day={day} onUpdateDay={setDay} />
    </div>
  );
}

export const PrototypeApp: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const absent = useMemo(() => getAbsentPatients(DEMO_PATIENTS), []);
  const selected = selectedId ? DEMO_PATIENT_DETAILS[selectedId] : null;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2 rounded-3xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 px-4 py-3">
          <FlaskConical className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-xs sm:text-sm font-black text-amber-800 dark:text-amber-200">
            نموذج تجريبي — كل البيانات المعروضة هنا وهمية، ولا تُرسل أو تُحفظ في أي مكان.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-brand-hero" />
          <h1 className="text-xl font-black">لوحة الأخصائية — نموذج المنصة</h1>
        </div>
        <p className="text-xs text-slate-500">منصة التغذية والصحة — عرض تجريبي متعدد المرضى (بانتظار البناء الحقيقي على Firebase).</p>

        {selected ? (
          <PatientPage detail={selected} onBack={() => setSelectedId(null)} />
        ) : (
          <>
            {absent.length > 0 && (
              <div className="rounded-3xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800/60 p-4 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-red-700 dark:text-red-300">
                  <BellRing className="w-4 h-4" /> تنبيه غياب ({absent.length})
                </div>
                {absent.map((p) => (
                  <p key={p.id} className="text-xs text-red-700 dark:text-red-300">
                    {p.alias} غائب منذ {p.daysAbsent} أيام (آخر نشاط: {p.lastActivityLabel}).
                  </p>
                ))}
                <p className="text-[11px] text-slate-500">عرض فقط — لا يتم إرسال أي بريد حقيقي في هذا النموذج.</p>
              </div>
            )}

            <div className="space-y-3">
              {DEMO_PATIENTS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className="w-full text-right bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-700/60 rounded-3xl p-4 space-y-1.5 cursor-pointer hover:border-violet-300 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-sm">{p.alias}</span>
                    <span className="text-xs font-black text-brand-hero">{p.todayAdherencePct}% التزام اليوم</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    الوزن: {p.weightKg} كجم — آخر نشاط: {p.lastActivityLabel} — أيام الغياب: {p.daysAbsent} (حد التنبيه: {ABSENCE_THRESHOLD_DAYS} أيام) — الهدف: {p.goalLabel}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
