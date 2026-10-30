import React, { useState, useRef, useEffect } from 'react';
import { Pill, Trash2, Search, Clock, Info, Check, Sparkles, ChevronDown } from 'lucide-react';
import { SupplementItem } from '../types';
import { EgyptianMedication, searchEgyptianMedications } from '../utils/egyptianMedications';

interface MedicationInputRowProps {
  item: SupplementItem;
  index: number;
  onChange: (updated: SupplementItem) => void;
  onRemove: () => void;
  onOpenCatalog: () => void;
}

const COMMON_TIMINGS = [
  'صباحاً على الريق قبل الإفطار',
  'مع وجبة الإفطار',
  'وسط وجبة الغداء',
  'بعد الغداء مباشرة',
  'قبل النوم بساعة',
  'قبل الوجبة الرئيسية بـ 20 دقيقة',
  'قبل التمرين الرياضي بـ 45 دقيقة',
  'بعد التمرين مباشرة',
  'مرة واحدة أسبوعياً',
];

export const MedicationInputRow: React.FC<MedicationInputRowProps> = ({
  item,
  index,
  onChange,
  onRemove,
  onOpenCatalog,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showNotesField, setShowNotesField] = useState(Boolean(item.notes));
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = React.useMemo(() => {
    if (!item.name || item.name.trim().length < 2) return [];
    return searchEgyptianMedications(item.name).slice(0, 6);
  }, [item.name]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setShowTimeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectMedication = (med: EgyptianMedication) => {
    onChange({
      ...item,
      name: med.tradeName,
      time: med.defaultTiming,
      notes: med.clinicalNotes,
      category: med.category,
      scientificName: med.scientificName,
    });
    setShowSuggestions(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 group transition-all"
    >
      <div className="flex gap-2 items-center">
        {/* Medicine Name with Autocomplete */}
        <div className="relative flex-1 min-w-0">
          <div className="relative">
            <input
              type="text"
              value={item.name}
              onChange={(e) => {
                onChange({ ...item, name: e.target.value });
                setShowSuggestions(true);
              }}
              onFocus={() => {
                if (item.name && item.name.trim().length >= 2) {
                  setShowSuggestions(true);
                }
              }}
              className="w-full text-xs sm:text-sm font-bold p-2 pr-7 rounded-xl bg-slate-50/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-peacock-blue"
              placeholder="اسم الدواء أو المكمل (مثال: كونكور، جلوكوفاج، أورليستات...)"
            />
            <Pill className="w-3.5 h-3.5 text-peacock-indigo dark:text-peacock-teal absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Autocomplete Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full right-0 left-0 mt-1.5 z-40 bg-white dark:bg-slate-850 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-60 overflow-y-auto">
              <div className="p-1.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-705 text-[10px] font-bold text-slate-500 flex items-center justify-between">
                <span>أدوية ومكملات مقترحة من السوق المصري</span>
                <span className="text-peacock-indigo dark:text-peacock-teal">انقر للاختيار التلقائي</span>
              </div>
              {suggestions.map((sug) => (
                <button
                  key={sug.id}
                  type="button"
                  onClick={() => handleSelectMedication(sug)}
                  className="w-full text-right p-2.5 hover:bg-peacock-mist dark:hover:bg-peacock-ink-deep/40 border-b border-slate-100/60 dark:border-slate-800/60 last:border-0 transition-colors flex items-start justify-between gap-2 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {sug.tradeName}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-peacock-pale dark:bg-peacock-ink/50 text-peacock-indigo-dark dark:text-peacock-teal-light font-bold">
                        {sug.categoryIcon} {sug.categoryAr.split('(')[0]}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5" dir="ltr">
                      {sug.scientificName}
                    </p>
                    <p className="text-[11px] text-peacock-indigo dark:text-peacock-teal font-semibold mt-1">
                      ⏰ {sug.defaultTiming}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Catalog Browser Button */}
        <button
          type="button"
          onClick={onOpenCatalog}
          className="p-2 rounded-xl bg-peacock-mist dark:bg-peacock-ink-deep/40 hover:bg-peacock-pale dark:hover:bg-peacock-ink/60 text-peacock-indigo-dark dark:text-peacock-teal-light border border-peacock-sage/80 dark:border-peacock-indigo-deep/50 cursor-pointer shrink-0 transition-colors"
          title="تصفح دليل الأدوية والمكملات"
        >
          <Search className="w-3.5 h-3.5" />
        </button>

        {/* Timing with Quick Select */}
        <div className="relative w-32 sm:w-36 shrink-0">
          <input
            type="text"
            value={item.time || ''}
            onChange={(e) => onChange({ ...item, time: e.target.value })}
            onFocus={() => setShowTimeDropdown(true)}
            className="w-full text-xs font-bold p-2 pr-2 pl-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 text-center placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-peacock-blue truncate"
            placeholder="التوقيت"
          />
          <button
            type="button"
            onClick={() => setShowTimeDropdown(!showTimeDropdown)}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
          >
            <ChevronDown className="w-3 h-3" />
          </button>

          {showTimeDropdown && (
            <div className="absolute top-full left-0 right-[-60px] sm:right-0 mt-1 z-30 bg-white dark:bg-slate-850 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 max-h-48 overflow-y-auto">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                توقيتات شائعة
              </div>
              {COMMON_TIMINGS.map((timing, tIdx) => (
                <button
                  key={tIdx}
                  type="button"
                  onClick={() => {
                    onChange({ ...item, time: timing });
                    setShowTimeDropdown(false);
                  }}
                  className="w-full text-right px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-peacock-mist dark:hover:bg-peacock-ink-deep/50 hover:text-peacock-indigo dark:hover:text-peacock-teal-light transition-colors"
                >
                  {timing}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notes Toggle Button */}
        <button
          type="button"
          onClick={() => setShowNotesField(!showNotesField)}
          className={`p-2 rounded-xl transition-colors cursor-pointer shrink-0 ${
            item.notes || showNotesField
              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="إضافة ملاحظات أو تعليمات خاصة للمريض"
        >
          <Info className="w-3.5 h-3.5" />
        </button>

        {/* Delete Button */}
        <button
          type="button"
          onClick={onRemove}
          className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl cursor-pointer transition-colors shrink-0"
          title="حذف الدواء/المكمل"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Optional Clinical Notes / Precautions */}
      {showNotesField && (
        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
            💡 تعليمات:
          </span>
          <input
            type="text"
            value={item.notes || ''}
            onChange={(e) => onChange({ ...item, notes: e.target.value })}
            placeholder="تعليمات للمتدرب (مثال: يفصل ساعتين عن الكالسيوم، يؤخذ مع كوب ماء كبير...)"
            className="flex-1 text-[11px] font-medium p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      )}
    </div>
  );
};
