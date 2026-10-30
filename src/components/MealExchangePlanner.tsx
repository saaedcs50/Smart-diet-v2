import React, { useState } from 'react';
import { 
 Utensils, 
 Circle, 
 Plus, 
 Minus, 
 Info, 
 ChevronDown, 
 ChevronUp, 
 Calculator, 
 CheckCircle2, 
 AlertCircle, 
 HelpCircle,
 Flame,
 PieChart,
 RefreshCw,
 Layers,
 Wand2,
 X,
 Check,
 Search,
 BookOpen,
 Globe2,
 Flag
} from 'lucide-react';
import { MealItem, PlanConfig } from '../types';
import { 
 FOOD_EXCHANGE_GROUPS, 
 MIXED_DISHES_NOTES,
 calculateMealExchangeMacros, 
 calculatePlanTotalExchanges, 
 generateMealContentFromExchanges,
 ExchangeGroup 
} from '../utils/foodExchanges';

interface MealExchangePlannerProps {
 draft: PlanConfig;
 coachSessionUnlocked?: boolean;
 onUpdateDraft: (updated: PlanConfig) => void;
 onNotify: (msg: string) => void;
}

export const MealExchangePlanner: React.FC<MealExchangePlannerProps> = ({
 draft,
 coachSessionUnlocked,
 onUpdateDraft,
 onNotify,
}) => {
 const [showCatalogModal, setShowCatalogModal] = useState(false);
 const [catalogTab, setCatalogTab] = useState<'groups' | 'mixed_dishes'>('groups');
 const [catalogSearch, setCatalogSearch] = useState('');
 const [selectedCatalogCategory, setSelectedCatalogCategory] = useState<string>('all');
 const [catalogViewMode, setCatalogViewMode] = useState<'all' | 'egyptian' | 'global'>('all');
 const [expandedMealId, setExpandedMealId] = useState<string | null>(draft.meals[0]?.id || null);

 // Calculate cumulative totals across all meals
 const { totalExchanges, totals } = calculatePlanTotalExchanges(draft.meals);

 const targetCal = draft.targetCalories || 2000;
 const targetProt = draft.targetProtein || 150;
 const targetCarbs = draft.targetCarbs || 180;
 const targetFats = draft.targetFats || 60;

 const calPct = Math.round((totals.calories / (targetCal || 1)) * 100);
 const protPct = Math.round((totals.proteinGrams / (targetProt || 1)) * 100);
 const carbsPct = Math.round((totals.carbsGrams / (targetCarbs || 1)) * 100);
 const fatsPct = Math.round((totals.fatsGrams / (targetFats || 1)) * 100);

 const handleUpdateExchange = (mealIdx: number, groupId: string, delta: number) => {
 const updatedMeals = [...draft.meals];
 const meal = {...updatedMeals[mealIdx] };
 const currentExchanges = {...(meal.exchanges || {}) };
 
 const currentQty = currentExchanges[groupId] || 0;
 const newQty = Math.max(0, currentQty + delta);
 
 currentExchanges[groupId] = newQty;
 meal.exchanges = currentExchanges;

 // Recalculate calories and protein on meal if needed
 const mealMacros = calculateMealExchangeMacros(currentExchanges);
 meal.calories = mealMacros.calories;
 meal.proteinGrams = mealMacros.proteinGrams;

 updatedMeals[mealIdx] = meal;
 onUpdateDraft({...draft, meals: updatedMeals });
 };

 // Local Clinical Generator (Works 100% offline and instantaneous)
 const handleAutoGenerateMeal = (mealIdx: number) => {
 const meal = draft.meals[mealIdx];
 if (!meal.exchanges || Object.values(meal.exchanges).every((v) =>!v || Number(v) <= 0)) {
 alert('الرجاء زيادة حصة واحدة على الأقل من المجموعات الغذائية قبل التوليد.');
 return;
 }

 const { primaryItems, alternatives } = generateMealContentFromExchanges(meal.exchanges);
 const updatedMeals = [...draft.meals];
 updatedMeals[mealIdx] = {
...meal,
 items: primaryItems,
 alternatives: alternatives,
 };

 onUpdateDraft({...draft, meals: updatedMeals });
 onNotify(`تم تركيب مكونات الوجبة وتوليد ${alternatives.length} بدائل مطابقة للحصص بنجاح `);
 };

 const handleGenerateAllMeals = () => {
 let generatedCount = 0;
 const updatedMeals = draft.meals.map((meal) => {
 if (meal.exchanges && Object.values(meal.exchanges).some((v) => Number(v) > 0)) {
 const { primaryItems, alternatives } = generateMealContentFromExchanges(meal.exchanges);
 generatedCount++;
 return {
...meal,
 items: primaryItems,
 alternatives: alternatives,
 };
 }
 return meal;
 });

 if (generatedCount === 0) {
 alert('لم يتم تحديد أي حصص في الوجبات بعد. يرجى إضافة حصص أولاً.');
 return;
 }

 onUpdateDraft({...draft, meals: updatedMeals });
 onNotify(`تم توليد نصوص والبدائل تلقائياً لعدد ${generatedCount} وجبة بناءً على نظام البدائل `);
 };

 return (
 <div className="space-y-4 text-right dir-rtl">
 {/* Header Info & Actions Bar */}
 <div className="p-3.5 rounded-2xl bg-peacock-mist/80 dark:bg-peacock-ink-deep/30 border border-peacock-sage dark:border-peacock-indigo-deep/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
 <div>
 <div className="flex items-center gap-2">
 <h4 className="text-xs font-black text-peacock-ink dark:text-peacock-sage flex items-center gap-1.5">
 <Layers className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal" />
 نظام بدائل الأغذية الإكلينيكي (Clinical Exchange List) 
 </h4>
 </div>
 <p className="text-[12px] text-peacock-indigo-deep/80 dark:text-peacock-teal-light mt-0.5">
 وزّعي الحصص الغذائية على الوجبات وسيقوم النظام بحساب السعرات وتوليد الوجبات والبدائل تلقائياً
 </p>
 </div>

 <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
 {/* Local Default Batch Generator */}
 <button
 type="button"
 onClick={handleGenerateAllMeals}
 className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo-dark text-white font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
 >
 <Circle className="w-3.5 h-3.5" />
 <span>توليد الكل تلقائياً </span>
 </button>

 {/* Catalog Guide */}
 <button
 type="button"
 onClick={() => setShowCatalogModal(!showCatalogModal)}
 className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-peacock-teal-light dark:border-peacock-indigo-dark text-peacock-indigo-dark dark:text-peacock-teal-light font-bold text-xs hover:bg-peacock-mist dark:hover:bg-peacock-ink-deep/40 transition-colors flex items-center justify-center gap-1"
 >
 <Info className="w-3.5 h-3.5 text-peacock-indigo" />
 <span>دليل الحصص</span>
 </button>
 </div>
 </div>

 {/* Cumulative Day Totals vs Target Card */}
 <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Calculator className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal" />
 <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">
 إجمالي اليوم من الحصص والماكروز مقابل الأهداف
 </h4>
 </div>
 <span className="text-[12px] font-bold text-slate-500">
 مجموع الوجبات: {draft.meals.length}
 </span>
 </div>

 {/* 4 Macro Progress Bars Grid */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
 {/* Calories */}
 <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
 <div className="flex items-center justify-between text-[12px]">
 <span className="text-slate-500 font-bold flex items-center gap-1">
 <Flame className="w-3 h-3 text-orange-500" /> السعرات
 </span>
 <span className="font-black text-slate-900 dark:text-slate-100">
 {totals.calories} / {targetCal}
 </span>
 </div>
 <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
 <div 
 className={`h-full rounded-full transition-all duration-150 ${
 calPct > 105? 'bg-amber-500': 'bg-peacock-blue'
 }`}
 style={{ width: `${Math.min(100, calPct)}%` }}
 />
 </div>
 <div className="text-[12px] text-slate-500 text-left font-mono">
 {calPct}% من الهدف
 </div>
 </div>

 {/* Protein */}
 <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
 <div className="flex items-center justify-between text-[12px]">
 <span className="text-slate-500 font-bold flex items-center gap-1">
 بروتين
 </span>
 <span className="font-black text-peacock-indigo dark:text-peacock-teal">
 {totals.proteinGrams}g / {targetProt}g
 </span>
 </div>
 <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
 <div 
 className="h-full rounded-full bg-peacock-indigo transition-all duration-150"
 style={{ width: `${Math.min(100, protPct)}%` }}
 />
 </div>
 <div className="text-[12px] text-slate-500 text-left font-mono">
 {protPct}%
 </div>
 </div>

 {/* Carbs */}
 <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
 <div className="flex items-center justify-between text-[12px]">
 <span className="text-slate-500 font-bold flex items-center gap-1">
 نشويات
 </span>
 <span className="font-black text-amber-600 dark:text-amber-400">
 {totals.carbsGrams}g / {targetCarbs}g
 </span>
 </div>
 <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
 <div 
 className="h-full rounded-full bg-amber-500 transition-all duration-150"
 style={{ width: `${Math.min(100, carbsPct)}%` }}
 />
 </div>
 <div className="text-[12px] text-slate-500 text-left font-mono">
 {carbsPct}%
 </div>
 </div>

 {/* Fats */}
 <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
 <div className="flex items-center justify-between text-[12px]">
 <span className="text-slate-500 font-bold flex items-center gap-1">
 دهون
 </span>
 <span className="font-black text-peacock-indigo dark:text-peacock-teal">
 {totals.fatsGrams}g / {targetFats}g
 </span>
 </div>
 <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
 <div 
 className="h-full rounded-full bg-peacock-blue transition-all duration-150"
 style={{ width: `${Math.min(100, fatsPct)}%` }}
 />
 </div>
 <div className="text-[12px] text-slate-500 text-left font-mono">
 {fatsPct}%
 </div>
 </div>
 </div>

 {/* Exchanges Distribution Pills */}
 <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5 text-xs">
 <span className="text-[12px] font-bold text-slate-500 pl-1">مجموع الحصص باليوم:</span>
 {FOOD_EXCHANGE_GROUPS.map((group) => {
 const qty = totalExchanges[group.id] || 0;
 if (qty <= 0) return null;
 return (
 <span
 key={group.id}
 className={`text-[12px] font-black px-2 py-0.5 rounded-full border ${group.colorClass.badge}`}
 >
 {group.icon} {group.shortName}: {qty}
 </span>
 );
 })}
 </div>
 </div>

 {/* Food Exchange Catalog Guide Modal */}
 {showCatalogModal && (
 <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
 <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl p-5 border border-slate-200 dark:border-slate-800 app-overlay-shadow space-y-4 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
 {/* Modal Header */}
 <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
 <div className="flex items-center gap-2.5">
 <div className="w-9 h-9 rounded-2xl dark: text-peacock-indigo dark:text-peacock-teal flex items-center justify-center font-bold">
 <BookOpen className="w-5 h-5" />
 </div>
 <div>
 <h4 className="font-black text-slate-900 dark:text-slate-100 text-sm sm:text-base">
 دليل قوائم البدائل الغذائية الشامل (المعتمد إكلينيكياً ومصرياً) 
 </h4>
 <p className="text-[12px] text-slate-500">
 وفق معايير المعهد القومي للتغذية (NNI) والجمعية الأمريكية للتغذية والسكري (ADA/AND)
 </p>
 </div>
 </div>

 <button
 type="button"
 onClick={() => setShowCatalogModal(false)}
 className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Main Tabs: Food Groups vs Mixed Dishes */}
 <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-2 shrink-0">
 <button
 type="button"
 onClick={() => setCatalogTab('groups')}
 className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
 catalogTab === 'groups'
? 'bg-peacock-indigo text-white'
: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
 }`}
 >
 <Layers className="w-3.5 h-3.5" />
 <span>قوائم الحصص والمجموعات الغذائية</span>
 </button>
 <button
 type="button"
 onClick={() => setCatalogTab('mixed_dishes')}
 className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
 catalogTab === 'mixed_dishes'
? 'bg-amber-600 text-white'
: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
 }`}
 >
 <Utensils className="w-3.5 h-3.5" />
 <span>دليل تفكيك الأطباق المصرية المركبة (كشري، محشي، فتة...) </span>
 </button>
 </div>

 {/* Controls Bar: Search & Category Filters */}
 <div className="space-y-2.5 shrink-0">
 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
 {/* Search Bar */}
 <div className="relative flex-1">
 <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
 <input
 type="text"
 value={catalogSearch}
 onChange={(e) => setCatalogSearch(e.target.value)}
 placeholder={
 catalogTab === 'groups'
? 'ابحث عن أي طعام أو حصة (عيش بلدي، فول، قريش، تونة، شوفان، ملوخية، بطاطا، طحينة، رايب)...'
: 'ابحث في الأطباق المركبة (كشري، محشي، مسقعة، فتة، حواوشي، بصارة، بامية)...'
 }
 className="w-full pr-9 pl-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-peacock-blue"
 />
 {catalogSearch && (
 <button
 type="button"
 onClick={() => setCatalogSearch('')}
 className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
 >
 مسح
 </button>
 )}
 </div>

 {catalogTab === 'groups' && (
 <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0 text-xs">
 <button
 type="button"
 onClick={() => setCatalogViewMode('all')}
 className={`px-2.5 py-1.5 rounded-lg font-bold transition-all ${
 catalogViewMode === 'all'
? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100'
: 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
 }`}
 >
 الكل
 </button>
 <button
 type="button"
 onClick={() => setCatalogViewMode('egyptian')}
 className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all ${
 catalogViewMode === 'egyptian'
? 'bg-peacock-indigo text-white'
: 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
 }`}
 >
 <span></span>
 <span>الأكل المصري</span>
 </button>
 <button
 type="button"
 onClick={() => setCatalogViewMode('global')}
 className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all ${
 catalogViewMode === 'global'
? 'bg-blue-600 text-white'
: 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
 }`}
 >
 <Globe2 className="w-3.5 h-3.5" />
 <span>العالمي</span>
 </button>
 </div>
 )}
 </div>

 {/* Category Pill Filters (Groups Tab Only) */}
 {catalogTab === 'groups' && (
 <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
 <button
 type="button"
 onClick={() => setSelectedCatalogCategory('all')}
 className={`px-3 py-1 rounded-full font-bold whitespace-nowrap transition-colors ${
 selectedCatalogCategory === 'all'
? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
 }`}
 >
 جميع المجموعات
 </button>
 {FOOD_EXCHANGE_GROUPS.map((g) => (
 <button
 key={g.id}
 type="button"
 onClick={() => setSelectedCatalogCategory(g.id)}
 className={`px-3 py-1 rounded-full font-bold whitespace-nowrap flex items-center gap-1 transition-colors border ${
 selectedCatalogCategory === g.id
? `${g.colorClass.badge} font-black ring-1 ring-peacock-blue/30`
: 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
 }`}
 >
 <span>{g.icon}</span>
 <span>{g.shortName}</span>
 </button>
 ))}
 </div>
 )}
 </div>

 {/* Scrollable Content */}
 <div className="overflow-y-auto space-y-4 pr-0.5 flex-1">
 {/* 1. Food Groups Catalog */}
 {catalogTab === 'groups' && (
 <>
 {FOOD_EXCHANGE_GROUPS.filter((group) => {
 if (selectedCatalogCategory!== 'all' && group.id!== selectedCatalogCategory) {
 return false;
 }
 if (catalogSearch.trim()) {
 const q = catalogSearch.toLowerCase().trim();
 const inName = group.nameAr.toLowerCase().includes(q) || group.shortName.toLowerCase().includes(q);
 const inItems = group.items?.some((it) => it.nameAr.toLowerCase().includes(q) || it.servingAr.toLowerCase().includes(q) || it.tags?.some((t) => t.toLowerCase().includes(q)));
 const inEgyptian = group.egyptianExamples.some((ex) => ex.toLowerCase().includes(q));
 const inGlobal = group.globalExamples.some((ex) => ex.toLowerCase().includes(q));
 const inTips = (group.tips || '').toLowerCase().includes(q);
 return inName || inItems || inEgyptian || inGlobal || inTips;
 }
 return true;
 }).map((group) => {
 const filteredItems = catalogSearch.trim()
? (group.items || []).filter((it) => 
 it.nameAr.toLowerCase().includes(catalogSearch.toLowerCase()) || 
 it.servingAr.toLowerCase().includes(catalogSearch.toLowerCase()) ||
 it.tags?.some((t) => t.toLowerCase().includes(catalogSearch.toLowerCase()))
 )
: (group.items || []);

 const filteredEgyptian = catalogSearch.trim()
? group.egyptianExamples.filter((ex) => ex.toLowerCase().includes(catalogSearch.toLowerCase()))
: group.egyptianExamples;

 const filteredGlobal = catalogSearch.trim()
? group.globalExamples.filter((ex) => ex.toLowerCase().includes(catalogSearch.toLowerCase()))
: group.globalExamples;

 return (
 <div 
 key={group.id}
 className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 space-y-3"
 >
 {/* Header: Name, Portion Unit, Macros Bar */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-700/60 pb-2.5">
 <div>
 <div className="flex items-center gap-2">
 <span className="text-xl">{group.icon}</span>
 <h5 className="font-black text-slate-900 dark:text-slate-100 text-sm">
 {group.nameAr}
 </h5>
 </div>
 <p className="text-[12px] text-slate-500 font-medium mt-0.5">
 {group.portionUnit} • المعيار: {group.clinicalStandard}
 </p>
 </div>

 <div className="flex items-center gap-1.5 flex-wrap">
 <span className="text-[12px] font-black px-2.5 py-1 rounded-full bg-peacock-pale dark:bg-peacock-ink-deep text-peacock-indigo-deep dark:text-peacock-teal-light border border-peacock-sage dark:border-peacock-indigo-deep">
 {group.calories} ك.س / حصة
 </span>
 <span className="text-[12px] font-bold px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-mono">
 P: {group.proteinGrams}g | C: {group.carbsGrams}g | F: {group.fatsGrams}g
 </span>
 </div>
 </div>

 {/* Exact Detailed Itemized Servings Grid */}
 {filteredItems.length > 0 && (
 <div className="space-y-1.5">
 <div className="flex items-center justify-between text-xs font-black text-slate-700 dark:text-slate-300">
 <span className="flex items-center gap-1.5">
 <span></span>
 <span>جدول المقادير الدقيقة للحصة الواحدة (Itemized Servings):</span>
 </span>
 <span className="text-[12px] text-slate-400 font-normal">
 {filteredItems.length} صنف مسجل
 </span>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 {filteredItems.map((item) => (
 <div
 key={item.id}
 className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-1 hover:border-peacock-blue/40 transition-colors"
 >
 <div className="flex items-start justify-between gap-1.5">
 <span className="font-bold text-xs text-slate-900 dark:text-slate-100 leading-snug">
 {item.nameAr}
 </span>
 {item.tags?.includes('egyptian') && (
 <span className="text-[12px] font-bold text-peacock-indigo-dark dark:text-peacock-teal-light bg-peacock-mist dark:bg-peacock-ink-deep/60 px-1.5 py-0.5 rounded-md shrink-0 border border-peacock-sage/60 dark:border-peacock-ink">
 مصري
 </span>
 )}
 </div>
 <div className="flex items-center justify-between text-[12px] pt-1 border-t border-slate-100 dark:border-slate-800/80">
 <span className="text-peacock-indigo-dark dark:text-peacock-teal font-black">
 {item.servingAr}
 </span>
 <span className="text-[12px] text-slate-400">
 = 1 حصة
 </span>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Egyptian Staples Section */}
 {(catalogViewMode === 'all' || catalogViewMode === 'egyptian') && (filteredEgyptian.length > 0 ||!catalogSearch) && (
 <div className="space-y-1.5 pt-1">
 <div className="flex items-center gap-1.5 text-xs font-black text-peacock-indigo-deep dark:text-peacock-teal-light">
 <span></span>
 <span>أمثلة سريعة للأطعمة والأطباق المصرية المعتادة:</span>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
 {(filteredEgyptian.length > 0? filteredEgyptian: group.egyptianExamples).map((item, idx) => (
 <div
 key={idx}
 className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-peacock-pale dark:border-peacock-ink-deep/60 text-[12px] text-slate-800 dark:text-slate-200 leading-snug flex items-start gap-1.5"
 >
 <span className="text-peacock-blue font-black shrink-0 mt-0.5">•</span>
 <span>{item}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Global Clinical Standards Section */}
 {(catalogViewMode === 'all' || catalogViewMode === 'global') && (filteredGlobal.length > 0 ||!catalogSearch) && (
 <div className="space-y-1.5 pt-1">
 <div className="flex items-center gap-1.5 text-xs font-black text-blue-800 dark:text-blue-300">
 <Globe2 className="w-3.5 h-3.5" />
 <span>البدائل العالمية والصحية الشائعة (Global Equivalents):</span>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
 {(filteredGlobal.length > 0? filteredGlobal: group.globalExamples).map((item, idx) => (
 <div
 key={idx}
 className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-blue-100 dark:border-blue-950/60 text-[12px] text-slate-800 dark:text-slate-200 leading-snug flex items-start gap-1.5"
 >
 <span className="text-blue-500 font-black shrink-0 mt-0.5">•</span>
 <span>{item}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Group Clinical Tips */}
 {group.tips && (
 <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-[12px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
 <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
 <p>{group.tips}</p>
 </div>
 )}
 </div>
 );
 })}

 {FOOD_EXCHANGE_GROUPS.filter((group) => {
 if (selectedCatalogCategory!== 'all' && group.id!== selectedCatalogCategory) return false;
 if (!catalogSearch.trim()) return true;
 const q = catalogSearch.toLowerCase().trim();
 return (
 group.nameAr.toLowerCase().includes(q) ||
 group.shortName.toLowerCase().includes(q) ||
 group.items?.some((it) => it.nameAr.toLowerCase().includes(q) || it.servingAr.toLowerCase().includes(q)) ||
 group.egyptianExamples.some((ex) => ex.toLowerCase().includes(q)) ||
 group.globalExamples.some((ex) => ex.toLowerCase().includes(q))
 );
 }).length === 0 && (
 <div className="p-5 text-center text-slate-500 space-y-2">
 <p className="text-sm font-bold">لم يتم العثور على أطعمة مطابقة لبحثك "{catalogSearch}"</p>
 <p className="text-xs">جرب البحث بكلمة أخرى أو اضغط مسح لعرض كافة المجموعات.</p>
 </div>
 )}
 </>
 )}

 {/* 2. Mixed Dishes Breakdown Guide */}
 {catalogTab === 'mixed_dishes' && (
 <div className="space-y-3">
 <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
 <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
 <div>
 <p className="font-bold">تنويه إكلينيكي للأخصائية ومخطط الوجبات:</p>
 <p className="text-[12px] leading-relaxed text-amber-800 dark:text-amber-300 mt-0.5">
 الأطباق المصرية الشعبية والمركبة لا توضع كصنف مفرد، بل يتم تفكيكها إلى مجموعاتها الأساسية (نشويات + بروتين + خضار + دهون القلي/الطهي) لضمان دقة السعرات والماكروز ومنع تراكم الدهون المخفية.
 </p>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {MIXED_DISHES_NOTES.filter((dish) => {
 if (!catalogSearch.trim()) return true;
 const q = catalogSearch.toLowerCase().trim();
 return (
 dish.nameAr.toLowerCase().includes(q) ||
 dish.breakdown.toLowerCase().includes(q) ||
 (dish.servingAdvice || '').toLowerCase().includes(q)
 );
 }).map((dish, idx) => (
 <div
 key={idx}
 className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 hover:border-amber-500/50 transition-colors"
 >
 <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70 dark:border-slate-700/60">
 <h5 className="font-black text-slate-900 dark:text-slate-100 text-xs sm:text-sm flex items-center gap-1.5">
 <span></span>
 <span>{dish.nameAr}</span>
 </h5>
 <span className="text-[12px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
 طبق مركب
 </span>
 </div>

 <div className="space-y-1 text-xs">
 <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">
 <strong className="text-slate-800 dark:text-slate-200">التفكيك الغذائي:</strong> {dish.breakdown}
 </p>
 {dish.servingAdvice && (
 <p className="text-[12px] text-peacock-indigo-deep dark:text-peacock-teal-light bg-peacock-mist dark:bg-peacock-ink-deep/40 p-2 rounded-xl border border-peacock-sage/60 dark:border-peacock-ink/60 leading-snug">
 <strong> كيفية الحساب:</strong> {dish.servingAdvice}
 </p>
 )}
 </div>
 </div>
 ))}
 </div>

 {MIXED_DISHES_NOTES.filter((dish) => {
 if (!catalogSearch.trim()) return true;
 const q = catalogSearch.toLowerCase().trim();
 return (
 dish.nameAr.toLowerCase().includes(q) ||
 dish.breakdown.toLowerCase().includes(q) ||
 (dish.servingAdvice || '').toLowerCase().includes(q)
 );
 }).length === 0 && (
 <div className="p-5 text-center text-slate-500 space-y-2">
 <p className="text-sm font-bold">لم يتم العثور على أطباق مركبة مطابقة لبحثك "{catalogSearch}"</p>
 <p className="text-xs">جرب البحث باسم طبق آخر مثل كشري أو محشي أو مسقعة أو فتة.</p>
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 </div>
 )}

 {/* Individual Meals Accordion / Cards */}
 <div className="space-y-3">
 {draft.meals.map((meal, mealIdx) => {
 const isExpanded = expandedMealId === meal.id;
 const mealMacros = calculateMealExchangeMacros(meal.exchanges);
 const hasExchanges = meal.exchanges && Object.values(meal.exchanges).some((v) => Number(v) > 0);

 return (
 <div
 key={meal.id || mealIdx}
 className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
 isExpanded
? 'bg-white dark:bg-slate-900 border-peacock-blue/50 ring-1 ring-peacock-blue/20'
: 'bg-white/80 dark:bg-slate-900/80 border-slate-200/90 dark:border-slate-800 hover:border-slate-300'
 }`}
 >
 {/* Card Header (Summary & Expand Toggle) */}
 <div
 onClick={() => setExpandedMealId(isExpanded? null: meal.id)}
 className="p-3.5 flex items-center justify-between cursor-pointer select-none gap-2"
 >
 <div className="flex items-center gap-2.5 min-w-0">
 <div className="w-8 h-8 rounded-xl text-peacock-indigo dark:text-peacock-teal flex items-center justify-center font-black text-xs shrink-0">
 {mealIdx + 1}
 </div>

 <div className="min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
 {meal.name || `وجبة ${mealIdx + 1}`}
 </span>
 {meal.time && (
 <span className="text-[12px] text-slate-500">
 ({meal.time})
 </span>
 )}
 </div>

 <div className="flex items-center gap-2 mt-0.5 text-[12px] text-slate-500">
 <span className="font-bold text-orange-600 dark:text-orange-400">
 {mealMacros.calories} ك.س
 </span>
 <span>•</span>
 <span>P: {mealMacros.proteinGrams}g</span>
 <span>C: {mealMacros.carbsGrams}g</span>
 <span>F: {mealMacros.fatsGrams}g</span>
 </div>
 </div>
 </div>

 <div className="flex items-center gap-2 shrink-0">
 {/* Mini badges preview when collapsed */}
 {!isExpanded && hasExchanges && (
 <div className="hidden sm:flex items-center gap-1">
 {FOOD_EXCHANGE_GROUPS.map((g) => {
 const q = meal.exchanges?.[g.id] || 0;
 if (q <= 0) return null;
 return (
 <span
 key={g.id}
 className={`text-[12px] font-black px-1.5 py-0.5 rounded-md ${g.colorClass.badge}`}
 >
 {g.shortName} {q}
 </span>
 );
 })}
 </div>
 )}

 <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
 {isExpanded? <ChevronUp className="w-4 h-4" />: <ChevronDown className="w-4 h-4" />}
 </div>
 </div>
 </div>

 {/* Expanded Body: Food Exchange Steppers & Generated Items */}
 {isExpanded && (
 <div className="p-4 pt-1 border-t border-slate-100 dark:border-slate-800/80 space-y-4">
 {/* Exchange Steppers Grid */}
 <div>
 <div className="flex items-center justify-between mb-2">
 <label className="text-[12px] font-black text-slate-700 dark:text-slate-300">
 تحديد حصص الوجبة (Food Exchanges):
 </label>
 <span className="text-[12px] text-slate-500 font-medium">
 الخطوة = 0.5 أو 1 حصة
 </span>
 </div>

 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
 {FOOD_EXCHANGE_GROUPS.map((group) => {
 const currentQty = meal.exchanges?.[group.id] || 0;

 return (
 <div
 key={group.id}
 className={`p-2.5 rounded-xl border transition-all ${
 currentQty > 0
? 'bg-peacock-mist/40 dark:bg-peacock-ink-deep/20 border-peacock-teal-light dark:border-peacock-indigo-deep'
: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/80'
 }`}
 >
 <div className="flex items-center justify-between mb-1.5">
 <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1">
 <span>{group.icon}</span>
 <span>{group.shortName}</span>
 </span>
 <span className="text-[12px] text-slate-500 font-mono">
 {group.calories * currentQty} ك.س
 </span>
 </div>

 {/* Stepper controls */}
 <div className="flex items-center justify-between gap-1">
 <button
 type="button"
 onClick={() => handleUpdateExchange(mealIdx, group.id, -0.5)}
 disabled={currentQty <= 0}
 className="w-8 h-8 rounded-lg dark: dark: hover: flex items-center justify-center text-slate-700 dark:text-slate-200 font-black text-sm disabled:opacity-30 cursor-pointer select-none"
 title="-0.5 حصة"
 >
 -
 </button>

 <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-slate-100 min-w-[28px] text-center font-mono">
 {currentQty}
 </span>

 <button
 type="button"
 onClick={() => handleUpdateExchange(mealIdx, group.id, 0.5)}
 className="w-8 h-8 rounded-lg hover: flex items-center justify-center text-white font-black text-sm cursor-pointer select-none"
 title="+0.5 حصة"
 >
 +
 </button>
 </div>
 </div>
 );
 })}
 </div>
 </div>

 {/* Generator Actions Bar */}
 <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => handleAutoGenerateMeal(mealIdx)}
 className="px-3.5 py-2 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo-dark text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
 title="توليد فوري للمكونات والبدائل بناءً على الكتالوج المحلي"
 >
 <Circle className="w-3.5 h-3.5 text-peacock-sage" />
 <span>توليد مكونات وبدائل الوجبة تلقائياً </span>
 </button>
 </div>

 <div className="text-[12px] text-slate-500 dark:text-slate-400">
 التوليد فوري ومحسوب بدقة طبقاً لنظام البدائل الإكلينيكي.
 </div>
 </div>

 {/* Generated Meal Items & Alternatives View / Manual Edit */}
 <div className="space-y-2.5 pt-2">
 <div>
 <label className="block text-[12px] font-bold text-slate-500 mb-1">
 المكونات الأساسية المقررة:
 </label>
 <textarea
 rows={2}
 value={meal.items}
 onChange={(e) => {
 const updated = [...draft.meals];
 updated[mealIdx].items = e.target.value;
 onUpdateDraft({...draft, meals: updated });
 }}
 className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 resize-none font-medium"
 placeholder="اختر الحصص واضغط توليد الوجبة تلقائياً..."
 />
 </div>

 <div>
 <label className="block text-[12px] font-bold text-amber-600 dark:text-amber-400 mb-1">
 البدائل المتاحة (افصل بينها بـ |):
 </label>
 <input
 type="text"
 value={(meal.alternatives || []).join(' | ')}
 onChange={(e) => {
 const updated = [...draft.meals];
 updated[mealIdx].alternatives = e.target.value
.split('|')
.map((s) => s.trim())
.filter(Boolean);
 onUpdateDraft({...draft, meals: updated });
 }}
 className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium"
 placeholder="بديل 1 | بديل 2 | بديل 3"
 />
 </div>
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 );
};
