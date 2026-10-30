import React, { useState } from 'react';
import {
  Sliders,
  CheckCircle2,
  Utensils,
  Droplets,
  Timer,
  PieChart,
  Pill,
  Sparkles,
  Moon,
  Smile,
  Activity,
  Stethoscope,
  Calendar,
  FlaskConical,
  FileText,
  Award,
  Zap,
  Layers,
  HeartPulse,
} from 'lucide-react';
import { PlanConfig, SectionVisibility } from '../types';
import { DEFAULT_VISIBLE_SECTIONS, isSectionVisible, savePlanToStorage } from '../utils/storage';
import { BottomSheetModal } from './BottomSheetModal';

interface CardCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PlanConfig;
  onUpdatePlan: (updatedPlan: PlanConfig) => void;
  onNotify: (msg: string) => void;
}

interface CardMeta {
  key: keyof SectionVisibility;
  label: string;
  desc: string;
  icon: React.ReactNode;
  category: 'core' | 'nutrition' | 'health' | 'lifestyle';
}

const CARDS_CONFIG: CardMeta[] = [
  {
    key: 'mealsList',
    label: 'قائمة الوجبات والبدائل',
    desc: 'الوجبات الأساسية والخفيفة مع البدائل الغذائية المحسوبة',
    icon: <Utensils className="w-4 h-4 text-peacock-blue" />,
    category: 'core',
  },
  {
    key: 'waterTracker',
    label: 'متابع شرب الماء الذكي',
    desc: 'تسجيل الأكواب والهدف اليومي مع عداد اللترات',
    icon: <Droplets className="w-4 h-4 text-sky-500" />,
    category: 'core',
  },
  {
    key: 'scoreCard',
    label: 'بطاقة التقييم ونسبة الالتزام',
    desc: 'حساب نقاط اليوم التراكمية وسلسلة الاستمرار (Streak)',
    icon: <Award className="w-4 h-4 text-amber-500" />,
    category: 'core',
  },
  {
    key: 'fastingTimer',
    label: 'مؤقت الصيام المتقطع',
    desc: 'عداد ساعات الصيام الفعلي والتنبيه عند اكتمال الهدف',
    icon: <Timer className="w-4 h-4 text-indigo-500" />,
    category: 'nutrition',
  },
  {
    key: 'macrosTracker',
    label: 'حاسبة الماكروز والسعرات',
    desc: 'متابعة حصص البروتين، الكارب، والدهون المستهدفة',
    icon: <PieChart className="w-4 h-4 text-peacock-blue" />,
    category: 'nutrition',
  },
  {
    key: 'medicationsTracker',
    label: 'جدول الأدوية والمواعيد',
    desc: 'مواعيد الجرعات وعلاقتها بالوجبات والتنبيهات',
    icon: <Pill className="w-4 h-4 text-peacock-teal" />,
    category: 'health',
  },
  {
    key: 'supplementsTracker',
    label: 'المكملات الغذائية والفيتامينات',
    desc: 'تتبع المكملات المقررة مع كل وجبة',
    icon: <Sparkles className="w-4 h-4 text-amber-500" />,
    category: 'health',
  },
  {
    key: 'symptomsTracker',
    label: 'متابع الأعراض والملاحظات الصحية',
    desc: 'تسجيل الجهاز الهضمي والأعراض المرتبطة بالطعام',
    icon: <Stethoscope className="w-4 h-4 text-peacock-blue" />,
    category: 'health',
  },
  {
    key: 'labTracker',
    label: 'سجل التحاليل الطبية والفحوصات',
    desc: 'متابعة نتائج التحاليل الدورية ومواعيد الفحص',
    icon: <FlaskConical className="w-4 h-4 text-cyan-500" />,
    category: 'health',
  },
  {
    key: 'doctorNotes',
    label: 'توجيهات وملاحظات الأخصائي',
    desc: 'التعليمات الطبية المباشرة والتنبيهات السريرية',
    icon: <FileText className="w-4 h-4 text-blue-500" />,
    category: 'health',
  },
  {
    key: 'sleepTracker',
    label: 'متابع النوم والراحة',
    desc: 'تسجيل ساعات النوم وجودة الاستيقاظ',
    icon: <Moon className="w-4 h-4 text-peacock-blue" />,
    category: 'lifestyle',
  },
  {
    key: 'moodTracker',
    label: 'متابع المزاج والشبع',
    desc: 'تسجيل الحالة النفسية ومستويات الجوع والشبع',
    icon: <Smile className="w-4 h-4 text-amber-500" />,
    category: 'lifestyle',
  },
  {
    key: 'exerciseTracker',
    label: 'النشاط البدني والتمارين',
    desc: 'تسجيل دقائق الحركة والخطوات والرياضة',
    icon: <Activity className="w-4 h-4 text-orange-500" />,
    category: 'lifestyle',
  },
  {
    key: 'cycleTracker',
    label: 'متابع الدورة الشهرية والتأثير الهرموني',
    desc: 'تتبع مراحل الدورة وتأثيرها على الوزن والشهية',
    icon: <HeartPulse className="w-4 h-4 text-peacock-blue" />,
    category: 'health',
  },
];

