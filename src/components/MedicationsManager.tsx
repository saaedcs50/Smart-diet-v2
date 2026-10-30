import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Pill,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
  Circle,
  Info,
  TrendingDown,
  TrendingUp,
  Scale,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Search,
  Sparkles,
  BookOpen
} from 'lucide-react';
import {
  PlanConfig,
  MedicationItem,
  MedicationPlanConfig,
  MedicationSlot,
  WithFoodOption,
  AppetiteEffect,
  WeightEffect,
  SupplementItem,
} from '../types';
import {
  MEDICATION_SLOT_OPTIONS,
  WITH_FOOD_LABELS,
  APPETITE_EFFECT_LABELS,
  WEIGHT_EFFECT_LABELS,
} from '../utils/medications';
import {
  EgyptianMedication,
  searchEgyptianMedications,
  EGYPTIAN_MEDICATIONS_DATABASE,
} from '../utils/egyptianMedications';
import { MedicationCatalogModal } from './MedicationCatalogModal';

interface MedicationsManagerProps {
  draft: PlanConfig;
  onUpdateDraft: (updated: PlanConfig) => void;
  onNotify: (msg: string) => void;
}

export const MedicationsManager: React.FC<MedicationsManagerProps> = ({
  draft,
  onUpdateDraft,
  onNotify,
}) => {
  const currentPlan: MedicationPlanConfig = draft.medicationPlan || {
    showToClient: true,
    items: [],
  };

  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameInputContainerRef = useRef<HTMLDivElement>(null);

  const [formState, setFormState] = useState<Partial<MedicationItem>>({
    name: '',
    dose: '',
    timesPerDay: 1,
    timings: [],
    withFood: 'unspecified',
    appetiteEffect: 'unknown',
    weightEffect: 'unknown',
    foodInteractionNote: '',
    coachNotes: '',
    active: true,
  });

  const [isAddingNew, setIsAddingNew] = useState(false);

  // Suggestions for autocomplete when typing name in form
  const suggestions = useMemo(() => {
    if (!formState.name || formState.name.trim().length < 2) return [];
    return searchEgyptianMedications(formState.name).slice(0, 6);
  }, [formState.name]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (nameInputContainerRef.current && !nameInputContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleShowToClient = () => {
    const nextVal = !currentPlan.showToClient;
    const updated: MedicationPlanConfig = {
      ...currentPlan,
      showToClient: nextVal,
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedBy: 'coach',
    };
    onUpdateDraft({
      ...draft,
      medicationPlan: updated,
    });
    onNotify(nextVal ? 'أصبحت الأدوية ظاهرة للعميل في تبويب اليوم' : 'تم إخفاء بطاقة الأدوية عن العميل');
  };

  const applyMedicationDetails = (med: EgyptianMedication) => {
    let withFood: WithFoodOption = 'optional';
    if (med.category === 'thyroid' || med.tradeName.toLowerCase().includes('rybelsus') || med.tradeName.includes('ريبلسس') || med.tradeName.includes('إلتروكسين')) {
      withFood = 'empty_stomach';
    } else if (
      med.category === 'weight_loss' ||
      med.category === 'diabetes' ||
      med.tradeName.includes('أورليستات') ||
      med.tradeName.includes('جلوكوفاج') ||
      med.tradeName.includes('سيدوفاج')
    ) {
      withFood = 'required';
    }

    let appetiteEffect: AppetiteEffect = 'none';
    if (
      med.category === 'weight_loss' ||
      med.tradeName.includes('أوزمبيك') ||
      med.tradeName.includes('مونجارو') ||
      med.tradeName.includes('ساكسندا') ||
      med.tradeName.includes('ويجوفي') ||
      med.tradeName.includes('كروماكس')
    ) {
      appetiteEffect = 'decrease';
    }

    let weightEffect: WeightEffect = 'none';
    if (
      med.category === 'weight_loss' ||
      med.tradeName.includes('أوزمبيك') ||
      med.tradeName.includes('مونجارو') ||
      med.tradeName.includes('ساكسندا') ||
      med.tradeName.includes('فورسيجا') ||
      med.tradeName.includes('جارديانس')
    ) {
      weightEffect = 'loss';
    }

    // Determine default timing slot
    let defaultSlot: MedicationSlot = 'with_breakfast';
    let slotLabel = 'مع الإفطار';
    if (withFood === 'empty_stomach') {
      defaultSlot = 'before_breakfast';
      slotLabel = 'قبل الإفطار بـ 30-60 دقيقة على الريق';
    } else if (med.category === 'weight_loss') {
      defaultSlot = 'with_lunch';
      slotLabel = 'مع الغداء (الوجبة الرئيسية)';
    }

    setFormState({
      ...formState,
      name: med.tradeName,
      dose: med.commonDoses && med.commonDoses[0] ? med.commonDoses[0] : 'قرص واحد',
      timings: [{ id: 't_' + Date.now(), slot: defaultSlot, label: slotLabel }],
      timesPerDay: 1,
      withFood,
      appetiteEffect,
      weightEffect,
      foodInteractionNote: med.clinicalNotes,
      coachNotes: `${med.categoryAr} (${med.scientificName}) - التوقيت النموذجي: ${med.defaultTiming}`,
      active: true,
    });
    setShowSuggestions(false);
  };

  const handleStartAdd = () => {
    setEditingMedId(null);
    setFormState({
      id: 'med_' + Date.now(),
      name: '',
      dose: '',
      timesPerDay: 1,
      timings: [{ id: 't_' + Date.now(), slot: 'with_breakfast', label: 'مع الإفطار' }],
      withFood: 'required',
      appetiteEffect: 'none',
      weightEffect: 'none',
      foodInteractionNote: '',
      coachNotes: '',
      active: true,
    });
    setIsAddingNew(true);
  };

  const handleStartEdit = (med: MedicationItem) => {
    setEditingMedId(med.id);
    setFormState({ ...med });
    setIsAddingNew(true);
  };

  const handleCancelForm = () => {
    setIsAddingNew(false);
    setEditingMedId(null);
  };

  const handleToggleSlot = (slot: MedicationSlot, label: string) => {
    const currentTimings = formState.timings || [];
    const exists = currentTimings.some((t) => t.slot === slot);

    let nextTimings;
    if (exists) {
      nextTimings = currentTimings.filter((t) => t.slot !== slot);
    } else {
      nextTimings = [...currentTimings, { id: 't_' + Date.now() + Math.random().toString(36).slice(2, 5), slot, label }];
    }

    setFormState({
      ...formState,
      timings: nextTimings,
      timesPerDay: nextTimings.length || 1,
    });
  };

  const handleSaveMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name?.trim()) {
      alert('يرجى كتابة اسم الدواء أو العلاج');
      return;
    }
    if (!formState.dose?.trim()) {
      alert('يرجى كتابة جرعة الدواء (مثال: 500 مجم أو 1 قرص)');
      return;
    }
    if (!formState.timings || formState.timings.length === 0) {
      alert('يرجى تحديد توقيت واحد على الأقل بالنسبة للوجبات');
      return;
    }

    const finalItem: MedicationItem = {
      id: formState.id || 'med_' + Date.now(),
      name: formState.name.trim(),
      dose: formState.dose.trim(),
      timesPerDay: formState.timings.length,
      timings: formState.timings,
      withFood: formState.withFood || 'unspecified',
      appetiteEffect: formState.appetiteEffect || 'unknown',
      weightEffect: formState.weightEffect || 'unknown',
      foodInteractionNote: formState.foodInteractionNote?.trim() || '',
      coachNotes: formState.coachNotes?.trim() || '',
      active: formState.active !== false,
    };

    let updatedItems: MedicationItem[];
    if (editingMedId) {
      updatedItems = (currentPlan.items || []).map((m) => (m.id === editingMedId ? finalItem : m));
    } else {
      updatedItems = [...(currentPlan.items || []), finalItem];
    }

    const updatedPlan: MedicationPlanConfig = {
      ...currentPlan,
      items: updatedItems,
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedBy: 'coach',
    };

    onUpdateDraft({
      ...draft,
      medicationPlan: updatedPlan,
    });

    setIsAddingNew(false);
    setEditingMedId(null);
    onNotify(editingMedId ? 'تم تعديل بيانات الدواء بنجاح' : 'تمت إضافة الدواء إلى سجل العميل');
  };

  const handleDeleteMedication = (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف دواء "${name}" من سجل العميل؟`)) return;

    const updatedItems = (currentPlan.items || []).filter((m) => m.id !== id);
    const updatedPlan: MedicationPlanConfig = {
      ...currentPlan,
      items: updatedItems,
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedBy: 'coach',
    };

    onUpdateDraft({
      ...draft,
      medicationPlan: updatedPlan,
    });
    onNotify('تم حذف الدواء من السجل');
  };

  const handleToggleActive = (id: string) => {
    const updatedItems = (currentPlan.items || []).map((m) => {
      if (m.id === id) {
        return { ...m, active: !m.active };
      }
      return m;
    });

    onUpdateDraft({
      ...draft,
      medicationPlan: {
        ...currentPlan,
        items: updatedItems,
        lastUpdatedAt: new Date().toISOString(),
      },
    });
  };

  const items = currentPlan.items || [];
  const activeCount = items.filter((m) => m.active !== false).length;

  return (
    <div className="space-y-4">
      {/* 1. Header & Client Visibility */}
      <div className="p-4 rounded-2xl bg-[var(--app-card-muted)] border border-blue-200 dark:border-blue-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
            <Pill className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm">
                سجل الأدوية والتفاعلات الدوائية والغذائية 🇪🇬
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[12px] font-black bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                {activeCount} {activeCount === 1 ? 'دواء مفعّل' : activeCount === 2 ? 'دواءان مفعّلان' : 'أدوية مفعّلة'}
              </span>
            </div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
              مكتبة أدوية الضغط، السكر، الغدة، التخسيس، والمكملات المتاحة بالسوق المصري مع توقيتاتها وتفاعلاتها مع الوجبات.
            </p>
          </div>
        </div>

        {/* Action buttons & Visibility Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowCatalogModal(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-peacock-pale dark:bg-peacock-ink-deep/70 hover:bg-peacock-sage text-peacock-indigo-dark dark:text-peacock-teal-light border border-peacock-sage dark:border-peacock-indigo-deep transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>دليل الأدوية المصري</span>
          </button>

          <button
            type="button"
            onClick={handleToggleShowToClient}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              currentPlan.showToClient !== false
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
            }`}
            title="تحديد هل تظهر بطاقة الأدوية للعميل في تبويب اليوم لتسجيل الالتزام"
          >
            {currentPlan.showToClient !== false ? <Eye className="w-3.5 h-3.5 text-blue-600" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
            <span>{currentPlan.showToClient !== false ? 'ظاهر للعميل' : 'مخفي عن العميل'}</span>
          </button>
        </div>
      </div>

      {/* 2. Add Medication Action */}
      {!isAddingNew && (
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            قائمة الأدوية والعلاجات الموصوفة:
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCatalogModal(true)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>بحث في الدليل</span>
            </button>
            <button
              type="button"
              onClick={handleStartAdd}
              className="px-3.5 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة دواء جديد</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Add/Edit Medication Form */}
      {isAddingNew && (
        <form
          onSubmit={handleSaveMedication}
          className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-800/95 border-2 border-blue-500/40 dark:border-blue-500/30 space-y-4 animate-in slide-in-from-top-2 duration-150"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <div className="flex items-center gap-2">
              <Pill className="w-4 h-4 text-blue-600" />
              <h5 className="font-black text-slate-800 dark:text-slate-100 text-sm">
                {editingMedId ? 'تعديل بيانات الدواء' : 'إضافة دواء جديد للسجل'}
              </h5>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCatalogModal(true)}
                className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-peacock-mist dark:bg-peacock-ink-deep/60 text-peacock-indigo-dark dark:text-peacock-teal-light border border-peacock-sage dark:border-peacock-indigo-deep flex items-center gap-1 cursor-pointer"
              >
                <Search className="w-3 h-3" />
                <span>اختر من دليل الأدوية 🇪🇬</span>
              </button>
              <button
                type="button"
                onClick={handleCancelForm}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Name & Dose */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div ref={nameInputContainerRef} className="relative">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                اسم الدواء / العلاج <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="مثال: جلوكوفاج، كونكور، أورليستات، أوزمبيك..."
                  value={formState.name || ''}
                  onChange={(e) => {
                    setFormState({ ...formState, name: e.target.value });
                    setShowSuggestions(true);
                  }}
                  onFocus={() => {
                    if (formState.name && formState.name.trim().length >= 2) {
                      setShowSuggestions(true);
                    }
                  }}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
                <Pill className="w-3.5 h-3.5 text-blue-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Autocomplete Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full right-0 left-0 mt-1 z-40 bg-white dark:bg-slate-850 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-56 overflow-y-auto">
                  <div className="p-1.5 bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-500 flex justify-between">
                    <span>اقتراحات الأدوية والمكملات في مصر</span>
                    <span className="text-blue-600">انقر للتعبئة التلقائية</span>
                  </div>
                  {suggestions.map((sug) => (
                    <button
                      key={sug.id}
                      type="button"
                      onClick={() => applyMedicationDetails(sug)}
                      className="w-full text-right p-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors flex items-start justify-between gap-2 cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-900 dark:text-white">
                            {sug.tradeName}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold">
                            {sug.categoryIcon} {sug.categoryAr.split('(')[0]}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5" dir="ltr">
                          {sug.scientificName}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                الجرعة وعدد الحبات <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="مثال: 500 مجم (قرص واحد)"
                value={formState.dose || ''}
                onChange={(e) => setFormState({ ...formState, dose: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Timing Slots (Checkboxes grouped) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>توقيت الجرعات بالنسبة للوجبات:</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[12px] font-bold text-blue-600">
                {(formState.timings || []).length} مواعيد محددة
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
              {MEDICATION_SLOT_OPTIONS.map((slotOpt) => {
                const isChecked = (formState.timings || []).some((t) => t.slot === slotOpt.slot);
                return (
                  <button
                    key={slotOpt.slot}
                    type="button"
                    onClick={() => handleToggleSlot(slotOpt.slot, slotOpt.label)}
                    className={`p-2 rounded-xl text-right text-xs transition-all flex items-center justify-between border cursor-pointer ${
                      isChecked
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-400 dark:border-blue-600 text-blue-900 dark:text-blue-100 font-bold'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span>{slotOpt.label}</span>
                    <div
                      className={`w-4 h-4 rounded-md flex items-center justify-center border transition-colors ${
                        isChecked
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* With Food Instructions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                علاقة الدواء بالأكل
              </label>
              <select
                value={formState.withFood || 'unspecified'}
                onChange={(e) => setFormState({ ...formState, withFood: e.target.value as WithFoodOption })}
                className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
              >
                {Object.entries(WITH_FOOD_LABELS).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                التأثير على الشهية
              </label>
              <select
                value={formState.appetiteEffect || 'unknown'}
                onChange={(e) => setFormState({ ...formState, appetiteEffect: e.target.value as AppetiteEffect })}
                className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
              >
                {Object.entries(APPETITE_EFFECT_LABELS).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                التأثير على الوزن
              </label>
              <select
                value={formState.weightEffect || 'unknown'}
                onChange={(e) => setFormState({ ...formState, weightEffect: e.target.value as WeightEffect })}
                className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
              >
                {Object.entries(WEIGHT_EFFECT_LABELS).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Food Interaction Note */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              <span>ملاحظة التفاعل الغذائي (أطعمة يجب تجنبها أو الانتباه لها):</span>
            </label>
            <input
              type="text"
              placeholder="مثال: يمنع تناول الجريب فروت، أو يفصل ساعتين عن مشتقات الحليب والكالسيوم"
              value={formState.foodInteractionNote || ''}
              onChange={(e) => setFormState({ ...formState, foodInteractionNote: e.target.value })}
              className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
            />
          </div>

          {/* Coach Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              ملاحظات الطبيب / المدرب الخاصة بالدواء:
            </label>
            <input
              type="text"
              placeholder="مثال: دواء ضغط يؤخذ بانتظام، يتم قياس الضغط أسبوعياً صباحاً"
              value={formState.coachNotes || ''}
              onChange={(e) => setFormState({ ...formState, coachNotes: e.target.value })}
              className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <button
              type="button"
              onClick={handleCancelForm}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>{editingMedId ? 'حفظ التعديلات' : 'إضافة الدواء للسجل'}</span>
            </button>
          </div>
        </form>
      )}

      {/* 4. List of Existing Medications */}
      {items.length === 0 && !isAddingNew ? (
        <div className="text-center py-10 px-4 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 space-y-3">
          <Pill className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
          <div>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
              لم يتم تسجيل أي أدوية أو مكملات للعميل حتى الآن.
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              أضف أدوية الضغط، السكر، الغدة، التخسيس أو المكملات لتتبع مواعيدها وتفاعلاتها مع الوجبات.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCatalogModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-peacock-indigo text-white hover:bg-peacock-indigo-dark cursor-pointer transition-colors shadow-xs"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>تصفح دليل الأدوية المصري الشامل</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((med) => {
            const withFoodInfo = WITH_FOOD_LABELS[med.withFood || 'unspecified'];
            const appetiteInfo = APPETITE_EFFECT_LABELS[med.appetiteEffect || 'unknown'];
            const weightInfo = WEIGHT_EFFECT_LABELS[med.weightEffect || 'unknown'];

            return (
              <div
                key={med.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  med.active !== false
                    ? 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="font-black text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                        {med.name}
                      </h5>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                        {med.dose}
                      </span>
                      {med.active === false && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-500">
                          (متوقف مؤقتاً)
                        </span>
                      )}
                    </div>

                    {/* Timings */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        المواعيد:
                      </span>
                      {(med.timings || []).map((t) => (
                        <span
                          key={t.id}
                          className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50"
                        >
                          {t.label}
                        </span>
                      ))}
                    </div>

                    {/* Meta Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                      {withFoodInfo && med.withFood !== 'unspecified' && (
                        <span className={`px-2 py-0.5 rounded-md border font-medium ${withFoodInfo.badgeColor}`}>
                          {withFoodInfo.label}
                        </span>
                      )}
                      {appetiteInfo && med.appetiteEffect !== 'unknown' && med.appetiteEffect !== 'none' && (
                        <span className="px-2 py-0.5 rounded-md bg-peacock-mist dark:bg-peacock-ink-deep/50 text-peacock-indigo dark:text-peacock-teal-light border border-peacock-sage dark:border-peacock-indigo-deep font-medium">
                          {appetiteInfo.label}
                        </span>
                      )}
                      {weightInfo && med.weightEffect !== 'unknown' && med.weightEffect !== 'none' && (
                        <span
                          className={`px-2 py-0.5 rounded-md border font-medium ${
                            med.weightEffect === 'loss'
                              ? 'bg-peacock-mist dark:bg-peacock-ink-deep/50 text-peacock-indigo-dark dark:text-peacock-teal-light border-peacock-sage dark:border-peacock-indigo-deep'
                              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                          }`}
                        >
                          {weightInfo.label}
                        </span>
                      )}
                    </div>

                    {/* Food Interaction Note */}
                    {med.foodInteractionNote && (
                      <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-[12px] text-amber-900 dark:text-amber-200 flex items-start gap-1.5 mt-1 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>تفاعل غذائي:</strong> {med.foodInteractionNote}
                        </span>
                      </div>
                    )}

                    {/* Coach Notes */}
                    {med.coachNotes && (
                      <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium pt-0.5">
                        {med.coachNotes}
                      </p>
                    )}
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(med.id)}
                      className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        med.active !== false
                          ? 'text-slate-400 hover:text-slate-600 border-slate-200 dark:border-slate-700'
                          : 'text-peacock-indigo border-peacock-teal-light dark:border-peacock-indigo-dark bg-peacock-mist dark:bg-peacock-ink-deep'
                      }`}
                      title={med.active !== false ? 'إيقاف مؤقت' : 'إعادة تفعيل'}
                    >
                      {med.active !== false ? 'إيقاف' : 'تفعيل'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(med)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
                      title="تعديل الدواء"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMedication(med.id, med.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
                      title="حذف الدواء"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Medication Catalog Browser Modal */}
      <MedicationCatalogModal
        isOpen={showCatalogModal}
        onClose={() => setShowCatalogModal(false)}
        onSelectMedication={(suppItem) => {
          // Look up full EgyptianMedication details
          const med = EGYPTIAN_MEDICATIONS_DATABASE.find((m) => m.tradeName === suppItem.name);
          if (med) {
            applyMedicationDetails(med);
          } else {
            setFormState({
              ...formState,
              name: suppItem.name,
              dose: 'قرص واحد',
              foodInteractionNote: suppItem.notes || '',
              coachNotes: `التوقيت الموصى به: ${suppItem.time || 'مع الأكل'}`,
            });
          }
          setIsAddingNew(true);
          setShowCatalogModal(false);
          onNotify(`تم اختيار ${suppItem.name} وتعبئة بياناته تلقائياً`);
        }}
        alreadySelectedNames={items.map((m) => m.name)}
      />
    </div>
  );
};
