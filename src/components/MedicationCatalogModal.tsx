import React, { useState, useMemo } from 'react';
import { Search, X, Pill, Check, Clock, Info, ShieldAlert, Sparkles, Plus, Stethoscope, Heart, Activity, Flame, Feather, Sparkle } from 'lucide-react';
import { EgyptianMedication, EGYPTIAN_MEDICATIONS_DATABASE, MEDICATION_CATEGORIES, searchEgyptianMedications, MEDS_DATA_VERSION, MEDS_DATA_UPDATED_AT } from '../utils/egyptianMedications';
import { SupplementItem } from '../types';

interface MedicationCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedication: (item: SupplementItem) => void;
  alreadySelectedNames?: string[];
}

export const MedicationCatalogModal: React.FC<MedicationCatalogModalProps> = ({
  isOpen,
  onClose,
  onSelectMedication,
  alreadySelectedNames = [],
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeItemDetails, setActiveItemDetails] = useState<EgyptianMedication | null>(null);

  const filteredMedications = useMemo(() => {
    return searchEgyptianMedications(searchQuery, selectedCategory);
  }, [searchQuery, selectedCategory]);

  if (!isOpen) return null;

  const handleChoose = (med: EgyptianMedication) => {
    const newItem: SupplementItem = {
      id: `med_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: med.tradeName,
      time: med.defaultTiming,
      category: med.category,
      notes: med.clinicalNotes,
      scientificName: med.scientificName,
    };
    onSelectMedication(newItem);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in" dir="rtl">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-peacock-mist via-indigo-50 to-peacock-mist dark:from-peacock-ink-deep/30 dark:via-indigo-950/20 dark:to-peacock-ink-deep/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-peacock-indigo text-white flex items-center justify-center shadow-lg shadow-peacock-blue/20">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                دليل الأدوية والمكملات في السوق المصري
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-peacock-pale text-peacock-indigo-dark dark:bg-peacock-ink/60 dark:text-peacock-teal-light">
                  {EGYPTIAN_MEDICATIONS_DATABASE.length} صنف مسجل
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                أدوية الضغط، السكر، الغدة، التخسيس، والفيتامينات والمكملات الغذائية بجرعاتها وتوقيتاتها الدقيقة
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Categories */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم التجاري (كونكور، جلوكوفاج، أورليستات...) أو المادة الفعالة أو الاستخدام..."
              className="w-full pr-10 pl-10 py-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-peacock-blue"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
            {MEDICATION_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-peacock-indigo text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Medication List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3">
          {filteredMedications.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">
              <Pill className="w-12 h-12 mx-auto mb-3 opacity-30 animate-pulse" />
              <p className="text-sm font-bold">لم نجد دواءً أو مكملاً يطابق بحثك "{searchQuery}"</p>
              <p className="text-xs mt-1">يمكنك إضافة أي دواء يدوياً في خانة الخطة</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredMedications.map((med) => {
                const isSelected = alreadySelectedNames.some((n: string) => n.includes(med.tradeName) || med.tradeName.includes(n));

                return (
                  <div
                    key={med.id}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-peacock-teal-light dark:hover:border-peacock-indigo-dark/60 transition-all flex flex-col justify-between gap-2.5 group shadow-xs"
                  >
                    <div>
                      {/* Top badges */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-peacock-mist text-peacock-indigo-dark dark:bg-peacock-ink-deep/60 dark:text-peacock-teal-light border border-peacock-pale dark:border-peacock-ink/40">
                          {med.categoryIcon} {med.categoryAr}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                          {med.dosageForm}
                        </span>
                      </div>

                      {/* Trade Name */}
                      <h4 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-peacock-indigo dark:group-hover:text-peacock-teal transition-colors">
                        {med.tradeName}
                      </h4>

                      {/* Scientific Name */}
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5" dir="ltr">
                        {med.scientificName}
                      </p>

                      {/* Timing & Notes */}
                      <div className="mt-2.5 space-y-1.5 text-xs">
                        <div className="flex items-start gap-1.5 text-peacock-indigo-dark dark:text-peacock-teal bg-peacock-mist dark:bg-peacock-ink-deep/30 p-2 rounded-xl border border-peacock-pale dark:border-peacock-ink/30">
                          <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-peacock-indigo" />
                          <span className="font-semibold leading-relaxed">
                            {med.defaultTiming}
                          </span>
                        </div>

                        {med.clinicalNotes && (
                          <div className="flex items-start gap-1.5 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200/60 dark:border-slate-700/50">
                            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-500" />
                            <span className="text-[11px] leading-relaxed">
                              {med.clinicalNotes}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action button */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1">
                        {med.commonDoses.slice(0, 2).map((dose, dIdx) => (
                          <span key={dIdx} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
                            {dose}
                          </span>
                        ))}
                      </div>

                      <button
                        onClick={() => handleChoose(med)}
                        className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-peacock-indigo text-white shadow-xs'
                            : 'bg-peacock-indigo hover:bg-peacock-indigo-dark text-white shadow-xs hover:shadow-peacock-blue/20'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            تمت الإضافة (إضافة أخرى)
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            إضافة للخطة
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-peacock-blue" />
            <span>يمكنك اختيار عدة أدوية متتالية لإضافتها إلى خطة المتدرب</span>
            <span className="hidden sm:inline text-slate-400 dark:text-slate-500">
              · بيانات الأدوية إصدار {MEDS_DATA_VERSION} (آخر تحديث {MEDS_DATA_UPDATED_AT}) — راجع الأسعار دوريًا
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold transition-colors cursor-pointer"
          >
            إغلاق الدليل
          </button>
        </div>

      </div>
    </div>
  );
};
