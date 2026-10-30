import React, { useState } from 'react';
import {
 Calculator,
 X,
 Circle,
 Check,
 Flame,
 Ruler,
 Droplets,
 Timer,
 Zap,
 Info,
 Scale,
 Activity,
 Heart,
 TrendingDown,
 TrendingUp,
 Award,
 ShieldAlert,
 Dumbbell
} from 'lucide-react';
import {
 Gender,
 ActivityLevel,
 PAL_FACTORS,
 calculateAllBMRFormulas,
 calculateUSNavyBodyFat,
 calculateIBW,
 calculateABW,
 calculateBMI,
 calculateWHtR,
 calculateDailyFluid,
 calculatePeriWorkoutNutrition,
 calculateTargetTimeline,
} from '../utils/clinicalCalculators';

interface ClinicalCalculatorSuiteModalProps {
 initialWeight?: number | null;
 initialHeight?: number | null;
 initialAge?: number | null;
 initialGender?: Gender;
 onApplyCalories: (calories: number, protein: number, carbs: number, fats: number, notesInfo?: string) => void;
 onClose: () => void;
}

export const ClinicalCalculatorSuiteModal: React.FC<ClinicalCalculatorSuiteModalProps> = ({
 initialWeight,
 initialHeight,
 initialAge,
 initialGender,
 onApplyCalories,
 onClose,
}) => {
 // Navigation tab inside Calculator Suite
 const [activeTab, setActiveTab] = useState<'bmr_tdee' | 'body_comp' | 'macros_fluid' | 'timeline'>('bmr_tdee');

 // Core Physical Parameters
 const [weight, setWeight] = useState<number | ''>(initialWeight || 80);
 const [height, setHeight] = useState<number | ''>(initialHeight || 175);
 const [age, setAge] = useState<number | ''>(initialAge || 28);
 const [gender, setGender] = useState<Gender>(initialGender || 'male');
 const [activity, setActivity] = useState<ActivityLevel>('light');
 const [bodyFat, setBodyFat] = useState<number | ''>(18);

 // Selected Formula Choice for TDEE
 const [selectedFormula, setSelectedFormula] = useState<'mifflin' | 'harris' | 'katch' | 'cunningham'>('mifflin');

 // Goal & Calorie Deficit/Surplus Adjustment
 const [goalPreset, setGoalPreset] = useState<'cut_aggressive' | 'cut_moderate' | 'maintain' | 'bulk_clean' | 'custom'>('cut_moderate');
 const [customKcalDelta, setCustomKcalDelta] = useState<number | ''>(-450);

 // Body Comp Tape Measurement inputs (US Navy Method)
 const [neckCm, setNeckCm] = useState<number | ''>(39);
 const [waistCm, setWaistCm] = useState<number | ''>(86);
 const [hipCm, setHipCm] = useState<number | ''>(98);

 // Macros Calculation Mode
 const [macroMode, setMacroMode] = useState<'percent' | 'g_per_kg'>('g_per_kg');

 // Percent Mode Values
 const [carbPercent, setCarbPercent] = useState<number | ''>(45);
 const [proteinPercent, setProteinPercent] = useState<number | ''>(30);
 const [fatPercent, setFatPercent] = useState<number | ''>(25);

 // Grams/Kg Mode Values
 const [proteinGPerKg, setProteinGPerKg] = useState<number | ''>(2.0); // 2g/kg
 const [fatGPerKg, setFatGPerKg] = useState<number | ''>(0.9); // 0.9g/kg

 // Hydration extra activity
 const [workoutHoursPerWeek, setWorkoutHoursPerWeek] = useState<number | ''>(4);

 // Timeline target weight
 const [targetWeightKg, setTargetWeightKg] = useState<number | ''>(
 (initialWeight || 80) - 8 > 40? (initialWeight || 80) - 8: 70
 );

 // Numeric values for calculation functions
 const numWeight = typeof weight === 'number'? weight: 0;
 const numHeight = typeof height === 'number'? height: 0;
 const numAge = typeof age === 'number'? age: 0;
 const numBodyFat = typeof bodyFat === 'number'? bodyFat: undefined;
 const numNeckCm = typeof neckCm === 'number'? neckCm: 0;
 const numWaistCm = typeof waistCm === 'number'? waistCm: 0;
 const numHipCm = typeof hipCm === 'number'? hipCm: undefined;
 const numCarbPercent = typeof carbPercent === 'number'? carbPercent: 0;
 const numProteinPercent = typeof proteinPercent === 'number'? proteinPercent: 0;
 const numFatPercent = typeof fatPercent === 'number'? fatPercent: 0;
 const numProteinGPerKg = typeof proteinGPerKg === 'number'? proteinGPerKg: 0;
 const numFatGPerKg = typeof fatGPerKg === 'number'? fatGPerKg: 0;
 const numWorkoutHours = typeof workoutHoursPerWeek === 'number'? workoutHoursPerWeek: 0;
 const numTargetWeight = typeof targetWeightKg === 'number'? targetWeightKg: 0;
 const numCustomDelta = typeof customKcalDelta === 'number'? customKcalDelta: 0;

 // Calculated BMR formulas comparison
 const bmrResults = calculateAllBMRFormulas({
 weightKg: numWeight || 70,
 heightCm: numHeight || 170,
 ageYears: numAge || 25,
 gender,
 bodyFatPercentage: numBodyFat,
 });

 // Selected BMR Value
 let selectedBmr = bmrResults.mifflin;
 if (selectedFormula === 'harris') selectedBmr = bmrResults.harrisBenedict;
 else if (selectedFormula === 'katch' && bmrResults.katchMcArdle) selectedBmr = bmrResults.katchMcArdle;
 else if (selectedFormula === 'cunningham' && bmrResults.cunningham) selectedBmr = bmrResults.cunningham;

 // TDEE calculation
 const currentPalObj = PAL_FACTORS.find((f) => f.id === activity) || PAL_FACTORS[1];
 const tdee = Math.round(selectedBmr * currentPalObj.factor);

 // Target Calories based on Goal Preset
 let deficitSurplusKcal = 0;
 if (goalPreset === 'cut_moderate') deficitSurplusKcal = -450;
 else if (goalPreset === 'cut_aggressive') deficitSurplusKcal = -700;
 else if (goalPreset === 'bulk_clean') deficitSurplusKcal = 300;
 else if (goalPreset === 'maintain') deficitSurplusKcal = 0;
 else if (goalPreset === 'custom') deficitSurplusKcal = numCustomDelta;

 const targetCalories = Math.max(1200, tdee + deficitSurplusKcal);

 // Macro Calculation Execution
 let finalProteinGrams = 0;
 let finalFatGrams = 0;
 let finalCarbGrams = 0;

 if (macroMode === 'percent') {
 finalProteinGrams = Math.round((targetCalories * (numProteinPercent / 100)) / 4);
 finalFatGrams = Math.round((targetCalories * (numFatPercent / 100)) / 9);
 finalCarbGrams = Math.round((targetCalories * (numCarbPercent / 100)) / 4);
 } else {
 // Grams per Kg
 finalProteinGrams = Math.round((numWeight || 70) * numProteinGPerKg);
 finalFatGrams = Math.round((numWeight || 70) * numFatGPerKg);
 const calsFromProtFat = finalProteinGrams * 4 + finalFatGrams * 9;
 const remainingCarbCals = Math.max(200, targetCalories - calsFromProtFat);
 finalCarbGrams = Math.round(remainingCarbCals / 4);
 }

 // Anthropometry Calculations
 const calculatedNavyBf = calculateUSNavyBodyFat(gender, numHeight, numNeckCm, numWaistCm, numHipCm);
 const ibwResults = calculateIBW(numHeight || 170, gender);
 const abwResult = calculateABW(numWeight || 70, ibwResults.devine);
 const bmiResult = calculateBMI(numWeight || 0, numHeight || 0);
 const whtrResult = calculateWHtR(numWaistCm || 0, numHeight || 0);

 // Fluid Calculation
 const fluidResult = calculateDailyFluid(numWeight || 70, numWorkoutHours);

 // Peri-workout Carbs
 const periWorkoutInfo = calculatePeriWorkoutNutrition(numWeight || 70);

 // Timeline Calculation
 const timelineResult = calculateTargetTimeline(numWeight || 70, numTargetWeight || 60, deficitSurplusKcal);

 const handleApplyNavyBfToAll = () => {
 if (calculatedNavyBf) {
 setBodyFat(calculatedNavyBf);
 if (selectedFormula === 'mifflin') {
 setSelectedFormula('katch'); // auto switch to Katch since BF is now calculated
 }
 }
 };

 const handleApplySuiteToPlan = () => {
 const notesSummary = `حاسبة السعرات الإكلينيكية: معادلة (${selectedFormula.toUpperCase()}) | الاحتياج اليومي (TDEE): ${tdee} ك.س | الهدف: ${targetCalories} ك.س | الماء المستهدف: ${fluidResult.totalLiters} لتر/يوم.`;
 onApplyCalories(targetCalories, finalProteinGrams, finalCarbGrams, finalFatGrams, notesSummary);
 onClose();
 };

 return (
 <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 dir-rtl animate-in fade-in duration-200">
 <div className="bg-slate-900 border border-slate-700/80 w-full max-w-3xl rounded-3xl app-overlay-shadow overflow-hidden max-h-[94vh] flex flex-col my-auto text-slate-100">
 
 {/* Header */}
 <div className="bg-[var(--app-card-muted)] p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-2xl backdrop-blur-md flex items-center justify-center text-white font-black text-xl">
 <Calculator className="w-5 h-5" />
 </div>
 <div>
 <h2 className="text-base sm:text-lg font-black tracking-tight">
 حاسبة ومعادلات الأخصائي الإكلينيكية (Clinical Suite) 
 </h2>
 <p className="text-[12px] text-blue-100">
 مكتبة المعادلات الرياضية والطبية الشاملة لحساب السعرات، الماكروز، الكتل والتسلسل الزمني
 </p>
 </div>
 </div>
 <button
 onClick={onClose}
 className="w-8 h-8 rounded-full hover: flex items-center justify-center transition-colors text-white font-bold text-sm cursor-pointer"
 >
 
 </button>
 </div>

 {/* Global Client Physical Inputs Bar */}
 <div className="bg-slate-950/90 border-b border-slate-800 p-3 sm:px-5 grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs shrink-0">
 <div>
 <label className="text-[12px] text-slate-400 font-bold block mb-1">النوع / الجنس</label>
 <div className="flex bg-slate-800 rounded-xl p-0.5 border border-slate-700">
 <button
 type="button"
 onClick={() => setGender('male')}
 className={`flex-1 py-1 text-center font-bold rounded-lg transition-all text-[12px] cursor-pointer ${
 gender === 'male'? 'bg-blue-600 text-white': 'text-slate-400 hover:text-white'
 }`}
 >
 ذكر
 </button>
 <button
 type="button"
 onClick={() => setGender('female')}
 className={`flex-1 py-1 text-center font-bold rounded-lg transition-all text-[12px] cursor-pointer ${
 gender === 'female'? 'bg-pink-600 text-white': 'text-slate-400 hover:text-white'
 }`}
 >
 أنثى
 </button>
 </div>
 </div>

 <div>
 <label className="text-[12px] text-slate-400 font-bold block mb-1">الوزن الحالي (كجم)</label>
 <input
 type="number"
 value={weight}
 onFocus={(e) => e.target.select()}
 onChange={(e) => setWeight(e.target.value === ''? '': parseFloat(e.target.value))}
 placeholder="0"
 className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-white font-black text-center focus:border-blue-500 focus:outline-none"
 />
 </div>

 <div>
 <label className="text-[12px] text-slate-400 font-bold block mb-1">الطول (سم)</label>
 <input
 type="number"
 value={height}
 onFocus={(e) => e.target.select()}
 onChange={(e) => setHeight(e.target.value === ''? '': parseFloat(e.target.value))}
 placeholder="0"
 className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-white font-black text-center focus:border-blue-500 focus:outline-none"
 />
 </div>

 <div>
 <label className="text-[12px] text-slate-400 font-bold block mb-1">العمر (سنوات)</label>
 <input
 type="number"
 value={age}
 onFocus={(e) => e.target.select()}
 onChange={(e) => setAge(e.target.value === ''? '': parseInt(e.target.value, 10))}
 placeholder="0"
 className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-white font-black text-center focus:border-blue-500 focus:outline-none"
 />
 </div>

 <div>
 <label className="text-[12px] text-slate-400 font-bold block mb-1">نسبة الدهون المقدرة (%)</label>
 <input
 type="number"
 value={bodyFat}
 onFocus={(e) => e.target.select()}
 onChange={(e) => setBodyFat(e.target.value === ''? '': parseFloat(e.target.value))}
 placeholder="0"
 className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-peacock-teal font-black text-center focus:border-peacock-blue focus:outline-none"
 />
 </div>
 </div>

 {/* Tab Sub-Navigation */}
 <div className="bg-slate-900 border-b border-slate-800 px-3 sm:px-5 flex items-center gap-1 overflow-x-auto shrink-0">
 <button
 onClick={() => setActiveTab('bmr_tdee')}
 className={`py-3 px-3 border-b-2 font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
 activeTab === 'bmr_tdee'
? 'border-blue-500 text-blue-400 bg-slate-800/50'
: 'border-transparent text-slate-400 hover:text-slate-200'
 }`}
 >
 <Flame className="w-4 h-4 text-orange-400" />
 <span>السعرات والـ BMR</span>
 </button>

 <button
 onClick={() => setActiveTab('body_comp')}
 className={`py-3 px-3 border-b-2 font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
 activeTab === 'body_comp'
? 'border-peacock-blue text-peacock-teal bg-slate-800/50'
: 'border-transparent text-slate-400 hover:text-slate-200'
 }`}
 >
 <Ruler className="w-4 h-4 text-peacock-teal" />
 <span>تركيبة الجسم والدهون</span>
 </button>

 <button
 onClick={() => setActiveTab('macros_fluid')}
 className={`py-3 px-3 border-b-2 font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
 activeTab === 'macros_fluid'
? 'border-peacock-blue text-peacock-teal bg-slate-800/50'
: 'border-transparent text-slate-400 hover:text-slate-200'
 }`}
 >
 <Droplets className="w-4 h-4 text-cyan-400" />
 <span>الماكروز والمياه والرياضة</span>
 </button>

 <button
 onClick={() => setActiveTab('timeline')}
 className={`py-3 px-3 border-b-2 font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
 activeTab === 'timeline'
? 'border-amber-500 text-amber-400 bg-slate-800/50'
: 'border-transparent text-slate-400 hover:text-slate-200'
 }`}
 >
 <Timer className="w-4 h-4 text-amber-400" />
 <span>المدّة والأهداف الآمنة</span>
 </button>
 </div>

 {/* Tab Content Body */}
 <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
 {/* TAB 1: BMR & TDEE FORMULAS */}
 {activeTab === 'bmr_tdee' && (
 <div className="space-y-4">
 {/* Activity Level Selector */}
 <div className="space-y-2">
 <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
 <Activity className="w-4 h-4 text-blue-400" />
 <span>مستوى النشاط البدني (PAL Factor):</span>
 </label>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 {PAL_FACTORS.map((act) => (
 <button
 key={act.id}
 type="button"
 onClick={() => setActivity(act.id)}
 className={`p-2.5 rounded-2xl border text-right transition-all cursor-pointer ${
 activity === act.id
? 'bg-blue-950/80 border-blue-500 text-blue-200'
: 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600'
 }`}
 >
 <div className="font-bold text-xs flex items-center justify-between">
 <span>{act.labelAr}</span>
 {activity === act.id && <Check className="w-3.5 h-3.5 text-blue-400" />}
 </div>
 <p className="text-[12px] text-slate-400 mt-0.5">{act.descAr}</p>
 </button>
 ))}
 </div>
 </div>

 {/* BMR Formulas Comparison Table */}
 <div className="space-y-2 pt-2">
 <div className="flex items-center justify-between">
 <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
 <Scale className="w-4 h-4 text-amber-400" />
 <span>مقارنة معادلات معدل الحرق الأساسي (BMR Formulas):</span>
 </label>
 <span className="text-[12px] text-slate-400">اختر المعادلة المعتمدة لخطتك</span>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
 {/* Mifflin */}
 <div
 onClick={() => setSelectedFormula('mifflin')}
 className={`p-3 rounded-2xl border cursor-pointer transition-all ${
 selectedFormula === 'mifflin'
? 'bg-blue-950/90 border-blue-500 ring-2 ring-blue-500/30'
: 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
 }`}
 >
 <div className="flex items-center justify-between mb-1">
 <span className="font-black text-xs text-white">1. Mifflin-St Jeor (الافتراضية)</span>
 <span className="text-xs font-mono font-black text-blue-400">{bmrResults.mifflin} ك.س</span>
 </div>
 <p className="text-[12px] text-slate-400">الأكثر دقة واعتماداً إكلينيكياً لغالبية الأشخاص غير الرياضيين.</p>
 </div>

 {/* Harris-Benedict */}
 <div
 onClick={() => setSelectedFormula('harris')}
 className={`p-3 rounded-2xl border cursor-pointer transition-all ${
 selectedFormula === 'harris'
? 'bg-blue-950/90 border-blue-500 ring-2 ring-blue-500/30'
: 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
 }`}
 >
 <div className="flex items-center justify-between mb-1">
 <span className="font-black text-xs text-white">2. Harris-Benedict (المعدلة)</span>
 <span className="text-xs font-mono font-black text-peacock-teal">{bmrResults.harrisBenedict} ك.س</span>
 </div>
 <p className="text-[12px] text-slate-400">معادلة كلاسيكية مجربة تعتمد على العمر والطول والوزن.</p>
 </div>

 {/* Katch-McArdle */}
 <div
 onClick={() => bmrResults.katchMcArdle && setSelectedFormula('katch')}
 className={`p-3 rounded-2xl border transition-all ${
!bmrResults.katchMcArdle
? 'opacity-50 cursor-not-allowed bg-slate-900 border-slate-800'
: selectedFormula === 'katch'
? 'bg-blue-950/90 border-blue-500 ring-2 ring-blue-500/30 cursor-pointer'
: 'bg-slate-800/80 border-slate-700 hover:border-slate-600 cursor-pointer'
 }`}
 >
 <div className="flex items-center justify-between mb-1">
 <span className="font-black text-xs text-white">3. Katch-McArdle (كتلة الدهون)</span>
 <span className="text-xs font-mono font-black text-peacock-teal">
 {bmrResults.katchMcArdle? `${bmrResults.katchMcArdle} ك.س`: 'تحتاج نسبة دهون'}
 </span>
 </div>
 <p className="text-[12px] text-slate-400">تعتمد على الكتلة الصافية (Lean Body Mass). دقيقة جداً للأجسام الرياضية.</p>
 </div>

 {/* Cunningham */}
 <div
 onClick={() => bmrResults.cunningham && setSelectedFormula('cunningham')}
 className={`p-3 rounded-2xl border transition-all ${
!bmrResults.cunningham
? 'opacity-50 cursor-not-allowed bg-slate-900 border-slate-800'
: selectedFormula === 'cunningham'
? 'bg-blue-950/90 border-blue-500 ring-2 ring-blue-500/30 cursor-pointer'
: 'bg-slate-800/80 border-slate-700 hover:border-slate-600 cursor-pointer'
 }`}
 >
 <div className="flex items-center justify-between mb-1">
 <span className="font-black text-xs text-white">4. Cunningham (للرياضيين)</span>
 <span className="text-xs font-mono font-black text-orange-400">
 {bmrResults.cunningham? `${bmrResults.cunningham} ك.س`: 'تحتاج نسبة دهون'}
 </span>
 </div>
 <p className="text-[12px] text-slate-400">مخصصة للرياضيين ذوي الكتل العضلية العالية وممارسي رفع الأثقال المكثف.</p>
 </div>
 </div>
 </div>

 {/* Goal & Deficit Target Calculation Card */}
 <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
 <div className="flex items-center justify-between">
 <span className="font-bold text-xs text-white flex items-center gap-1.5">
 <Zap className="w-4 h-4 text-amber-400" />
 <span>تحديد الهدف والتعديل الحراري:</span>
 </span>
 <span className="text-xs font-bold text-slate-400">
 الاستهلاك الكلي (TDEE): <b className="text-white font-mono">{tdee}</b> ك.س/يوم
 </span>
 </div>

 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
 {[
 { id: 'cut_moderate', label: 'تنشيف معتدل (-450)', delta: -450 },
 { id: 'cut_aggressive', label: 'تنشيف سريع (-700)', delta: -700 },
 { id: 'maintain', label: 'ثبات الوزن (0)', delta: 0 },
 { id: 'bulk_clean', label: 'تضخيم عضل (+300)', delta: 300 },
 ].map((gp) => (
 <button
 key={gp.id}
 type="button"
 onClick={() => setGoalPreset(gp.id as any)}
 className={`p-2 rounded-xl border text-center font-bold transition-all cursor-pointer ${
 goalPreset === gp.id
? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
: 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
 }`}
 >
 {gp.label}
 </button>
 ))}
 </div>

 <div className="pt-2 flex items-center justify-between border-t border-slate-800/80 text-xs">
 <span className="text-slate-300">السعرات المستهدفة للأنظمة والوجبات:</span>
 <div className="flex items-center gap-2">
 <span className="text-lg font-black font-mono text-amber-400">{targetCalories}</span>
 <span className="text-slate-400 text-xs">سعرة حرارية / يوم</span>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* TAB 2: BODY COMP & ANTHROPOMETRY */}
 {activeTab === 'body_comp' && (
 <div className="space-y-4">
 {/* US Navy Tape Method Section */}
 <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-3">
 <div className="flex items-center justify-between">
 <h4 className="font-bold text-xs text-peacock-teal-light flex items-center gap-1.5">
 <Ruler className="w-4 h-4 text-peacock-teal" />
 <span>حاسبة نسبة الدهون بطريقة الشريط القياسية (US Navy Method):</span>
 </h4>
 {calculatedNavyBf && (
 <button
 type="button"
 onClick={handleApplyNavyBfToAll}
 className="text-[12px] bg-peacock-indigo hover:bg-peacock-blue text-white font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
 >
 <Circle className="w-3 h-3" />
 <span>اعتماد هذه النسبة ({calculatedNavyBf}%)</span>
 </button>
 )}
 </div>

 <div className="grid grid-cols-3 gap-2.5 text-xs">
 <div>
 <label className="text-[12px] text-slate-400 block mb-1">محيط الرقبة (سم):</label>
 <input
 type="number"
 value={neckCm}
 onFocus={(e) => e.target.select()}
 onChange={(e) => setNeckCm(e.target.value === ''? '': parseFloat(e.target.value))}
 placeholder="0"
 className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-bold text-center focus:border-peacock-blue focus:outline-none"
 />
 </div>

 <div>
 <label className="text-[12px] text-slate-400 block mb-1">محيط الخصر (سم):</label>
 <input
 type="number"
 value={waistCm}
 onFocus={(e) => e.target.select()}
 onChange={(e) => setWaistCm(e.target.value === ''? '': parseFloat(e.target.value))}
 placeholder="0"
 className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-bold text-center focus:border-peacock-blue focus:outline-none"
 />
 </div>

 {gender === 'female'? (
 <div>
 <label className="text-[12px] text-slate-400 block mb-1">محيط الأرداف (سم):</label>
 <input
 type="number"
 value={hipCm}
 onFocus={(e) => e.target.select()}
 onChange={(e) => setHipCm(e.target.value === ''? '': parseFloat(e.target.value))}
 placeholder="0"
 className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-bold text-center focus:border-peacock-blue focus:outline-none"
 />
 </div>
 ): (
 <div className="opacity-40">
 <label className="text-[12px] text-slate-400 block mb-1">محيط الأرداف:</label>
 <input
 disabled
 value="غير مطلوب للذكور"
 className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-[12px] text-slate-500 text-center"
 />
 </div>
 )}
 </div>

 {calculatedNavyBf? (
 <div className="p-3 bg-peacock-ink-deep/60 border border-peacock-indigo-deep/80 rounded-xl flex items-center justify-between text-xs">
 <span className="text-slate-300">نسبة الدهون المحسوبة (Navy BF%):</span>
 <span className="font-black font-mono text-peacock-teal text-base">{calculatedNavyBf}%</span>
 </div>
 ): (
 <p className="text-[12px] text-amber-400 italic">الرجاء إدخال القياسات الدقيقة لظهور النتيجة.</p>
 )}
 </div>

 {/* Ideal Body Weight & Adjusted Body Weight */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3.5 space-y-2 text-xs">
 <h5 className="font-bold text-white flex items-center gap-1.5">
 <Scale className="w-4 h-4 text-blue-400" />
 <span>الوزن المثالي الإكلينيكي (Ideal Body Weight):</span>
 </h5>
 <div className="space-y-1 text-slate-300 text-[12px]">
 <div className="flex justify-between">
 <span>معادلة Devine:</span>
 <b className="font-mono text-blue-400">{ibwResults.devine} كجم</b>
 </div>
 <div className="flex justify-between">
 <span>معادلة Hamwi:</span>
 <b className="font-mono text-blue-400">{ibwResults.hamwi} كجم</b>
 </div>
 <div className="flex justify-between">
 <span>معادلة Broca:</span>
 <b className="font-mono text-blue-400">{ibwResults.broca} كجم</b>
 </div>
 </div>
 </div>

 <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3.5 space-y-2 text-xs">
 <h5 className="font-bold text-white flex items-center gap-1.5">
 <ShieldAlert className="w-4 h-4 text-peacock-teal" />
 <span>الوزن المعدل للسمنة (Adjusted Body Weight):</span>
 </h5>
 <p className="text-[12px] text-slate-400">مستخدم لحساب جرعات العلاج والسعرات الحادة لمرضى السمنة المفرطة.</p>
 <div className="p-2 bg-slate-900 rounded-xl flex justify-between items-center text-xs">
 <span className="text-slate-300">الوزن المعدل (ABW):</span>
 <b className="font-mono text-peacock-teal text-sm">{abwResult} كجم</b>
 </div>
 </div>
 </div>

 {/* BMI & WHtR Health Risk Matrix */}
 <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3.5 space-y-2 text-xs">
 <h5 className="font-bold text-white flex items-center gap-1.5">
 <Heart className="w-4 h-4 text-peacock-teal" />
 <span>مؤشر كتلة الجسم ونسبة الخصر بالطول (BMI & WHtR):</span>
 </h5>

 <div className="grid grid-cols-2 gap-3 text-xs">
 <div className="p-2.5 bg-slate-900 rounded-xl space-y-1">
 <span className="text-slate-400 text-[12px] block">مؤشر كتلة الجسم (BMI):</span>
 <div className="flex items-center gap-2">
 <b className="font-mono text-lg text-white">{bmiResult.bmi}</b>
 <span className={`text-[12px] font-bold ${bmiResult.color}`}>{bmiResult.categoryAr}</span>
 </div>
 </div>

 <div className="p-2.5 bg-slate-900 rounded-xl space-y-1">
 <span className="text-slate-400 text-[12px] block">نسبة الخصر بالطول (WHtR):</span>
 <div className="flex items-center gap-2">
 <b className="font-mono text-lg text-cyan-400">{whtrResult.ratio}</b>
 <span className="text-[12px] font-bold text-slate-300">{whtrResult.categoryAr}</span>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* TAB 3: MACROS, FLUID & SPORTS NUTRITION */}
 {activeTab === 'macros_fluid' && (
 <div className="space-y-4">
 {/* Macro Engine Choice */}
 <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-3 text-xs">
 <div className="flex items-center justify-between">
 <h4 className="font-bold text-xs text-peacock-teal-light flex items-center gap-1.5">
 <Dumbbell className="w-4 h-4 text-peacock-teal" />
 <span>طريقة توزيع الماكروز وتغذية الرياضيين:</span>
 </h4>

 <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-700">
 <button
 type="button"
 onClick={() => setMacroMode('g_per_kg')}
 className={`px-3 py-1 rounded-lg font-bold text-[12px] transition-all cursor-pointer ${
 macroMode === 'g_per_kg'? 'bg-peacock-indigo text-white': 'text-slate-400 hover:text-white'
 }`}
 >
 بناءً على الوزن (g/kg)
 </button>
 <button
 type="button"
 onClick={() => setMacroMode('percent')}
 className={`px-3 py-1 rounded-lg font-bold text-[12px] transition-all cursor-pointer ${
 macroMode === 'percent'? 'bg-peacock-indigo text-white': 'text-slate-400 hover:text-white'
 }`}
 >
 نسب مئوية (%)
 </button>
 </div>
 </div>

 {macroMode === 'g_per_kg'? (
 <div className="grid grid-cols-2 gap-3 pt-1">
 <div>
 <label className="text-slate-300 block mb-1 font-bold">البروتين (جرام / كجم من الوزن):</label>
 <input
 type="number"
 step="0.1"
 value={proteinGPerKg}
 onFocus={(e) => e.target.select()}
 onChange={(e) => setProteinGPerKg(e.target.value === ''? '': parseFloat(e.target.value))}
 placeholder="0"
 className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-peacock-teal font-bold font-mono text-center"
 />
 </div>
 <div>
 <label className="text-slate-300 block mb-1 font-bold">الدهون (جرام / كجم من الوزن):</label>
 <input
 type="number"
 step="0.1"
 value={fatGPerKg}
 onFocus={(e) => e.target.select()}
 onChange={(e) => setFatGPerKg(e.target.value === ''? '': parseFloat(e.target.value))}
 placeholder="0"
 className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-peacock-teal-light font-bold font-mono text-center"
 />
 </div>
 </div>
 ): (
 <div className="grid grid-cols-3 gap-2 pt-1">
 <div>
 <label className="text-slate-300 block mb-1 font-bold">كاربهيدرات (%):</label>
 <input
 type="number"
 value={carbPercent}
 onFocus={(e) => e.target.select()}
 onChange={(e) => setCarbPercent(e.target.value === ''? '': parseInt(e.target.value, 10))}
 placeholder="0"
 className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-cyan-400 font-bold font-mono text-center"
 />
 </div>
 <div>
 <label className="text-slate-300 block mb-1 font-bold">بروتين (%):</label>
 <input
 type="number"
 value={proteinPercent}
 onFocus={(e) => e.target.select()}
 onChange={(e) => setProteinPercent(e.target.value === ''? '': parseInt(e.target.value, 10))}
 placeholder="0"
 className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-peacock-teal font-bold font-mono text-center"
 />
 </div>
 <div>
 <label className="text-slate-300 block mb-1 font-bold">دهون صحية (%):</label>
 <input
 type="number"
 value={fatPercent}
 onFocus={(e) => e.target.select()}
 onChange={(e) => setFatPercent(e.target.value === ''? '': parseInt(e.target.value, 10))}
 placeholder="0"
 className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-peacock-teal-light font-bold font-mono text-center"
 />
 </div>
 </div>
 )}

 {/* Macro Result Cards */}
 <div className="grid grid-cols-3 gap-2.5 pt-2">
 <div className="p-2.5 rounded-xl bg-slate-900 border border-cyan-800/60 text-center">
 <span className="text-[12px] text-cyan-300 block font-bold">كاربوهيدرات</span>
 <b className="font-mono text-cyan-400 text-lg">{finalCarbGrams}g</b>
 </div>
 <div className="p-2.5 rounded-xl bg-slate-900 border border-peacock-indigo-deep/60 text-center">
 <span className="text-[12px] text-peacock-teal-light block font-bold">بروتين</span>
 <b className="font-mono text-peacock-teal text-lg">{finalProteinGrams}g</b>
 </div>
 <div className="p-2.5 rounded-xl bg-slate-900 border border-peacock-ink-deep/60 text-center">
 <span className="text-[12px] text-peacock-teal-light block font-bold">دهون صحية</span>
 <b className="font-mono text-peacock-teal-light text-lg">{finalFatGrams}g</b>
 </div>
 </div>
 </div>

 {/* Fluid Hydration Calculator */}
 <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-3 text-xs">
 <div className="flex items-center justify-between">
 <h4 className="font-bold text-xs text-cyan-300 flex items-center gap-1.5">
 <Droplets className="w-4 h-4 text-cyan-400" />
 <span>حاسبة احتياج المياه الإكلينيكية (Fluid Hydration):</span>
 </h4>
 <span className="font-bold text-cyan-400 font-mono text-sm">{fluidResult.totalLiters} لتر/يوم</span>
 </div>

 <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl text-slate-300">
 <span>ساعات التمرين الأسبوعية:</span>
 <input
 type="number"
 value={workoutHoursPerWeek}
 onFocus={(e) => e.target.select()}
 onChange={(e) => setWorkoutHoursPerWeek(e.target.value === ''? '': parseInt(e.target.value, 10))}
 placeholder="0"
 className="w-16 bg-slate-800 border border-slate-700 rounded-lg text-center font-bold text-white px-2 py-1"
 />
 </div>

 <p className="text-[12px] text-slate-400">
 يعادل تقريباً <b>{fluidResult.glassesCount} كوباً من الماء (250 مل)</b> مقسمة على مدار ساعات الاستيقاظ.
 </p>
 </div>

 {/* Peri-Workout Nutrition Recommendations */}
 <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3.5 space-y-2 text-xs">
 <h5 className="font-bold text-white flex items-center gap-1.5">
 <Zap className="w-4 h-4 text-amber-400" />
 <span>توصيات الكارب والبروتين حول وقت التمرين (Peri-Workout):</span>
 </h5>
 <ul className="space-y-1.5 text-[12px] text-slate-300">
 <li className="flex justify-between border-b border-slate-700/60 pb-1">
 <span>قبل التمرين (1-2 ساعة):</span>
 <b className="text-amber-300">{periWorkoutInfo.preWorkoutCarbsGrams}</b>
 </li>
 <li className="flex justify-between border-b border-slate-700/60 pb-1">
 <span>بعد التمرين (بروتين سريع):</span>
 <b className="text-peacock-teal-light">{periWorkoutInfo.postWorkoutProteinGrams}</b>
 </li>
 <li className="flex justify-between">
 <span>بعد التمرين (استرجاع الجلايكوجين):</span>
 <b className="text-cyan-300">{periWorkoutInfo.postWorkoutCarbsGrams}</b>
 </li>
 </ul>
 </div>
 </div>
 )}

 {/* TAB 4: TIMELINE & SAFE RATES */}
 {activeTab === 'timeline' && (
 <div className="space-y-4">
 <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-3 text-xs">
 <h4 className="font-bold text-xs text-amber-300 flex items-center gap-1.5">
 <Timer className="w-4 h-4 text-amber-400" />
 <span>حاسبة الفترة الزمنية ومعدل الفقدان الآمن (Target Timeline):</span>
 </h4>

 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-slate-300 block mb-1 font-bold">الوزن المستهدف (كجم):</label>
 <input
 type="number"
 value={targetWeightKg}
 onFocus={(e) => e.target.select()}
 onChange={(e) => setTargetWeightKg(e.target.value === ''? '': parseFloat(e.target.value))}
 placeholder="0"
 className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-amber-400 font-bold font-mono text-center"
 />
 </div>

 <div>
 <label className="text-slate-300 block mb-1 font-bold">العجز/الزيادة اليومية (ك.س):</label>
 <input
 disabled
 value={deficitSurplusKcal}
 className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-slate-400 font-bold font-mono text-center"
 />
 </div>
 </div>

 <div className="p-3 bg-slate-900 rounded-xl space-y-2 text-slate-200">
 <div className="flex justify-between items-center text-xs">
 <span>المدّة التقديرية للوصول للهدف:</span>
 <b className="text-amber-400 font-mono text-sm">{timelineResult.weeks} أسابيع (~{timelineResult.months} شهر)</b>
 </div>

 <div className="flex justify-between items-center text-xs">
 <span>معدل التغيير الأسبوعي المتوقع:</span>
 <b className="text-peacock-teal font-mono">{timelineResult.weeklyRateKg} كجم / أسبوع</b>
 </div>
 </div>

 {/* Safety Status Banner */}
 <div
 className={`p-3 rounded-xl border text-xs leading-relaxed ${
 timelineResult.isSafe
? 'bg-peacock-ink-deep/70 border-peacock-indigo/80 text-peacock-teal-light'
: 'bg-rose-950/70 border-rose-600/80 text-rose-300'
 }`}
 >
 <div className="flex items-center gap-1.5 font-bold mb-1">
 {timelineResult.isSafe? (
 <Award className="w-4 h-4 text-peacock-teal" />
 ): (
 <ShieldAlert className="w-4 h-4 text-rose-400" />
 )}
 <span>تقييم الأمان الإكلينيكي:</span>
 </div>
 <p>{timelineResult.messageAr}</p>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Footer Actions */}
 <div className="bg-slate-950 p-4 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
 <div className="text-xs text-slate-400">
 الهدف المستهدف: <b className="text-amber-400 font-mono text-sm">{targetCalories}</b> ك.س |
 كارب: <b className="text-cyan-400 font-mono">{finalCarbGrams}g</b> |
 بروتين: <b className="text-peacock-teal font-mono">{finalProteinGrams}g</b> |
 دهون: <b className="text-rose-400 font-mono">{finalFatGrams}g</b>
 </div>

 <div className="flex items-center gap-2">
 <button
 onClick={onClose}
 className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
 >
 إلغاء
 </button>
 <button
 onClick={handleApplySuiteToPlan}
 className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-peacock-indigo hover:bg-peacock-blue transition-all flex items-center gap-1.5 cursor-pointer"
 >
 <Circle className="w-4 h-4" />
 <span>تطبيق الحسابات مباشرة على مسودة الخطة </span>
 </button>
 </div>
 </div>
 </div>
 </div>
 );
};