export const CardCustomizerModal: React.FC<CardCustomizerModalProps> = ({
  isOpen,
  onClose,
  plan,
  onUpdatePlan,
  onNotify,
}) => {
  const [visibleMap, setVisibleMap] = useState<SectionVisibility>(() => ({
    ...DEFAULT_VISIBLE_SECTIONS,
    ...(plan.visibleSections || {}),
  }));

  const activeCount = Object.values(visibleMap).filter(Boolean).length;

  const handleToggle = (key: keyof SectionVisibility) => {
    setVisibleMap((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Preset 1: Minimal Focus (Diet & Water Only)
  const applyMinimalPreset = () => {
    const updated: SectionVisibility = {
      scoreCard: true,
      mealsList: true,
      waterTracker: true,
      macrosTracker: false,
      fastingTimer: false,
      tipsBanner: false,
      sleepTracker: false,
      moodTracker: false,
      exerciseTracker: false,
      checklistTracker: false,
      supplementsTracker: false,
      symptomsTracker: false,
      medicationsTracker: false,
      cycleTracker: false,
      labTracker: false,
      doctorNotes: true,
      quickReportBtn: true,
      bodyTab: true,
      reportsTab: true,
    };
    setVisibleMap(updated);
    onNotify('تم تفعيل نمط التركيز الغذائي البسيط (وجبات + ماء)');
  };

  // Preset 2: Fasting & Macros
  const applyFastingMacrosPreset = () => {
    const updated: SectionVisibility = {
      scoreCard: true,
      mealsList: true,
      waterTracker: true,
      fastingTimer: true,
      macrosTracker: true,
      tipsBanner: true,
      sleepTracker: false,
      moodTracker: false,
      exerciseTracker: true,
      checklistTracker: true,
      supplementsTracker: false,
      symptomsTracker: false,
      medicationsTracker: false,
      cycleTracker: false,
      labTracker: false,
      doctorNotes: true,
      quickReportBtn: true,
      bodyTab: true,
      reportsTab: true,
    };
    setVisibleMap(updated);
    onNotify('تم تفعيل نمط الصيام المتقطع وحساب الماكروز');
  };

  // Preset 3: Clinical & Medical Care
  const applyClinicalPreset = () => {
    const updated: SectionVisibility = {
      scoreCard: true,
      mealsList: true,
      waterTracker: true,
      medicationsTracker: true,
      supplementsTracker: true,
      symptomsTracker: true,
      labTracker: true,
      doctorNotes: true,
      fastingTimer: false,
      macrosTracker: false,
      tipsBanner: true,
      sleepTracker: true,
      moodTracker: true,
      exerciseTracker: false,
      checklistTracker: true,
      cycleTracker: true,
      quickReportBtn: true,
      bodyTab: true,
      reportsTab: true,
    };
    setVisibleMap(updated);
    onNotify('تم تفعيل النمط السريري والمتابعة العلاجية');
  };

  // Preset 4: All Visible
  const applyAllPreset = () => {
    const updated: SectionVisibility = {
      scoreCard: true,
      macrosTracker: true,
      fastingTimer: true,
      tipsBanner: true,
      mealsList: true,
      waterTracker: true,
      sleepTracker: true,
      moodTracker: true,
      exerciseTracker: true,
      checklistTracker: true,
      supplementsTracker: true,
      symptomsTracker: true,
      medicationsTracker: true,
      cycleTracker: true,
      labTracker: true,
      doctorNotes: true,
      quickReportBtn: true,
      bodyTab: true,
      reportsTab: true,
    };
    setVisibleMap(updated);
    onNotify('تم تفعيل وإظهار كافة البطاقات');
  };

  const handleSaveAndClose = () => {
    const updatedPlan: PlanConfig = {
      ...plan,
      visibleSections: visibleMap,
      enableMacrosTracker: visibleMap.macrosTracker ?? true,
      enableFastingTimer: visibleMap.fastingTimer ?? true,
    };
    savePlanToStorage(updatedPlan);
    onUpdatePlan(updatedPlan);
    onNotify('تم حفظ تخصيص البطاقات بنجاح ✅');
    onClose();
  };

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-xl"
      icon={
        <div className="w-10 h-10 rounded-2xl bg-[var(--app-hero)]/10 text-[var(--app-hero)] flex items-center justify-center">
          <Sliders className="w-5 h-5" />
        </div>
      }
      title="تخصيص البطاقات والتركيز"
      subtitle={`${activeCount} بطاقات نشطة حالياً • خصّص شاشتك لتقليل التشتت`}
      headerAction={
        <button
          type="button"
          onClick={handleSaveAndClose}
          className="px-3 py-1.5 rounded-xl bg-[var(--app-hero)] hover:bg-[var(--app-hero-hover)] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
        >
          حفظ التعديلات
        </button>
      }
    >
      <div className="space-y-5">
        {/* Quick Therapeutic Presets */}
        <div className="space-y-2">
          <span className="text-xs font-extrabold text-[var(--app-text-secondary)]">
            أنماط العرض العلاجية الجاهزة (بنقرة واحدة):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={applyMinimalPreset}
              className="p-2.5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card-muted)] hover:bg-[var(--app-border)]/40 transition-all text-right flex flex-col gap-1 cursor-pointer group"
            >
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[var(--app-text-primary)]">
                <Utensils className="w-3.5 h-3.5 text-peacock-blue" />
                <span>تركيز غذائي</span>
              </div>
              <span className="text-[11px] text-[var(--app-text-secondary)] leading-tight">
                وجبات وماء فقط للمبتدئين
              </span>
            </button>

            <button
              type="button"
              onClick={applyFastingMacrosPreset}
              className="p-2.5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card-muted)] hover:bg-[var(--app-border)]/40 transition-all text-right flex flex-col gap-1 cursor-pointer group"
            >
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[var(--app-text-primary)]">
                <Timer className="w-3.5 h-3.5 text-indigo-500" />
                <span>صيام وماكروز</span>
              </div>
              <span className="text-[11px] text-[var(--app-text-secondary)] leading-tight">
                حساب السعرات وساعات الصيام
              </span>
            </button>

            <button
              type="button"
              onClick={applyClinicalPreset}
              className="p-2.5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card-muted)] hover:bg-[var(--app-border)]/40 transition-all text-right flex flex-col gap-1 cursor-pointer group"
            >
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[var(--app-text-primary)]">
                <Stethoscope className="w-3.5 h-3.5 text-peacock-teal" />
                <span>متابعة علاجية</span>
              </div>
              <span className="text-[11px] text-[var(--app-text-secondary)] leading-tight">
                أدوية ومكملات وأعراض
              </span>
            </button>

            <button
              type="button"
              onClick={applyAllPreset}
              className="p-2.5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card-muted)] hover:bg-[var(--app-border)]/40 transition-all text-right flex flex-col gap-1 cursor-pointer group"
            >
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[var(--app-text-primary)]">
                <Layers className="w-3.5 h-3.5 text-sky-500" />
                <span>النمط الكامل</span>
              </div>
              <span className="text-[11px] text-[var(--app-text-secondary)] leading-tight">
                إظهار كافة اللوحات المتاحة
              </span>
            </button>
          </div>
        </div>

        {/* Individual Card Toggles */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-[var(--app-text-secondary)]">
              تخصيص البطاقات الفردية:
            </span>
            <span className="text-[11px] font-bold text-[var(--app-hero)]">
              {activeCount} مفعّلة
            </span>
          </div>

          <div className="space-y-2">
            {CARDS_CONFIG.map((card) => {
              const isEnabled = Boolean(visibleMap[card.key]);
              return (
                <div
                  key={card.key}
                  onClick={() => handleToggle(card.key)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isEnabled
                      ? 'bg-[var(--app-card)] border-[var(--app-hero)]/30 hover:border-[var(--app-hero)]/60'
                      : 'bg-[var(--app-card-muted)]/50 border-[var(--app-border)] opacity-60 hover:opacity-80'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[var(--app-card-muted)] flex items-center justify-center shrink-0 border border-[var(--app-border)]">
                      {card.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--app-text-primary)] truncate">
                        {card.label}
                      </div>
                      <div className="text-[11px] text-[var(--app-text-secondary)] truncate">
                        {card.desc}
                      </div>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div
                    className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 shrink-0 ${
                      isEnabled ? 'bg-[var(--app-hero)]' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        isEnabled ? '-translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Save CTA */}
        <button
          type="button"
          onClick={handleSaveAndClose}
          className="w-full py-3 rounded-2xl bg-[var(--app-hero)] hover:bg-[var(--app-hero-hover)] text-white font-extrabold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>حفظ وتطبيق التخصيص الآن</span>
        </button>
      </div>
    </BottomSheetModal>
  );
};
