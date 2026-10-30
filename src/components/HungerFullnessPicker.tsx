import React, { useState } from 'react';
import { 
 Scale, 
 ChevronDown, 
 ChevronUp, 
 Info, 
 Circle, 
 AlertTriangle, 
 CheckCircle2, 
 RotateCcw,
 HeartHandshake
} from 'lucide-react';
import { HUNGER_FULLNESS_SCALE, getHungerInfo } from '../utils/hungerScale';
import { BRAND } from '../config/brand';

interface HungerFullnessPickerProps {
 hungerBefore?: number | null;
 fullnessAfter?: number | null;
 onChange: (updates: { hungerBefore?: number | null; fullnessAfter?: number | null }) => void;
}

export const HungerFullnessPicker: React.FC<HungerFullnessPickerProps> = ({
 hungerBefore,
 fullnessAfter,
 onChange,
}) => {
 const [isOpen, setIsOpen] = useState(false);
 const [activeTab, setActiveTab] = useState<'before' | 'after'>('before');

 const beforeInfo = getHungerInfo(hungerBefore);
 const afterInfo = getHungerInfo(fullnessAfter);

 const hasAnyLogged =!!beforeInfo ||!!afterInfo;

 const handleSelectLevel = (level: number) => {
 if (activeTab === 'before') {
 const nextVal = hungerBefore === level? null: level;
 onChange({ hungerBefore: nextVal });
 // If user selected before and after is not yet set, gently switch tab or keep
 if (nextVal!== null &&!fullnessAfter) {
 // keep or let them feel the selection
 }
 } else {
 const nextVal = fullnessAfter === level? null: level;
 onChange({ fullnessAfter: nextVal });
 }
 };

 const currentActiveInfo = activeTab === 'before'? beforeInfo: afterInfo;

 return (
 <div className="mt-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40 overflow-hidden transition-all">
 {/* Accordion Toggle Bar */}
 <button
 type="button"
 onClick={() => setIsOpen(!isOpen)}
 className="w-full px-3 py-2.5 flex items-center justify-between text-right hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
 >
 <div className="flex items-center gap-2">
 <div className="w-6 h-6 rounded-lg bg-peacock-pale dark:bg-peacock-ink-deep/60 text-peacock-indigo-dark dark:text-peacock-teal-light flex items-center justify-center">
 <Scale className="w-3.5 h-3.5" />
 </div>
 <div>
 <div className="flex items-center gap-1.5">
 <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
 مقياس الجوع والشبع (1-10)
 </span>
 <span className="text-[12px] font-bold px-1.5 py-0.2 rounded-md bg-peacock-blue/10 text-peacock-indigo-dark dark:text-peacock-teal-light border border-peacock-blue/20">
 أكل واعي 
 </span>
 </div>
 {hasAnyLogged? (
 <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
 {beforeInfo && (
 <span className="flex items-center gap-1 text-peacock-indigo-dark dark:text-peacock-teal-light">
 <span>قبل:</span>
 <strong>{beforeInfo.level}/10</strong>
 <span>({beforeInfo.emoji})</span>
 </span>
 )}
 {beforeInfo && afterInfo && <span className="text-slate-300 dark:text-slate-600">•</span>}
 {afterInfo && (
 <span className="flex items-center gap-1 text-peacock-indigo dark:text-peacock-teal-light">
 <span>بعد:</span>
 <strong>{afterInfo.level}/10</strong>
 <span>({afterInfo.emoji})</span>
 </span>
 )}
 </div>
 ): (
 <span className="text-[12px] text-slate-400 block mt-0.5">
 سجّل إحساسك بالجوع قبل الأكل والشبع بعده لتقييم الوعي الغذائي
 </span>
 )}
 </div>
 </div>

 <div className="flex items-center gap-1 text-slate-400">
 <span className="text-[12px] font-medium hidden sm:inline">
 {isOpen? 'إخفاء المقياس': 'تسجيل (قبل / بعد)'}
 </span>
 {isOpen? <ChevronUp className="w-4 h-4" />: <ChevronDown className="w-4 h-4" />}
 </div>
 </button>

 {/* Expanded Selection Body */}
 {isOpen && (
 <div className="p-3 sm:p-3.5 border-t border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 space-y-3 animate-in slide-in-from-top duration-150">
 {/* Tabs: Before Meal vs After Meal */}
 <div className="flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/50">
 <button
 type="button"
 onClick={() => setActiveTab('before')}
 className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
 activeTab === 'before'
? 'bg-white dark:bg-slate-900 text-peacock-indigo-dark dark:text-peacock-teal-light'
: 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
 }`}
 >
 <span> قبل الأكل (الجوع)</span>
 {beforeInfo? (
 <span className="px-1.5 py-0.2 rounded-full bg-peacock-pale dark:bg-peacock-ink-deep text-peacock-indigo-dark dark:text-peacock-teal-light text-[12px]">
 {beforeInfo.level}/10
 </span>
 ): (
 <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
 )}
 </button>

 <button
 type="button"
 onClick={() => setActiveTab('after')}
 className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
 activeTab === 'after'
? 'bg-white dark:bg-slate-900 text-peacock-indigo dark:text-peacock-teal-light'
: 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
 }`}
 >
 <span> بعد الأكل (الشبع)</span>
 {afterInfo? (
 <span className="px-1.5 py-0.2 rounded-full bg-peacock-pale dark:bg-peacock-ink-deep text-peacock-indigo dark:text-peacock-teal-light text-[12px]">
 {afterInfo.level}/10
 </span>
 ): (
 <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
 )}
 </button>
 </div>

 {/* Subtitle / Prompt */}
 <div className="flex items-center justify-between text-[12px]">
 <span className="font-bold text-slate-700 dark:text-slate-300">
 {activeTab === 'before'
? 'كم كان مقياس جوعك قبل بدء الوجبة؟ (1 = قارص | 3-4 = مثالي للبدء):'
: 'كم مقياس شبعك الآن بعد الانتهاء؟ (6-7 = مثالي ومريح | 10 = تخمة مؤلمة):'}
 </span>

 {/* Clear button for current active */}
 {currentActiveInfo && (
 <button
 type="button"
 onClick={() => {
 if (activeTab === 'before') onChange({ hungerBefore: null });
 else onChange({ fullnessAfter: null });
 }}
 className="text-[12px] text-rose-500 hover:text-rose-700 font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
 >
 <RotateCcw className="w-2.5 h-2.5" />
 مسح
 </button>
 )}
 </div>

 {/* 10-Step Scale Buttons */}
 <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
 {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
 const item = HUNGER_FULLNESS_SCALE[num];
 const isSelected =
 activeTab === 'before'? hungerBefore === num: fullnessAfter === num;

 return (
 <button
 key={num}
 type="button"
 onClick={() => handleSelectLevel(num)}
 className={`py-2 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer select-none ${
 isSelected
? `${item.colorClasses.activeRing} scale-105 font-black`
: `${item.colorClasses.bg} ${item.colorClasses.text} border ${item.colorClasses.border} hover:opacity-80 font-bold`
 }`}
 title={item.label}
 >
 <span className="text-xs sm:text-sm">{num}</span>
 <span className="text-[12px] leading-none mt-0.5 opacity-90">{item.emoji}</span>
 </button>
 );
 })}
 </div>

 {/* Active Level Feedback & Clinical Advice */}
 {currentActiveInfo? (
 <div
 className={`p-3 rounded-2xl border transition-all ${currentActiveInfo.colorClasses.bg} ${currentActiveInfo.colorClasses.border} space-y-1.5`}
 >
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-1.5 font-black text-xs text-slate-900 dark:text-slate-100">
 <span className="text-base">{currentActiveInfo.emoji}</span>
 <span>{currentActiveInfo.label}</span>
 </div>
 <span
 className={`text-[12px] font-bold px-2 py-0.5 rounded-full border ${currentActiveInfo.colorClasses.badge}`}
 >
 {currentActiveInfo.zone === 'ideal'
? 'نطاق مثالي وصحي '
: currentActiveInfo.zone === 'neutral'
? 'نطاق محايد '
: currentActiveInfo.zone === 'warning'
? 'انتبه لمؤشرات جسمك '
: 'نطاق غير مفضل '}
 </span>
 </div>

 <p className="text-[12px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
 {currentActiveInfo.description}
 </p>

 <div className="pt-1 border-t border-slate-200/60 dark:border-slate-700/60 flex items-start gap-1.5 text-[12px] text-slate-600 dark:text-slate-300">
 <Circle className="w-3.5 h-3.5 text-peacock-indigo shrink-0 mt-0.5" />
 <span className="font-semibold">
 <strong>نصيحة {BRAND.doctorName}:</strong> {currentActiveInfo.clinicalTip}
 </span>
 </div>
 </div>
 ): (
 <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 text-[12px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
 <span className="flex items-center gap-1.5">
 <Info className="w-3.5 h-3.5 text-slate-400" />
 <span>
 {activeTab === 'before'
? 'اضغطي على رقم (1-10) لتقييم شعورك بالجوع قبل البدء'
: 'اضغطي على رقم (1-10) لتقييم شعورك بالشبع بعد الانتهاء'}
 </span>
 </span>
 <span className="text-[12px] font-bold text-peacock-indigo dark:text-peacock-teal">
 النطاق المثالي: {activeTab === 'before'? '3 - 4': '6 - 7'}
 </span>
 </div>
 )}
 </div>
 )}
 </div>
 );
};
