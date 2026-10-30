import React, { useState } from 'react';
import { 
  Check, 
  X, 
  RotateCw, 
  ChevronDown, 
  ChevronUp, 
  Flame, 
  Leaf, 
  Beef, 
  Circle, 
  Info, 
  Scale, 
  Sparkles, 
  Fish 
} from 'lucide-react';
import { MealItem, MealLogState } from '../types';
import { BRAND } from '../config/brand';
import { HungerFullnessPicker } from './HungerFullnessPicker';
import { TodayFastingStatus, getRemappedMealName } from '../utils/fasting';
import { detectFastingSubstitutions, SMART_SUBSTITUTIONS_BANK, FastingSubItem } from '../utils/fastingSubstitutions';

interface MealCardProps {
  meal: MealItem;
  state?: MealLogState;
  onUpdate: (state: MealLogState) => void;
  index?: number;
  fastingStatus?: TodayFastingStatus;
}

export const MealCard: React.FC<MealCardProps> = ({ 
  meal, 
  state, 
  onUpdate, 
  index = 0,
  fastingStatus 
}) => {
  const currentLog: MealLogState = state || {};
  const [showAlts, setShowAlts] = useState(false);
  const [showSmartSubs, setShowSmartSubs] = useState(false);

  const isCommitted = currentLog.eval === 'yes';
  const isSlipped = currentLog.eval === 'no';
  const isAlternative = currentLog.type === 'alt';

  // Fasting checks
  const isFastingActive = fastingStatus?.isFasting;
  const isIslamic = fastingStatus?.type === 'islamic';
  const isChristian = fastingStatus?.type === 'christian';
  const allowFish = fastingStatus?.allowFish || false;

  // Meal name remapping for Islamic fasting days
  const displayName = isIslamic && isFastingActive 
    ? getRemappedMealName(meal.name, index, true)
    : meal.name;

  // Detect smart substitutions for this meal
  const detectedSubs = detectFastingSubstitutions(meal.items, allowFish);
  const hasSmartSubs = detectedSubs.length > 0;

  const handleSetCommitted = () => {
    onUpdate({
      ...currentLog,
      eval: 'yes',
      type: currentLog.type || 'default',
      protein: currentLog.protein ?? true,
      veggies: currentLog.veggies ?? true,
    });
  };

  const handleSetSlipped = () => {
    onUpdate({
      ...currentLog,
      eval: 'no',
      type: 'none',
    });
  };

  const handleSelectAlternative = (altText: string) => {
    onUpdate({
      ...currentLog,
      type: 'alt',
      detail: altText,
      eval: 'yes',
    });
    setShowAlts(false);
    setShowSmartSubs(false);
  };

  const handleApplySmartSub = (sub: FastingSubItem, useFish: boolean) => {
    const choice = useFish && sub.fishAlternative ? sub.fishAlternative : sub.plantAlternative;
    onUpdate({
      ...currentLog,
      type: 'alt',
      detail: `${choice} (~${sub.proteinGrams}g بروتين)`,
      eval: 'yes',
      protein: true,
      veggies: true,
    });
    setShowSmartSubs(false);
  };

  const handleToggleProtein = () => {
    onUpdate({ ...currentLog, protein: !currentLog.protein });
  };

  const handleToggleVeggies = () => {
    onUpdate({ ...currentLog, veggies: !currentLog.veggies });
  };

  return (
    <div
      className={`rounded-3xl p-4 sm:p-5 border transition-all duration-200 ${
        isCommitted
          ? 'bg-[#4D52B4]/10 dark:bg-[#4D52B4]/15 border-[#4D52B4]/40 dark:border-[#4D52B4]/40'
          : isSlipped
          ? 'bg-[#E0922D]/10 dark:bg-[#E0922D]/15 border-[#E0922D]/40 dark:border-[#E0922D]/40'
          : 'bg-[var(--app-card)] border-[var(--app-border)]/80'
      }`}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center flex-wrap gap-2">
            <h3 className="font-bold text-[var(--app-text-primary)] text-sm sm:text-base">
              {displayName}
            </h3>

            {isIslamic && isFastingActive && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-peacock-blue/10 dark:bg-peacock-blue/20 text-peacock-indigo-dark dark:text-peacock-teal-light border border-peacock-blue/30">
                صيام إسلامي
              </span>
            )}

            {isChristian && isFastingActive && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                {allowFish ? 'صيامي + سمك' : 'نباتي صيامي'}
              </span>
            )}

            {isAlternative && (
              <span className="text-[12px] font-bold px-2 py-0.5 rounded-full bg-[var(--app-secondary)]/10 dark:bg-[var(--app-secondary)]/30 text-[var(--app-secondary)] dark:text-[var(--app-secondary)] border border-[var(--app-secondary)]/20">
                بديل معتمد 
              </span>
            )}
            {meal.calories && (
              <span className="text-[12px] font-medium text-[var(--app-text-secondary)]">
                ~{meal.calories} سعرة
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--app-text-secondary)] mt-1 leading-relaxed">
            {isAlternative && currentLog.detail ? (
              <span className="text-[var(--app-secondary)] dark:text-[var(--app-secondary)] font-semibold">
                البديل المختار: {currentLog.detail}
              </span>
            ) : (
              meal.items
            )}
          </p>
        </div>

        {/* Commitment Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleSetCommitted}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer ${
              isCommitted
                ? 'bg-[#4D52B4] text-white'
                : 'bg-[var(--app-card-muted)] text-[var(--app-text-primary)] hover:bg-[#4D52B4]/10 hover:text-[#4D52B4]'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>تم الالتزام</span>
          </button>

          <button
            onClick={handleSetSlipped}
            className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer ${
              isSlipped
                ? 'bg-[#E0922D] text-white'
                : 'bg-[var(--app-card-muted)] text-[var(--app-text-primary)] hover:bg-[#E0922D]/10 hover:text-[#E0922D]'
            }`}
            title="تغيير بالوجبة"
          >
            <X className="w-3.5 h-3.5" />
            <span>تغيير</span>
          </button>
        </div>
      </div>

      {/* Note input if not fully committed */}
      {isSlipped && (
        <div className="mt-3 p-3 rounded-2xl bg-[var(--app-card-muted)] border border-[var(--app-border)]/60 text-xs text-[var(--app-text-primary)] space-y-1.5 animate-in fade-in">
          <p className="text-[12px] leading-relaxed text-[var(--app-text-secondary)]">
            تدوين ما تم تناوله أو سبب التغيير لإطلاع {BRAND.doctorName}:
          </p>
          <input
            type="text"
            placeholder="مثال: تم تناول وجبة سريعة مع الأصدقاء..."
            value={currentLog.reason || ''}
            onChange={(e) => onUpdate({ ...currentLog, reason: e.target.value })}
            className="w-full text-xs p-2 rounded-xl border border-[var(--app-border)]/70 bg-[var(--app-card)] text-[var(--app-text-primary)] outline-none focus:ring-2 focus:ring-[var(--app-hero)]"
          />
        </div>
      )}

      {/* Mindful Eating: Hunger & Fullness Scale 1-10 (Before & After Meal) */}
      <HungerFullnessPicker
        hungerBefore={currentLog.hungerBefore}
        fullnessAfter={currentLog.fullnessAfter}
        onChange={(updates) => onUpdate({ ...currentLog, ...updates })}
      />

      {/* Action Footer: Quality Pills + Always Visible Alternatives Button + Smart Substitutions */}
      <div className="mt-3 pt-2.5 border-t border-[var(--app-border)]/40 flex flex-wrap items-center justify-between gap-2">
        {/* Quality Toggles (Visible when committed) */}
        {isCommitted ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleToggleProtein}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                currentLog.protein
                  ? 'bg-[#4D52B4] text-white'
                  : 'bg-[var(--app-card-muted)] text-[var(--app-text-secondary)] hover:bg-[var(--app-card-muted)]'
              }`}
            >
              <Beef className="w-3.5 h-3.5" />
              <span>بروتين كافٍ</span>
            </button>

            <button
              onClick={handleToggleVeggies}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                currentLog.veggies
                  ? 'bg-[#4D52B4] text-white'
                  : 'bg-[var(--app-card-muted)] text-[var(--app-text-secondary)] hover:bg-[var(--app-card-muted)]'
              }`}
            >
              <Leaf className="w-3.5 h-3.5" />
              <span>خضار / سلطة</span>
            </button>
          </div>
        ) : (
          <span className="text-[12px] text-[var(--app-text-secondary)]">
            اضغط على "تم الالتزام" لتسجيل جودة الوجبة
          </span>
        )}

        {/* Buttons: Standard Alternatives + Smart Substitutions Bank */}
        <div className="flex items-center gap-2 mr-auto">
          {/* Smart Substitutions Bank Button */}
          <button
            onClick={() => {
              setShowSmartSubs(!showSmartSubs);
              setShowAlts(false);
            }}
            className="px-2.5 py-1 rounded-xl text-xs font-bold text-peacock-indigo dark:text-peacock-teal-light bg-peacock-mist dark:bg-peacock-ink-deep/50 hover:bg-peacock-pale dark:hover:bg-peacock-ink/50 border border-peacock-sage dark:border-peacock-indigo-deep/80 transition-colors flex items-center gap-1 cursor-pointer"
            title="بنك البدائل الذكي للصيام والوجبات النباتية"
          >
            <Sparkles className="w-3.5 h-3.5 text-peacock-blue" />
            <span>{showSmartSubs ? 'إغلاق البدائل' : 'بنك البدائل الذكي'}</span>
          </button>

          {/* Alternatives Toggle Button - ALWAYS VISIBLE */}
          {meal.alternatives && meal.alternatives.length > 0 && (
            <button
              onClick={() => {
                setShowAlts(!showAlts);
                setShowSmartSubs(false);
              }}
              className="px-2.5 py-1 rounded-xl text-xs font-bold text-[var(--app-secondary)] dark:text-[var(--app-secondary)] bg-[var(--app-secondary)]/10 dark:bg-[var(--app-secondary)]/30 hover:bg-[var(--app-secondary)]/20 border border-[var(--app-secondary)]/30 dark:border-[var(--app-border)] transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RotateCw className="w-3 h-3" />
              {showAlts ? 'إخفاء الخيارات' : 'البدائل المقررة'}
            </button>
          )}
        </div>
      </div>

      {/* Smart Substitutions Bank Drawer */}
      {showSmartSubs && (
        <div className="mt-3 p-3.5 rounded-2xl bg-peacock-mist/50 dark:bg-slate-900 border border-peacock-sage dark:border-peacock-ink/60 space-y-3 animate-in slide-in-from-top duration-150">
          <div className="flex items-center justify-between border-b border-peacock-sage/60 dark:border-peacock-ink/40 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal" />
              <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                بنك البدائل الذكي (بدائل نباتية وصيامية متوازنة الماكروز)
              </span>
            </div>
            {isAlternative && (
              <button
                onClick={() => {
                  onUpdate({
                    ...currentLog,
                    type: 'default',
                    detail: undefined,
                  });
                }}
                className="text-[12px] font-bold text-peacock-indigo dark:text-peacock-teal hover:underline cursor-pointer"
              >
                الرجوع للوجبة الأصلية
              </button>
            )}
          </div>

          {/* Quick Detected Matches for this meal */}
          {hasSmartSubs && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-peacock-indigo-deep dark:text-peacock-teal-light block">
                ⚡ بدائل مقترحة تلقائياً لمكونات هذه الوجبة:
              </span>
              <div className="grid grid-cols-1 gap-2">
                {detectedSubs.map((sub) => (
                  <div 
                    key={sub.id}
                    className="p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-peacock-pale dark:border-peacock-ink/50 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-700 dark:text-slate-200">
                        بديل: {sub.original}
                      </span>
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-peacock-mist dark:bg-peacock-ink-deep/60 text-peacock-indigo dark:text-peacock-teal-light">
                        ~{sub.proteinGrams}g بروتين
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      💡 {sub.notesAr}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {/* Option 1: Plant-based alternative */}
                      <button
                        type="button"
                        onClick={() => handleApplySmartSub(sub, false)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-peacock-indigo hover:bg-peacock-indigo-dark text-white transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Leaf className="w-3 h-3" />
                        <span>نباتي صيامي: {sub.plantAlternative.slice(0, 30)}...</span>
                      </button>

                      {/* Option 2: Seafood alternative (if allowed) */}
                      {sub.fishAlternative && (
                        <button
                          type="button"
                          onClick={() => handleApplySmartSub(sub, true)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Fish className="w-3 h-3" />
                          <span>بديل بحري: {sub.fishAlternative.slice(0, 25)}...</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full General Substitutions List */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">
              جميع بدائل البروتين المعتمدة في البنك:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {SMART_SUBSTITUTIONS_BANK.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleApplySmartSub(item, allowFish)}
                  className="text-right p-2 rounded-xl bg-white dark:bg-slate-800/80 hover:border-peacock-teal border border-slate-200 dark:border-slate-700 text-xs transition-colors cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {item.original}
                    </span>
                    <span className="text-[10px] font-bold text-peacock-indigo dark:text-peacock-teal">
                      {item.proteinGrams}g بروتين
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {allowFish && item.fishAlternative ? item.fishAlternative : item.plantAlternative}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Alternative items accordion - Always Accessible */}
      {showAlts && meal.alternatives && meal.alternatives.length > 0 && (
        <div className="mt-3 p-3 rounded-2xl bg-[var(--app-card-muted)] border border-[var(--app-border)]/70 space-y-2 animate-in slide-in-from-top duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--app-text-primary)]">
              اختر البديل المعتمد من {BRAND.doctorName}:
            </span>
            {isAlternative && (
              <button
                onClick={() => {
                  onUpdate({
                    ...currentLog,
                    type: 'default',
                    detail: undefined,
                  });
                }}
                className="text-[12px] font-bold text-[var(--app-hero)] dark:text-[var(--app-hero-hover)] hover:underline cursor-pointer"
              >
                الرجوع للوجبة الأساسية
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {meal.alternatives.map((alt, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectAlternative(alt)}
                className={`w-full text-right p-2.5 rounded-xl text-xs font-medium border transition-colors flex items-center justify-between cursor-pointer ${
                  currentLog.detail === alt && isAlternative
                    ? 'bg-[#4D52B4]/15 dark:bg-[#4D52B4]/25 text-[#4D52B4] dark:text-[#70D6C5] border-[#4D52B4]/40'
                    : 'bg-[var(--app-card)] hover:bg-[var(--app-card-muted)] text-[var(--app-text-primary)] border-[var(--app-border)]/60'
                }`}
              >
                <span>{alt}</span>
                <span className="text-[12px] font-bold px-2 py-0.5 rounded-lg bg-[var(--app-secondary)]/10 dark:bg-[var(--app-secondary)]/30 text-[var(--app-secondary)] dark:text-[var(--app-secondary)]">
                  {currentLog.detail === alt && isAlternative ? 'محدد حالياً ' : 'اختيار البديل'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
