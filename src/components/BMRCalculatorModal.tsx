import React, { useState, useEffect } from 'react';
import { 
 Calculator, 
 X, 
 Circle, 
 Check, 
 Flame, 
 ShieldAlert, 
 Info, 
 Scale, 
 Activity,
 Sliders,
 ChevronDown,
 ChevronUp,
 AlertTriangle,
 Heart,
 Briefcase
} from 'lucide-react';
import { 
 calculateREE_Kholoud, 
 calculateTDEE, 
 calculateTargetCaloriesKholoud, 
 calculateMacrosKholoud,
 calculateTotalCaloriesSamar,
 calculateTargetCaloriesSamar,
 calculateMacrosSamar,
 SamarWorkLevel,
 WeightGoalOption 
} from '../utils/calculations';

interface BMRCalculatorModalProps {
 initialWeight?: number | null;
 initialHeight?: number | null;
 initialAge?: number | null;
 initialGender?: 'male' | 'female';
 defaultMethod?: 'samar' | 'kholoud';
 onApplyCalories: (calories: number, protein: number, carbs: number, fats: number, notes?: string) => void;
 onClose: () => void;
}

export const BMRCalculatorModal: React.FC<BMRCalculatorModalProps> = ({
 initialWeight,
 initialHeight,
 initialAge,
 initialGender = 'female',
 defaultMethod = 'samar',
 onApplyCalories,
 onClose,
}) => {
 // اختيار طريقة الحساب (معادلة سمر أو معادلة خلود)
 const [activeMethod, setActiveMethod] = useState<'samar' | 'kholoud'>(defaultMethod);

 // ==========================================
 // حالة معادلة سمر (Samar's Formula State)
 // ==========================================
 const [samarHeight, setSamarHeight] = useState<number | ''>(initialHeight || 170);
 const [samarWorkLevel, setSamarWorkLevel] = useState<SamarWorkLevel>('light');
 const [samarGoal, setSamarGoal] = useState<WeightGoalOption>('cut_moderate');
 const [samarGender, setSamarGender] = useState<'male' | 'female'>(initialGender);

 // ==========================================
 // حالة معادلة خلود (Kholoud's Formula State)
 // ==========================================
 const [weight, setWeight] = useState<number | ''>(initialWeight || 70);
 const [height, setHeight] = useState<number | ''>(initialHeight || 170);
 const [age, setAge] = useState<number | ''>(initialAge || 30);
 const [gender, setGender] = useState<'male' | 'female'>(initialGender);
 const [kholoudGoal, setKholoudGoal] = useState<WeightGoalOption>('cut_moderate');
 const [showAdvancedActivity, setShowAdvancedActivity] = useState(false);
 const [customFactor, setCustomFactor] = useState<number>(gender === 'male'? 1.6: 1.5);
 const [proteinPerKg, setProteinPerKg] = useState<number>(1.8);
 const [fatPerKg, setFatPerKg] = useState<number>(0.8);

 // مزامنة معامل النشاط لمعادلة خلود
 useEffect(() => {
 if (!showAdvancedActivity) {
 setCustomFactor(gender === 'male'? 1.6: 1.5);
 }
 }, [gender, showAdvancedActivity]);

 useEffect(() => {
 if (kholoudGoal === 'cut_aggressive') {
 setProteinPerKg(2.0);
 setFatPerKg(0.7);
 } else if (kholoudGoal === 'cut_moderate') {
 setProteinPerKg(1.8);
 setFatPerKg(0.8);
 } else if (kholoudGoal === 'maintain') {
 setProteinPerKg(1.6);
 setFatPerKg(0.8);
 } else if (kholoudGoal === 'bulk_mild') {
 setProteinPerKg(2.0);
 setFatPerKg(0.9);
 }
 }, [kholoudGoal]);

 // ==========================================
 // 1) حسابات معادلة سمر
 // ==========================================
 const numSamarHeight = typeof samarHeight === 'number'? samarHeight: 0;
 const samarHeightValid = numSamarHeight >= 120 && numSamarHeight <= 220;
 const samarCalc = calculateTotalCaloriesSamar(numSamarHeight, samarWorkLevel);
 const samarGoalResult = calculateTargetCaloriesSamar(samarCalc.total, samarGoal, samarGender);
 const samarMacros = calculateMacrosSamar(
 samarCalc.idealWeight > 0? samarCalc.idealWeight: 70, 
 samarGoalResult.targetCalories, 
 samarGoal
 );

 const samarTotalMacrosCals = samarMacros.protein * 4 + samarMacros.carbs * 4 + samarMacros.fats * 9;
 const samarProtPct = Math.round(((samarMacros.protein * 4) / samarTotalMacrosCals) * 100) || 0;
 const samarCarbPct = Math.round(((samarMacros.carbs * 4) / samarTotalMacrosCals) * 100) || 0;
 const samarFatPct = Math.round(((samarMacros.fats * 9) / samarTotalMacrosCals) * 100) || 0;

 // ==========================================
 // 2) حسابات معادلة خلود
 // ==========================================
 const numWeight = typeof weight === 'number' && weight > 0? weight: 70;
 const numHeight = typeof height === 'number' && height > 0? height: 170;
 const numAge = typeof age === 'number' && age > 0? age: 30;

 const kholoudRee = calculateREE_Kholoud(numWeight, numHeight, numAge);
 const effectiveActivityFactor = showAdvancedActivity? customFactor: (gender === 'male'? 1.6: 1.5);
 const kholoudTdee = Math.round(kholoudRee * effectiveActivityFactor);
 const kholoudGoalResult = calculateTargetCaloriesKholoud(kholoudTdee, kholoudGoal, gender);

 const kholoudTargetProtein = Math.round(numWeight * proteinPerKg);
 const kholoudTargetFats = Math.round(numWeight * fatPerKg);
 const kholoudCaloriesFromProtAndFat = kholoudTargetProtein * 4 + kholoudTargetFats * 9;
 const kholoudRemainingForCarbs = Math.max(80, kholoudGoalResult.targetCalories - kholoudCaloriesFromProtAndFat);
 const kholoudTargetCarbs = Math.round(kholoudRemainingForCarbs / 4);

 const kholoudTotalMacrosCals = kholoudTargetProtein * 4 + kholoudTargetCarbs * 4 + kholoudTargetFats * 9;
 const kholoudProtPct = Math.round(((kholoudTargetProtein * 4) / kholoudTotalMacrosCals) * 100) || 0;
 const kholoudCarbPct = Math.round(((kholoudTargetCarbs * 4) / kholoudTotalMacrosCals) * 100) || 0;
 const kholoudFatPct = Math.round(((kholoudTargetFats * 9) / kholoudTotalMacrosCals) * 100) || 0;

 // ==========================================
 // تطبيق السعرات على الخطة
 // ==========================================
 const handleApply = () => {
 if (activeMethod === 'samar') {
 if (!samarCalc.isValid) return;
 const notes = `محسوبة وفق [معادلة سمر] (طول: ${samarHeight}سم، وزن مثالي: ${samarCalc.idealWeight}كجم، عمل: ${
 samarWorkLevel === 'light'? 'بسيط': samarWorkLevel === 'moderate'? 'متوسط': 'شاق'
 })`;
 onApplyCalories(
 samarGoalResult.targetCalories,
 samarMacros.protein,
 samarMacros.carbs,
 samarMacros.fats,
 notes
 );
 } else {
 const notes = `محسوبة وفق [معادلة خلود] (REE: ${kholoudRee} ك.س، TDEE: ${kholoudTdee} ك.س)`;
 onApplyCalories(
 kholoudGoalResult.targetCalories,
 kholoudTargetProtein,
 kholoudTargetCarbs,
 kholoudTargetFats,
 notes
 );
 }
 onClose();
 };

 // أمثلة التحقق السريع لمعادلة سمر
 const applySamarExample = (work: SamarWorkLevel, goal: WeightGoalOption = 'cut_moderate') => {
 setActiveMethod('samar');
 setSamarHeight(170);
 setSamarWorkLevel(work);
 setSamarGoal(goal);
 };

 // مثال التحقق السريع لمعادلة خلود
 const applyKholoudExample = () => {
 setActiveMethod('kholoud');
 setWeight(70);
 setHeight(170);
 setAge(30);
 setGender('male');
 setKholoudGoal('cut_moderate');
 setShowAdvancedActivity(false);
 setCustomFactor(1.6);
 };

 return (
 <div 
 className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
 dir="rtl"
 >
 <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 app-overlay-shadow my-auto max-h-[95vh] flex flex-col">
 
 {/* Header */}
 <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
 <div className="flex items-center gap-2.5">
 <div className="w-10 h-10 rounded-2xl dark: text-white flex items-center justify-center font-black">
 <Calculator className="w-5 h-5" />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h3 className="font-black text-slate-800 dark:text-slate-100 text-base sm:text-lg">
 حاسبة السعرات والماكروز 
 </h3>
 <span className="text-[12px] font-black bg-peacock-pale dark:bg-peacock-ink-deep/60 text-peacock-indigo-dark dark:text-peacock-teal-light px-2 py-0.5 rounded-md border border-peacock-sage dark:border-peacock-indigo-deep">
 لوحة الأخصائية
 </span>
 </div>
 <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
 اختر معادلة الحساب المعتمدة لحساب الاحتياج وعجز النزول وتطبيقها على الخطة
 </p>
 </div>
 </div>
 <button 
 type="button"
 onClick={onClose} 
 className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
 aria-label="إغلاق"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Method Selector Tabs (Segmented Control) */}
 <div className="pt-3 pb-2 shrink-0">
 <div className="p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 grid grid-cols-2 gap-1 border border-slate-200/80 dark:border-slate-700/60">
 <button
 type="button"
 onClick={() => setActiveMethod('samar')}
 className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
 activeMethod === 'samar'
? 'bg-white dark:bg-slate-900 text-peacock-indigo dark:text-peacock-teal dark: scale-[1.01]'
: 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
 }`}
 >
 <Circle className="w-4 h-4 text-peacock-blue" />
 <span>معادلة سمر</span>
 <span className="text-[12px] font-black bg-peacock-pale dark:bg-peacock-ink-deep/80 text-peacock-indigo-dark dark:text-peacock-teal-light px-1.5 py-0.2 rounded-md">
 الوزن المثالي
 </span>
 </button>

 <button
 type="button"
 onClick={() => setActiveMethod('kholoud')}
 className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
 activeMethod === 'kholoud'
? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 dark: scale-[1.01]'
: 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
 }`}
 >
 <Flame className="w-4 h-4 text-blue-500" />
 <span>معادلة خلود</span>
 <span className="text-[12px] font-black bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded-md">
 REE الحرق
 </span>
 </button>
 </div>
 </div>

 {/* Scrollable Content */}
 <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-0.5 pl-0.5 text-right">
 
 {/* ========================================================================= */}
 {/* SECTION: معادلة سمر (SAMAR FORMULA) */}
 {/* ========================================================================= */}
 {activeMethod === 'samar' && (
 <div className="space-y-4">
 {/* Quick verification sample bar */}
 <div className="p-2.5 rounded-2xl bg-peacock-mist/70 dark:bg-peacock-ink-deep/40 border border-peacock-sage/80 dark:border-peacock-ink/50 text-xs">
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center gap-1.5 text-peacock-ink-deep dark:text-peacock-sage">
 <Circle className="w-4 h-4 text-peacock-indigo shrink-0" />
 <span className="font-bold">أمثلة التحقق السريع من معادلة سمر (طول 170 سم):</span>
 </div>
 </div>
 <div className="flex flex-wrap gap-1.5">
 <button
 type="button"
 onClick={() => applySamarExample('light', 'cut_moderate')}
 className="text-[12px] font-black text-peacock-indigo-deep dark:text-peacock-sage bg-white dark:bg-slate-850 px-2.5 py-1 rounded-lg border border-peacock-sage dark:border-peacock-indigo-deep hover:bg-peacock-pale dark:hover:bg-peacock-ink/60 transition-colors cursor-pointer"
 >
 عمل بسيط (كلي 2065 | عجز ½كجم: 1565) 
 </button>
 <button
 type="button"
 onClick={() => applySamarExample('moderate', 'maintain')}
 className="text-[12px] font-black text-peacock-indigo-deep dark:text-peacock-sage bg-white dark:bg-slate-850 px-2.5 py-1 rounded-lg border border-peacock-sage dark:border-peacock-indigo-deep hover:bg-peacock-pale dark:hover:bg-peacock-ink/60 transition-colors cursor-pointer"
 >
 عمل متوسط (كلي 2345) 
 </button>
 <button
 type="button"
 onClick={() => applySamarExample('heavy', 'maintain')}
 className="text-[12px] font-black text-peacock-indigo-deep dark:text-peacock-sage bg-white dark:bg-slate-850 px-2.5 py-1 rounded-lg border border-peacock-sage dark:border-peacock-indigo-deep hover:bg-peacock-pale dark:hover:bg-peacock-ink/60 transition-colors cursor-pointer"
 >
 عمل شاق (كلي 3115) 
 </button>
 </div>
 </div>

 {/* Input 1: Height (Mandatory) */}
 <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
 <div className="flex items-center justify-between mb-1.5">
 <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
 <Scale className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal" />
 <span>الطول (سم): إلزامي لحساب الوزن المثالي:</span>
 </label>
 <span className="text-[12px] font-bold text-slate-500">
 النطاق المقبول: 120 - 220 سم
 </span>
 </div>
 <div className="relative">
 <input
 type="number"
 min="120"
 max="220"
 step="1"
 value={samarHeight}
 onFocus={(e) => e.target.select()}
 onChange={(e) => setSamarHeight(e.target.value === ''? '': parseFloat(e.target.value))}
 placeholder="مثال: 170"
 className={`w-full text-lg font-black p-2.5 rounded-xl border bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-center focus:ring-2 outline-hidden transition-colors ${
!samarHeightValid
? 'border-red-400 focus:ring-red-400 bg-red-50/20'
: 'border-slate-200 dark:border-slate-700 focus:ring-peacock-blue'
 }`}
 />
 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
 سم
 </span>
 </div>

 {/* Validation Warnings */}
 {(!samarHeight ||!samarHeightValid) && (
 <div className="mt-2 p-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 flex items-center gap-1.5">
 <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
 <span>
 {samarHeight === ''
? 'يرجى إدخال طول العميل (سم) لتتمكن معادلة سمر من حساب الوزن المثالي والطاقة.'
: 'الطول غير منطقي (يجب أن يكون بين 120 سم و 220 سم).'}
 </span>
 </div>
 )}

 {samarHeightValid && samarCalc.idealWeight < 40 && (
 <div className="mt-2 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
 <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
 <span>
 الوزن المثالي المحسوب ({samarCalc.idealWeight} كجم) أقل من 40 كجم وغير منطقي للاعتماد السريري.
 </span>
 </div>
 )}
 </div>

 {/* Input 2: Work/Activity Level (بسيط | متوسط | شاق) */}
 <div>
 <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
 نوع العمل / النشاط اليومي (معامل النشاط):
 </label>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
 {/* Light: 7 */}
 <button
 type="button"
 onClick={() => setSamarWorkLevel('light')}
 className={`p-3 rounded-2xl text-right border transition-all cursor-pointer ${
 samarWorkLevel === 'light'
? 'bg-peacock-mist dark:bg-peacock-ink-deep/60 border-peacock-blue ring-2 ring-peacock-blue/30 text-peacock-ink-deep dark:text-peacock-pale'
: 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
 }`}
 >
 <div className="flex items-center justify-between mb-1">
 <span className="font-black text-xs sm:text-sm">عمل بسيط</span>
 <span className="text-xs font-black px-2 py-0.5 rounded-md bg-peacock-sage/70 dark:bg-peacock-ink/60 text-peacock-indigo-deep dark:text-peacock-sage">
 معامل: 7
 </span>
 </div>
 <p className="text-[12px] text-slate-500 dark:text-slate-400">
 مكتبي، جلوس مستمر، قيادة، أنشطة خفيفة
 </p>
 </button>

 {/* Moderate: 11 */}
 <button
 type="button"
 onClick={() => setSamarWorkLevel('moderate')}
 className={`p-3 rounded-2xl text-right border transition-all cursor-pointer ${
 samarWorkLevel === 'moderate'
? 'bg-peacock-mist dark:bg-peacock-ink-deep/60 border-peacock-blue ring-2 ring-peacock-blue/30 text-peacock-ink-deep dark:text-peacock-pale'
: 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
 }`}
 >
 <div className="flex items-center justify-between mb-1">
 <span className="font-black text-xs sm:text-sm">عمل متوسط</span>
 <span className="text-xs font-black px-2 py-0.5 rounded-md bg-peacock-sage/70 dark:bg-peacock-ink/60 text-peacock-indigo-deep dark:text-peacock-sage">
 معامل: 11
 </span>
 </div>
 <p className="text-[12px] text-slate-500 dark:text-slate-400">
 وقوف مستمر، تدريس، تمريض، أعمال منزلية
 </p>
 </button>

 {/* Heavy: 22 */}
 <button
 type="button"
 onClick={() => setSamarWorkLevel('heavy')}
 className={`p-3 rounded-2xl text-right border transition-all cursor-pointer ${
 samarWorkLevel === 'heavy'
? 'bg-peacock-mist dark:bg-peacock-ink-deep/60 border-peacock-blue ring-2 ring-peacock-blue/30 text-peacock-ink-deep dark:text-peacock-pale'
: 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
 }`}
 >
 <div className="flex items-center justify-between mb-1">
 <span className="font-black text-xs sm:text-sm">عمل شاق</span>
 <span className="text-xs font-black px-2 py-0.5 rounded-md bg-peacock-sage/70 dark:bg-peacock-ink/60 text-peacock-indigo-deep dark:text-peacock-sage">
 معامل: 22
 </span>
 </div>
 <p className="text-[12px] text-slate-500 dark:text-slate-400">
 مجهود بدني عالي، عمال بناء، رياضة مكثفة
 </p>
 </button>
 </div>
 </div>

 {/* Input 3: Target Goal */}
 <div>
 <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
 الهدف من السعرات اليومية:
 </label>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
 <button
 type="button"
 onClick={() => setSamarGoal('maintain')}
 className={`p-2.5 rounded-2xl text-center border transition-all cursor-pointer ${
 samarGoal === 'maintain'
? 'bg-peacock-indigo border-peacock-indigo text-white font-black'
: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
 }`}
 >
 <span className="block text-xs font-black">تثبيت الوزن</span>
 <span className="text-[12px] opacity-80 block mt-0.5">السعرات الكلية</span>
 </button>

 <button
 type="button"
 onClick={() => setSamarGoal('cut_moderate')}
 className={`p-2.5 rounded-2xl text-center border transition-all cursor-pointer ${
 samarGoal === 'cut_moderate'
? 'bg-peacock-indigo border-peacock-indigo text-white font-black'
: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
 }`}
 >
 <span className="block text-xs font-black">خسارة ½ كجم/أسبوع</span>
 <span className="text-[12px] opacity-80 block mt-0.5">عجز −500 سعرة</span>
 </button>

 <button
 type="button"
 onClick={() => setSamarGoal('cut_aggressive')}
 className={`p-2.5 rounded-2xl text-center border transition-all cursor-pointer ${
 samarGoal === 'cut_aggressive'
? 'bg-peacock-indigo border-peacock-indigo text-white font-black'
: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
 }`}
 >
 <span className="block text-xs font-black">خسارة 1 كجم/أسبوع</span>
 <span className="text-[12px] opacity-80 block mt-0.5">عجز −1000 سعرة</span>
 </button>

 <button
 type="button"
 onClick={() => setSamarGoal('bulk_mild')}
 className={`p-2.5 rounded-2xl text-center border transition-all cursor-pointer ${
 samarGoal === 'bulk_mild'
? 'bg-peacock-indigo border-peacock-indigo text-white font-black'
: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
 }`}
 >
 <span className="block text-xs font-black">زيادة معتدلة</span>
 <span className="text-[12px] opacity-80 block mt-0.5">فائض +300 سعرة</span>
 </button>
 </div>
 </div>

 {/* Optional Gender (For safety floor & macros) */}
 <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
 <div>
 <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
 الجنس (اختياري للحد الأدنى الآمن وتوزيع الماكروز):
 </span>
 <span className="text-[12px] text-slate-400 block">
 معادلة سمر مبنية على الوزن المثالي وليس الجنس، ويُستخدم الجنس هنا لضمان عدم الهبوط عن السقف الآمن.
 </span>
 </div>
 <div className="flex items-center gap-1 shrink-0">
 <button
 type="button"
 onClick={() => setSamarGender('female')}
 className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
 samarGender === 'female'
? 'bg-pink-600 text-white'
: 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
 }`}
 >
 أنثى (1200+)
 </button>
 <button
 type="button"
 onClick={() => setSamarGender('male')}
 className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
 samarGender === 'male'
? 'bg-blue-600 text-white'
: 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
 }`}
 >
 ذكر (1500+)
 </button>
 </div>
 </div>

 {/* ========================================================================= */}
 {/* RESULTS CARD (SAMAR FORMULA) */}
 {/* ========================================================================= */}
 {samarCalc.isValid && (
 <div className="space-y-3">
 {/* Big Target Calories Display */}
 <div className="p-4 rounded-3xl bg-peacock-mist/80 dark:bg-peacock-ink-deep/30 border-2 border-peacock-teal dark:border-peacock-indigo">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <div>
 <div className="flex items-center gap-1.5 text-xs font-black text-peacock-indigo-deep dark:text-peacock-teal-light">
 <Flame className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal fill-current" />
 <span>السعرات اليومية المستهدفة (معادلة سمر):</span>
 </div>
 <div className="flex items-baseline gap-2 mt-1">
 <span className="text-2xl font-black text-peacock-ink-deep dark:text-peacock-pale font-mono tracking-tight">
 {samarGoalResult.targetCalories}
 </span>
 <span className="text-sm font-black text-peacock-indigo-dark dark:text-peacock-teal">
 كيلو كالوري / يوم
 </span>
 </div>
 </div>

 <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-1 text-xs">
 <span className="font-bold text-slate-600 dark:text-slate-300">
 السعرات الكلية: <strong className="font-mono font-black text-slate-800 dark:text-slate-100">{samarCalc.total}</strong> ك.س
 </span>
 <span className="font-bold text-peacock-indigo-dark dark:text-peacock-teal-light">
 {samarGoalResult.deficitOrSurplus < 0? (
 <>عجز: <span className="font-mono">{samarGoalResult.deficitOrSurplus}</span> ك.س</>
 ): samarGoalResult.deficitOrSurplus > 0? (
 <>فائض: <span className="font-mono">+{samarGoalResult.deficitOrSurplus}</span> ك.س</>
 ): (
 'تثبيت الوزن بدون عجز'
 )}
 </span>
 </div>
 </div>

 {/* Safe floor notice if raised */}
 {samarGoalResult.isBelowSafeFloor && (
 <div className="mt-3 p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
 <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
 <span>
 <strong>تنبيه الأمان الطبي:</strong> كان العجز المحسوب ({samarGoalResult.rawCalories} ك.س) سينزل عن الحد الأدنى الآمن ({samarGoalResult.safeFloor} ك.س)، فتم تثبيت السعرات تلقائياً عند {samarGoalResult.safeFloor} ك.س لحماية الصحة.
 </span>
 </div>
 )}
 </div>

 {/* Step-by-Step Breakdown (1 to 5) */}
 <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
 <div className="font-black text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700/60 pb-1.5 flex items-center justify-between">
 <span>تفكيك خطوات معادلة سمر:</span>
 <span className="text-[12px] font-mono text-peacock-indigo dark:text-peacock-teal">
 الطول: {numSamarHeight} سم
 </span>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
 {/* Step 1 */}
 <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
 <span className="font-bold text-slate-500 block text-[12px]">1) الوزن المثالي:</span>
 <div className="font-mono font-black text-slate-800 dark:text-slate-100 text-xs mt-0.5">
 {numSamarHeight} − 100 = <span className="text-peacock-indigo dark:text-peacock-teal">{samarCalc.idealWeight} كجم</span>
 </div>
 </div>

 {/* Step 2 */}
 <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
 <span className="font-bold text-slate-500 block text-[12px]">2) الطاقة الأساسية:</span>
 <div className="font-mono font-black text-slate-800 dark:text-slate-100 text-xs mt-0.5">
 {samarCalc.idealWeight} × 22.5 = <span className="text-peacock-indigo dark:text-peacock-teal">{samarCalc.basal} ك.س</span>
 </div>
 </div>

 {/* Step 3 */}
 <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
 <span className="font-bold text-slate-500 block text-[12px]">3) طاقة النشاط ({samarWorkLevel === 'light'? 'بسيط: 7': samarWorkLevel === 'moderate'? 'متوسط: 11': 'شاق: 22'}):</span>
 <div className="font-mono font-black text-slate-800 dark:text-slate-100 text-xs mt-0.5">
 {samarCalc.idealWeight} × {samarCalc.activityCoefficient} = <span className="text-peacock-indigo dark:text-peacock-teal">{samarCalc.activity} ك.س</span>
 </div>
 </div>

 {/* Step 4 */}
 <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
 <span className="font-bold text-slate-500 block text-[12px]">4) السعرات الكلية:</span>
 <div className="font-mono font-black text-slate-800 dark:text-slate-100 text-xs mt-0.5">
 {samarCalc.basal} + {samarCalc.activity} = <span className="text-peacock-indigo dark:text-peacock-teal">{samarCalc.total} ك.س</span>
 </div>
 </div>
 </div>

 {/* Educational Rule Line (Literal Prompt Mandate) */}
 <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700/60 text-center">
 <code className="text-[12px] font-mono font-bold text-peacock-indigo-deep dark:text-peacock-teal-light bg-peacock-mist dark:bg-peacock-ink-deep/60 px-2 py-1 rounded-lg border border-peacock-sage dark:border-peacock-indigo-deep/60 inline-block">
 الوزن المثالي = الطول − 100 | الأساسية = المثالي × 22.5 | النشاط = المثالي × 7/11/22
 </code>
 </div>
 </div>

 {/* Suggested Macros for Samar */}
 <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
 <div className="flex items-center justify-between mb-2">
 <span className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
 <Sliders className="w-3.5 h-3.5 text-peacock-indigo" />
 <span>اقتراح توزيع الماكروز (مبني على الوزن المثالي {samarCalc.idealWeight} كجم):</span>
 </span>
 </div>

 <div className="grid grid-cols-3 gap-2 text-center">
 {/* Protein */}
 <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/70">
 <div className="flex items-center justify-center gap-1 text-blue-700 dark:text-blue-400 text-xs font-black">
 <span></span>
 <span>بروتين</span>
 </div>
 <strong className="text-base font-black text-slate-800 dark:text-slate-100 block mt-0.5 font-mono">
 {samarMacros.protein} جم
 </strong>
 <span className="text-[12px] font-bold text-slate-400">
 {samarMacros.protein * 4} ك.س ({samarProtPct}%)
 </span>
 </div>

 {/* Carbs */}
 <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-peacock-sage dark:border-peacock-ink/70">
 <div className="flex items-center justify-center gap-1 text-peacock-indigo-dark dark:text-peacock-teal text-xs font-black">
 <span></span>
 <span>نشويات</span>
 </div>
 <strong className="text-base font-black text-slate-800 dark:text-slate-100 block mt-0.5 font-mono">
 {samarMacros.carbs} جم
 </strong>
 <span className="text-[12px] font-bold text-slate-400">
 {samarMacros.carbs * 4} ك.س ({samarCarbPct}%)
 </span>
 </div>

 {/* Fats */}
 <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/70">
 <div className="flex items-center justify-center gap-1 text-amber-700 dark:text-amber-400 text-xs font-black">
 <span></span>
 <span>دهون</span>
 </div>
 <strong className="text-base font-black text-slate-800 dark:text-slate-100 block mt-0.5 font-mono">
 {samarMacros.fats} جم
 </strong>
 <span className="text-[12px] font-bold text-slate-400">
 {samarMacros.fats * 9} ك.س ({samarFatPct}%)
 </span>
 </div>
 </div>
 </div>

 {/* Medical Disclaimer Note (Literal Mandate) */}
 <div className="p-2.5 rounded-2xl bg-peacock-mist/60 dark:bg-peacock-ink-deep/30 border border-peacock-sage/80 dark:border-peacock-ink/50 text-[12px] text-peacock-ink dark:text-peacock-sage flex items-start gap-1.5">
 <Info className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal shrink-0 mt-0.5" />
 <span>
 <strong>تنويه:</strong> «معادلة سمر تقدير إرشادي حسب الوزن المثالي (الطول−100) ويُراجع حسب الحالة ومعدل الالتزام والنزول الأسبوعي».
 </span>
 </div>
 </div>
 )}
 </div>
 )}

 {/* ========================================================================= */}
 {/* SECTION: معادلة خلود (KHOLOUD FORMULA) */}
 {/* ========================================================================= */}
 {activeMethod === 'kholoud' && (
 <div className="space-y-4">
 {/* Quick verification sample bar */}
 <div className="flex items-center justify-between p-2.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/50 text-xs">
 <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200">
 <Circle className="w-4 h-4 text-indigo-600 shrink-0" />
 <span className="font-bold">تحقق سريع من حسابات معادلة خلود:</span>
 </div>
 <button
 type="button"
 onClick={applyKholoudExample}
 className="text-[12px] font-black text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-850 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
 >
 تجربة مثال (70 كجم | 170 سم | 30 سنة | ذكر) 
 </button>
 </div>

 {/* Gender Selection */}
 <div>
 <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
 الجنس ومعامل النشاط المعتمد:
 </label>
 <div className="grid grid-cols-2 gap-2.5">
 <button
 type="button"
 onClick={() => setGender('female')}
 className={`py-3 px-3 rounded-2xl text-xs font-black transition-all flex flex-col items-center justify-center gap-1 border cursor-pointer ${
 gender === 'female'
? 'bg-pink-600 border-pink-600 text-white scale-[1.01]'
: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
 }`}
 >
 <div className="flex items-center gap-1.5 text-sm">
 <span></span>
 <span>أنثى</span>
 </div>
 <span className={`text-[12px] font-bold ${gender === 'female'? 'text-pink-100': 'text-slate-500 dark:text-slate-400'}`}>
 1.5 أنثى: نشاط متوسط عام
 </span>
 </button>

 <button
 type="button"
 onClick={() => setGender('male')}
 className={`py-3 px-3 rounded-2xl text-xs font-black transition-all flex flex-col items-center justify-center gap-1 border cursor-pointer ${
 gender === 'male'
? 'bg-blue-600 border-blue-600 text-white scale-[1.01]'
: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
 }`}
 >
 <div className="flex items-center gap-1.5 text-sm">
 <span></span>
 <span>ذكر</span>
 </div>
 <span className={`text-[12px] font-bold ${gender === 'male'? 'text-blue-100': 'text-slate-500 dark:text-slate-400'}`}>
 1.6 ذكر: نشاط متوسط عام
 </span>
 </button>
 </div>
 </div>

 {/* Physical Measurements Inputs */}
 <div className="grid grid-cols-3 gap-2.5">
 <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
 <label className="block text-[12px] font-black text-slate-600 dark:text-slate-300 mb-1">
 الوزن (كجم)
 </label>
 <input
 type="number"
 min="30"
 max="250"
 step="0.5"
 value={weight}
 onFocus={(e) => e.target.select()}
 onChange={(e) => setWeight(e.target.value === ''? '': parseFloat(e.target.value))}
 placeholder="70"
 className="w-full text-base font-black p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-center focus:ring-2 focus:ring-blue-500 outline-hidden"
 />
 </div>

 <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
 <label className="block text-[12px] font-black text-slate-600 dark:text-slate-300 mb-1">
 الطول (سم)
 </label>
 <input
 type="number"
 min="120"
 max="230"
 step="1"
 value={height}
 onFocus={(e) => e.target.select()}
 onChange={(e) => setHeight(e.target.value === ''? '': parseFloat(e.target.value))}
 placeholder="170"
 className="w-full text-base font-black p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-center focus:ring-2 focus:ring-blue-500 outline-hidden"
 />
 </div>

 <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
 <label className="block text-[12px] font-black text-slate-600 dark:text-slate-300 mb-1">
 العمر (سنة)
 </label>
 <input
 type="number"
 min="12"
 max="100"
 step="1"
 value={age}
 onFocus={(e) => e.target.select()}
 onChange={(e) => setAge(e.target.value === ''? '': parseInt(e.target.value))}
 placeholder="30"
 className="w-full text-base font-black p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-center focus:ring-2 focus:ring-blue-500 outline-hidden"
 />
 </div>
 </div>

 {/* Advanced Activity Factor Option */}
 <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70 text-xs">
 <button
 type="button"
 onClick={() => setShowAdvancedActivity(!showAdvancedActivity)}
 className="w-full flex items-center justify-between font-bold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
 >
 <div className="flex items-center gap-1.5">
 <Activity className="w-3.5 h-3.5 text-blue-600" />
 <span>تخصيص معامل النشاط يدوياً (اختياري)</span>
 </div>
 {showAdvancedActivity? <ChevronUp className="w-4 h-4" />: <ChevronDown className="w-4 h-4" />}
 </button>

 {showAdvancedActivity && (
 <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-700 flex items-center gap-3">
 <input
 type="range"
 min="1.2"
 max="1.9"
 step="0.05"
 value={customFactor}
 onChange={(e) => setCustomFactor(parseFloat(e.target.value))}
 className="flex-1 accent-blue-600 cursor-pointer"
 />
 <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm w-12 text-center">
 × {customFactor.toFixed(2)}
 </span>
 </div>
 )}
 </div>

 {/* Kholoud REE / TDEE Live Breakdown */}
 <div className="grid grid-cols-2 gap-2.5">
 <div className="p-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60">
 <div className="flex items-center justify-between text-xs text-blue-950 dark:text-blue-200">
 <span className="font-bold">معدل الحرق الأساسي (REE)</span>
 <span className="text-[12px] bg-blue-200/60 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded-sm font-mono">
 صيغة موحدة
 </span>
 </div>
 <div className="mt-1 flex items-baseline gap-1">
 <span className="text-2xl font-black font-mono text-blue-700 dark:text-blue-300">
 {kholoudRee}
 </span>
 <span className="text-[12px] font-bold text-slate-500">ك.س/يوم</span>
 </div>
 <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 truncate">
 (9.99×{numWeight}) + (6.25×{numHeight}) − (4.92×{numAge})
 </p>
 </div>

 <div className="p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60">
 <div className="flex items-center justify-between text-xs text-indigo-950 dark:text-indigo-200">
 <span className="font-bold">إجمالي الاحتياج (TDEE)</span>
 <span className="text-[12px] bg-indigo-200/60 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-300 px-1.5 py-0.5 rounded-sm font-mono">
 × {effectiveActivityFactor}
 </span>
 </div>
 <div className="mt-1 flex items-baseline gap-1">
 <span className="text-2xl font-black font-mono text-indigo-700 dark:text-indigo-300">
 {kholoudTdee}
 </span>
 <span className="text-[12px] font-bold text-slate-500">ك.س/يوم</span>
 </div>
 <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 truncate">
 الحرق × {effectiveActivityFactor} ({gender === 'male'? 'ذكر': 'أنثى'})
 </p>
 </div>
 </div>

 {/* Goal Selection for Kholoud */}
 <div>
 <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
 الهدف من السعرات:
 </label>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
 <button
 type="button"
 onClick={() => setKholoudGoal('maintain')}
 className={`p-2.5 rounded-2xl text-center border transition-all cursor-pointer ${
 kholoudGoal === 'maintain'
? 'bg-blue-600 border-blue-600 text-white font-black'
: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
 }`}
 >
 <span className="block text-xs font-black">تثبيت الوزن</span>
 <span className="text-[12px] opacity-80 block mt-0.5">بدون عجز (TDEE)</span>
 </button>

 <button
 type="button"
 onClick={() => setKholoudGoal('cut_moderate')}
 className={`p-2.5 rounded-2xl text-center border transition-all cursor-pointer ${
 kholoudGoal === 'cut_moderate'
? 'bg-blue-600 border-blue-600 text-white font-black'
: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
 }`}
 >
 <span className="block text-xs font-black">خسارة ½ كجم/أسبوع</span>
 <span className="text-[12px] opacity-80 block mt-0.5">عجز −500 سعرة</span>
 </button>

 <button
 type="button"
 onClick={() => setKholoudGoal('cut_aggressive')}
 className={`p-2.5 rounded-2xl text-center border transition-all cursor-pointer ${
 kholoudGoal === 'cut_aggressive'
? 'bg-blue-600 border-blue-600 text-white font-black'
: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
 }`}
 >
 <span className="block text-xs font-black">خسارة 1 كجم/أسبوع</span>
 <span className="text-[12px] opacity-80 block mt-0.5">عجز −1000 سعرة</span>
 </button>

 <button
 type="button"
 onClick={() => setKholoudGoal('bulk_mild')}
 className={`p-2.5 rounded-2xl text-center border transition-all cursor-pointer ${
 kholoudGoal === 'bulk_mild'
? 'bg-blue-600 border-blue-600 text-white font-black'
: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
 }`}
 >
 <span className="block text-xs font-black">زيادة معتدلة</span>
 <span className="text-[12px] opacity-80 block mt-0.5">فائض +300 سعرة</span>
 </button>
 </div>
 </div>

 {/* Kholoud Results Box */}
 <div className="p-4 rounded-3xl bg-[var(--app-card-muted)] border-2 border-blue-400 dark:border-blue-600">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <div>
 <div className="flex items-center gap-1.5 text-xs font-black text-blue-800 dark:text-blue-300">
 <Flame className="w-4 h-4 text-blue-600 dark:text-blue-400 fill-current" />
 <span>السعرات اليومية المستهدفة (معادلة خلود):</span>
 </div>
 <div className="flex items-baseline gap-2 mt-1">
 <span className="text-2xl font-black text-blue-950 dark:text-blue-100 font-mono tracking-tight">
 {kholoudGoalResult.targetCalories}
 </span>
 <span className="text-sm font-black text-blue-700 dark:text-blue-400">
 كيلو كالوري / يوم
 </span>
 </div>
 </div>

 <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-1 text-xs">
 <span className="font-bold text-slate-600 dark:text-slate-300">
 TDEE: <strong className="font-mono font-black text-slate-800 dark:text-slate-100">{kholoudTdee}</strong> ك.س
 </span>
 <span className="font-bold text-blue-700 dark:text-blue-300">
 {kholoudGoalResult.deficitOrSurplus < 0? (
 <>عجز: <span className="font-mono">{kholoudGoalResult.deficitOrSurplus}</span> ك.س</>
 ): kholoudGoalResult.deficitOrSurplus > 0? (
 <>فائض: <span className="font-mono">+{kholoudGoalResult.deficitOrSurplus}</span> ك.س</>
 ): (
 'تثبيت الوزن'
 )}
 </span>
 </div>
 </div>

 {kholoudGoalResult.isBelowSafeFloor && (
 <div className="mt-3 p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
 <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
 <span>
 <strong>تنبيه الأمان الطبي:</strong> السعرات المحسوبة بالعجز ({kholoudGoalResult.rawCalories} ك.س) هبطت تحت الحد الأدنى الآمن ({kholoudGoalResult.safeFloor} ك.س للـ{gender === 'male'? 'ذكر': 'أنثى'})، فتم تثبيت السعرات تلقائياً عند السقف الآمن.
 </span>
 </div>
 )}
 </div>

 {/* Macros Breakdown for Kholoud */}
 <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
 <div className="flex items-center justify-between mb-2">
 <span className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
 <Sliders className="w-3.5 h-3.5 text-blue-600" />
 <span>الماكروز المقترحة وفق معادلة خلود:</span>
 </span>
 </div>

 <div className="grid grid-cols-3 gap-2 text-center">
 <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/70">
 <div className="flex items-center justify-center gap-1 text-blue-700 dark:text-blue-400 text-xs font-black">
 <span></span>
 <span>بروتين</span>
 </div>
 <strong className="text-base font-black text-slate-800 dark:text-slate-100 block mt-0.5 font-mono">
 {kholoudTargetProtein} جم
 </strong>
 <span className="text-[12px] font-bold text-slate-400">
 {kholoudTargetProtein * 4} ك.س ({kholoudProtPct}%)
 </span>
 </div>

 <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-peacock-sage dark:border-peacock-ink/70">
 <div className="flex items-center justify-center gap-1 text-peacock-indigo-dark dark:text-peacock-teal text-xs font-black">
 <span></span>
 <span>نشويات</span>
 </div>
 <strong className="text-base font-black text-slate-800 dark:text-slate-100 block mt-0.5 font-mono">
 {kholoudTargetCarbs} جم
 </strong>
 <span className="text-[12px] font-bold text-slate-400">
 {kholoudTargetCarbs * 4} ك.س ({kholoudCarbPct}%)
 </span>
 </div>

 <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/70">
 <div className="flex items-center justify-center gap-1 text-amber-700 dark:text-amber-400 text-xs font-black">
 <span></span>
 <span>دهون</span>
 </div>
 <strong className="text-base font-black text-slate-800 dark:text-slate-100 block mt-0.5 font-mono">
 {kholoudTargetFats} جم
 </strong>
 <span className="text-[12px] font-bold text-slate-400">
 {kholoudTargetFats * 9} ك.س ({kholoudFatPct}%)
 </span>
 </div>
 </div>
 </div>

 {/* Medical Disclaimer Note */}
 <div className="p-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-[12px] text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
 <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
 <span>
 <strong>تنويه:</strong> التقدير إرشادي ويُراجع ويُعدل حسب الحالة الطبية للمتدرب، الفحوصات المخبرية، ومعدل الالتزام والنزول الفعلي أسبوعياً.
 </span>
 </div>
 </div>
 )}

 </div>

 {/* Footer Actions */}
 <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
 <button
 type="button"
 onClick={onClose}
 className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
 >
 إلغاء
 </button>

 <button
 type="button"
 onClick={handleApply}
 disabled={activeMethod === 'samar' &&!samarCalc.isValid}
 className={`px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
 activeMethod === 'samar' &&!samarCalc.isValid
? 'opacity-40 cursor-not-allowed bg-slate-400 text-white'
: activeMethod === 'samar'
? 'bg-peacock-indigo hover:bg-peacock-indigo-dark text-white'
: 'bg-blue-600 hover:bg-blue-700 text-white'
 }`}
 >
 <Check className="w-4 h-4" />
 <span>
 تطبيق الناتج على الخطة ({
 activeMethod === 'samar' 
? (samarCalc.isValid? `${samarGoalResult.targetCalories} ك.س`: 'الطول غير صالح')
: `${kholoudGoalResult.targetCalories} ك.س`
 }) 
 </span>
 </button>
 </div>

 </div>
 </div>
 );
};
