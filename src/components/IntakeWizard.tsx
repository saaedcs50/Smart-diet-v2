import React, { useMemo, useState } from 'react';
import { X, ChevronRight, ChevronLeft, ClipboardList, Save } from 'lucide-react';
import { PlanConfig } from '../types';
import { MedicalConditionsEditor } from './MedicalConditionsEditor';
import { IntakeAnswers, buildIntakeDraftPlan, saveIntakeDraft } from '../utils/intake';

interface IntakeWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /** الخطة الحالية كقالب أساسي (وجبات/بنود افتراضية) — لا تُعدَّل أبدًا */
  plan: PlanConfig;
  onNotify: (msg: string) => void;
}

const STEP_TITLES = ['بيانات أساسية وقياسات', 'الحالات الطبية', 'الأدوية والحساسية', 'النوم والنشاط والصيام', 'الهدف والملاحظات'];

/**
 * Batch 2.5 — استبيان العميل الجديد: 5 خطوات تنتهي بمسودة خطة محفوظة في
 * مفتاح مستقل. لا يلمس الخطة النشطة بأي شكل — الاعتماد قرار الأخصائية
 * من لوحتها بعد المراجعة.
 */
export const IntakeWizard: React.FC<IntakeWizardProps> = ({ isOpen, onClose, plan, onNotify }) => {
  const [step, setStep] = useState(0);
  const [clientName, setClientName] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [startWeight, setStartWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [targetWaist, setTargetWaist] = useState('');
  // خطة مؤقتة لخطوة الحالات الطبية فقط حتى نعيد استخدام محرر الحالات القائم
  const [medicalDraft, setMedicalDraft] = useState<PlanConfig>(() =>
    JSON.parse(JSON.stringify({ ...plan, medicalConditions: { conditions: [], allergies: [], showToClient: true } }))
  );
  const [medicationsText, setMedicationsText] = useState('');
  const [allergiesText, setAllergiesText] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [activityLevel, setActivityLevel] = useState<IntakeAnswers['activityLevel']>('');
  const [fastingType, setFastingType] = useState<IntakeAnswers['fastingType']>('');
  const [goal, setGoal] = useState('');
  const [notes, setNotes] = useState('');

  const canNext = useMemo(() => {
    if (step === 0) return clientName.trim().length > 0;
    return true;
  }, [step, clientName]);

  if (!isOpen) return null;

  const handleFinish = () => {
    const answers: IntakeAnswers = {
      clientName: clientName.trim(),
      heightCm: heightCm ? parseFloat(heightCm) : null,
      startWeight: startWeight ? parseFloat(startWeight) : null,
      targetWeight: targetWeight ? parseFloat(targetWeight) : null,
      targetWaist: targetWaist ? parseFloat(targetWaist) : null,
      conditions: medicalDraft.medicalConditions?.conditions || [],
      allergies: allergiesText
        .split(/،|,|؛|;/)
        .map((a) => a.trim())
        .filter(Boolean),
      medicationsText,
      sleepHours: sleepHours ? parseFloat(sleepHours) : null,
      activityLevel,
      fastingType,
      goal,
      notes,
    };
    const draft = buildIntakeDraftPlan(answers, plan);
    saveIntakeDraft(draft);
    onNotify('تم حفظ مسودة الاستبيان ✅ — ستراجعها الأخصائية قبل الاعتماد');
    onClose();
  };

  const inputCls =
    'w-full text-sm font-bold min-h-[44px] p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100';
  const labelCls = 'block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 overflow-y-auto" dir="rtl">
      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5 pb-28">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-peacock-mist dark:bg-peacock-ink-deep/40 text-peacock-indigo dark:text-peacock-teal flex items-center justify-center">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-black text-slate-800 dark:text-slate-100 text-base">استبيان العميل الجديد</h2>
              <p className="text-[11px] font-medium text-slate-400">
                الخطوة {step + 1} من {STEP_TITLES.length}: {STEP_TITLES[step]} — الناتج مسودة تراجعها الأخصائية، لا يغيّر خطتك الحالية
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="إغلاق الاستبيان"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* مؤشر الخطوات */}
        <div className="flex gap-1.5">
          {STEP_TITLES.map((t, i) => (
            <div key={t} className={`h-2 flex-1 rounded-full ${i <= step ? 'bg-peacock-blue' : 'bg-slate-200 dark:bg-slate-800'}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div>
              <label className={labelCls}>الاسم *</label>
              <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="مثال: سارة أحمد" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className={labelCls}>الطول (سم)</label>
                <input type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="170" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>الوزن الحالي (كجم)</label>
                <input type="number" step="0.5" value={startWeight} onChange={(e) => setStartWeight(e.target.value)} placeholder="85" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>الوزن المستهدف (كجم)</label>
                <input type="number" step="0.5" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} placeholder="68" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>الوسط المستهدف (سم)</label>
                <input type="number" step="0.5" value={targetWaist} onChange={(e) => setTargetWaist(e.target.value)} placeholder="75" className={inputCls} />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800">
            <MedicalConditionsEditor draft={medicalDraft} onUpdateDraft={setMedicalDraft} onNotify={onNotify} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div>
              <label className={labelCls}>الأدوية الحالية (سطر لكل دواء: الاسم - الجرعة)</label>
              <textarea
                value={medicationsText}
                onChange={(e) => setMedicationsText(e.target.value)}
                rows={5}
                placeholder={'مثال:\nميتفورمين - 500 مجم\nفيتامين د - 5000 وحدة'}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>حساسية أو محظورات طعام (افصل بفاصلة)</label>
              <input type="text" value={allergiesText} onChange={(e) => setAllergiesText(e.target.value)} placeholder="جلوتين، لاكتوز" className={inputCls} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div>
              <label className={labelCls}>متوسط ساعات النوم يوميًا</label>
              <input type="number" step="0.5" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} placeholder="7" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>مستوى النشاط اليومي</label>
              <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as IntakeAnswers['activityLevel'])} className={inputCls}>
                <option value="">اختر…</option>
                <option value="low">منخفض (عمل مكتبي)</option>
                <option value="moderate">متوسط (حركة يومية)</option>
                <option value="high">عالٍ (رياضة منتظمة)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>نمط الصيام (إن وُجد)</label>
              <select value={fastingType} onChange={(e) => setFastingType(e.target.value as IntakeAnswers['fastingType'])} className={inputCls}>
                <option value="">بدون صيام</option>
                <option value="intermittent">صيام متقطع</option>
                <option value="islamic">صيام إسلامي</option>
                <option value="christian">صيام مسيحي</option>
              </select>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div>
              <label className={labelCls}>هدفك الأساسي</label>
              <input type="text" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="مثال: نزول 10 كجم قبل الصيف" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>أي ملاحظات للأخصائية؟</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className={inputCls} />
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 text-xs font-bold text-amber-800 dark:text-amber-300">
              عند الحفظ ستتولد «مسودة خطة» فقط. خطتك النشطة لن تتغير، والأخصائية ستراجع المسودة وتعدّلها قبل أي اعتماد.
            </div>
          </div>
        )}

        {/* تنقّل */}
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-3xl mx-auto flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-sm flex items-center gap-1 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" /> السابق
              </button>
            )}
            {step < STEP_TITLES.length - 1 ? (
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setStep(step + 1)}
                className="flex-1 py-3 rounded-2xl bg-peacock-blue hover:bg-peacock-indigo disabled:opacity-40 text-white font-black text-sm flex items-center justify-center gap-1 cursor-pointer"
              >
                التالي <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="flex-1 py-3 rounded-2xl bg-peacock-blue hover:bg-peacock-indigo text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" /> حفظ المسودة
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
