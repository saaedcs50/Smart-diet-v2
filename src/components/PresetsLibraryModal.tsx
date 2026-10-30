import React, { useRef, useState } from 'react';
import { BRAND } from '../config/brand';
import { 
 FolderHeart, 
 Circle, 
 CheckCircle2, 
 Eye, 
 Zap, 
 Trash2, 
 Plus, 
 X, 
 Flame, 
 Droplets, 
 Timer, 
 Utensils, 
 Pill, 
 CheckSquare, 
 Lightbulb, 
 Save, 
 ChevronDown, 
 ChevronUp,
 BookmarkPlus,
 Stethoscope,
 Download,
 Upload,
 AlertTriangle
} from 'lucide-react';
import { PlanConfig } from '../types';
import { 
 PlanPreset, 
 getAllPresets, 
 saveCustomPreset, 
 deleteCustomPreset, 
 createPresetFromPlan, 
 applyPresetToPlanDraft 
} from '../utils/planPresets';
import { serializePreset, parsePresetImport } from '../utils/presetIO';
import { SCENARIO_DISCLAIMER, isScenarioPreset } from '../utils/caseScenarios';

interface PresetsLibraryModalProps {
 currentDraft: PlanConfig;
 onApplyPreset: (newDraft: PlanConfig) => void;
 onClose: () => void;
 onNotify: (msg: string) => void;
}

export const PresetsLibraryModal: React.FC<PresetsLibraryModalProps> = ({
 currentDraft,
 onApplyPreset,
 onClose,
 onNotify,
}) => {
 const [presets, setPresets] = useState<PlanPreset[]>(getAllPresets);
 const [selectedCategory, setSelectedCategory] = useState<string>('all');
 const [previewPreset, setPreviewPreset] = useState<PlanPreset | null>(null);
 const [showSaveCustomModal, setShowSaveCustomModal] = useState(false);
 const [customPresetName, setCustomPresetName] = useState('');
 const [customPresetCategory, setCustomPresetCategory] = useState<PlanPreset['category']>('custom');
 const [customPresetSummary, setCustomPresetSummary] = useState('');
 // Batch 3.1: استيراد/تصدير JSON
 const importFileRef = useRef<HTMLInputElement | null>(null);
 const [importError, setImportError] = useState<string | null>(null);

 const handleExportPreset = (preset: PlanPreset, e?: React.MouseEvent) => {
 e?.stopPropagation();
 const blob = new Blob([serializePreset(preset)], { type: 'application/json;charset=utf-8' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `${preset.id}.json`;
 document.body.appendChild(a);
 a.click();
 a.remove();
 URL.revokeObjectURL(url);
 onNotify(`تم تصدير قالب «${preset.name}» كملف JSON `);
 };

 const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 e.target.value = '';
 if (!file) return;
 setImportError(null);
 try {
 const text = await file.text();
 const result = parsePresetImport(text);
 if (!result.ok) {
 // قالب تالف/ناقص: يُرفض برسالة واضحة ولا يمس أي خطة أو قالب قائم
 setImportError(result.error);
 onNotify(`تم رفض القالب المستورد: ${result.error}`);
 return;
 }
 const imported = result.preset;
 const collides = getAllPresets().some((p) => p.id === imported.id);
 const toSave: PlanPreset = {
...imported,
 id: collides? `custom_import_${Date.now()}`: imported.id,
 isCustom: true,
 createdAt: new Date().toISOString(),
 };
 if (saveCustomPreset(toSave)) {
 reloadPresets();
 onNotify(`تم استيراد قالب «${toSave.name}» إلى مكتبتك الخاصة `);
 } else {
 setImportError('حدث خطأ أثناء حفظ القالب المستورد.');
 }
 } catch {
 setImportError('تعذّرت قراءة ملف القالب.');
 }
 };

 const reloadPresets = () => {
 setPresets(getAllPresets());
 };

 const filteredPresets = presets.filter((p) => {
 if (selectedCategory === 'all') return true;
 if (selectedCategory === 'custom') return p.isCustom;
 return p.category === selectedCategory;
 });

 const handleApply = (preset: PlanPreset) => {
 const updated = applyPresetToPlanDraft(currentDraft, preset);
 onApplyPreset(updated);
 onNotify(`تم تطبيق قالب «${preset.name}» على خطة ${currentDraft.clientName || 'المتدرب'} بنجاح `);
 onClose();
 };

 const handleDeleteCustom = (preset: PlanPreset, e: React.MouseEvent) => {
 e.stopPropagation();
 if (window.confirm(`هل أنتِ متأكدة من حذف قالب «${preset.name}» من مكتبتك الخاصة؟`)) {
 deleteCustomPreset(preset.id);
 reloadPresets();
 if (previewPreset?.id === preset.id) {
 setPreviewPreset(null);
 }
 onNotify('تم حذف القالب المخصص من المكتبة ');
 }
 };

 const handleSaveCurrentAsPreset = (e: React.FormEvent) => {
 e.preventDefault();
 if (!customPresetName.trim()) {
 alert('الرجاء إدخال اسم للقالب الجديد');
 return;
 }

 const newPreset = createPresetFromPlan(
 currentDraft,
 customPresetName.trim(),
 customPresetCategory,
 customPresetSummary.trim()
 );

 const ok = saveCustomPreset(newPreset);
 if (ok) {
 reloadPresets();
 setShowSaveCustomModal(false);
 setCustomPresetName('');
 setCustomPresetSummary('');
 onNotify(`تم حفظ الخطة كقالب جديد «${newPreset.name}» في مكتبتك بنجاح `);
 } else {
 alert('حدث خطأ أثناء حفظ القالب.');
 }
 };

 const categories = [
 { id: 'all', label: 'كافة القوالب' },
 { id: 'medical', label: ' علاجي وتكيسات' },
 { id: 'weight_loss', label: ' نزول سريع' },
 { id: 'fitness', label: ' تنشيف ولياقة' },
 { id: 'keto', label: ' كيتو علاجي' },
 { id: 'maintenance', label: ' تثبيت وتوازن' },
 { id: 'custom', label: ' قوالبي الخاصة' },
 ];

 return (
 <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
 <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl border border-slate-200 dark:border-slate-800 app-overlay-shadow max-h-[92vh] flex flex-col overflow-hidden">
 
 {/* Modal Header */}
 <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/50">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-2xl dark: text-white flex items-center justify-center font-bold">
 <FolderHeart className="w-5 h-5" />
 </div>
 <div>
 <h3 className="font-black text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
 مكتبة القوالب العلاجية والغذائية 
 <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-peacock-pale dark:bg-peacock-ink-deep text-peacock-indigo-dark dark:text-peacock-teal-light">
 {presets.length} قوالب جاهزة
 </span>
 </h3>
 <p className="text-xs text-slate-500 dark:text-slate-400">
 اختاري القالب المناسب لحالة المتدرب لتطبيقه وتعديله فوراً في ثوانٍ
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <input
 ref={importFileRef}
 type="file"
 accept="application/json,.json"
 className="hidden"
 onChange={handleImportFile}
 />
 <button
 onClick={() => importFileRef.current?.click()}
 className="px-3 py-2 rounded-2xl text-xs font-black bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
 title="استيراد قالب من ملف JSON (يُتحقق من سلامته قبل الحفظ)"
 >
 <Upload className="w-4 h-4" />
 <span className="hidden sm:inline">استيراد قالب JSON</span>
 </button>

 <button
 onClick={() => setShowSaveCustomModal(true)}
 className="px-3 py-2 rounded-2xl text-xs font-black bg-peacock-indigo hover:bg-peacock-indigo-dark text-white transition-all flex items-center gap-1.5 cursor-pointer"
 >
 <BookmarkPlus className="w-4 h-4" />
 <span className="hidden sm:inline">حفظ الخطة الحالية كقالب </span>
 </button>

 <button
 onClick={onClose}
 className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 </div>

 {/* Categories Bar */}
 <div className="px-4 sm:px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 flex gap-1.5 overflow-x-auto bg-white dark:bg-slate-900">
 {categories.map((c) => {
 const isSelected = selectedCategory === c.id;
 return (
 <button
 key={c.id}
 onClick={() => setSelectedCategory(c.id)}
 className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
 isSelected
? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
 }`}
 >
 {c.label}
 </button>
 );
 })}
 </div>

 {/* Body content: Presets Cards Grid */}
 <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
 {importError && (
 <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-start gap-2">
 <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
 <span>تم رفض القالب المستورد — {importError} لم يتم تغيير أي خطة أو قالب قائم.</span>
 </div>
 )}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {filteredPresets.map((preset) => {
 return (
 <div
 key={preset.id}
 className="bg-white dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 rounded-3xl p-4 sm:p-5 flex flex-col justify-between hover:border-peacock-blue/50 hover: transition-all group"
 >
 <div className="space-y-3">
 {/* Top Tag & Actions */}
 <div className="flex items-start justify-between gap-2">
 <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-black rounded-xl border ${preset.tagColor}`}>
 <span>{preset.icon}</span>
 <span>{preset.badge}</span>
 </span>

 <div className="flex items-center gap-1">
 <button
 onClick={(e) => handleExportPreset(preset, e)}
 title="تصدير القالب كملف JSON"
 className="p-1.5 text-slate-500 hover:text-peacock-indigo hover:bg-peacock-mist dark:hover:bg-peacock-ink-deep/40 rounded-xl transition-colors cursor-pointer"
 >
 <Download className="w-4 h-4" />
 </button>
 {preset.isCustom && (
 <button
 onClick={(e) => handleDeleteCustom(preset, e)}
 title="حذف القالب المخصص"
 className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 )}
 </div>
 </div>

 {/* Title & Description */}
 <div>
 <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-snug">
 {preset.name}
 </h4>
 <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">
 {preset.description}
 </p>
 {isScenarioPreset(preset) && (
 <p className="text-[11px] font-black text-amber-700 dark:text-amber-300 mt-1.5 flex items-center gap-1">
 <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
 {SCENARIO_DISCLAIMER}
 </p>
 )}
 </div>

 {/* Quick Stats Grid */}
 <div className="grid grid-cols-3 gap-2 pt-1 text-center">
 <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-2xl border border-slate-100 dark:border-slate-800">
 <span className="text-[12px] text-slate-400 font-bold block">السعرات</span>
 <span className="text-xs font-black text-slate-800 dark:text-slate-100">
 {preset.targetCalories} kcal
 </span>
 </div>

 <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-2xl border border-slate-100 dark:border-slate-800">
 <span className="text-[12px] text-slate-400 font-bold block">البروتين</span>
 <span className="text-xs font-black text-peacock-indigo dark:text-peacock-teal">
 {preset.targetProtein} جم
 </span>
 </div>

 <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-2xl border border-slate-100 dark:border-slate-800">
 <span className="text-[12px] text-slate-400 font-bold block">الصيام / الوجبات</span>
 <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
 {preset.fastingHours}h / {preset.mealsCount}و
 </span>
 </div>
 </div>

 {/* Macronutrient breakdown bar */}
 <div className="flex items-center gap-2 text-[12px] font-bold text-slate-500 dark:text-slate-400 pt-1">
 <span className="text-peacock-indigo dark:text-peacock-teal">P: {preset.targetProtein}g</span>
 <span>•</span>
 <span className="text-amber-600 dark:text-amber-400">C: {preset.targetCarbs}g</span>
 <span>•</span>
 <span className="text-rose-500 dark:text-rose-400">F: {preset.targetFats}g</span>
 <span>•</span>
 <span> {preset.dailyWaterGoalMl / 1000}L</span>
 </div>
 </div>

 {/* Card Action Buttons */}
 <div className="grid grid-cols-2 gap-2 pt-4 mt-3 border-t border-slate-100 dark:border-slate-800">
 <button
 onClick={() => setPreviewPreset(preset)}
 className="py-2.5 px-3 rounded-2xl text-xs font-black bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
 >
 <Eye className="w-3.5 h-3.5" />
 <span>معاينة التفاصيل</span>
 </button>

 <button
 onClick={() => handleApply(preset)}
 className="py-2.5 px-3 rounded-2xl text-xs font-black bg-peacock-indigo hover:bg-peacock-indigo-dark text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
 >
 <Zap className="w-3.5 h-3.5" />
 <span>تطبيق القالب </span>
 </button>
 </div>
 </div>
 );
 })}
 </div>

 {filteredPresets.length === 0 && (
 <div className="text-center py-12 space-y-3">
 <div className="w-12 h-12 rounded-full text-slate-400 flex items-center justify-center mx-auto">
 <FolderHeart className="w-6 h-6" />
 </div>
 <p className="text-sm font-bold text-slate-500">لا توجد قوالب في هذا التصنيف</p>
 </div>
 )}
 </div>

 {/* Modal Footer Note */}
 <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
 <span className="flex items-center gap-1.5 font-bold">
 <Circle className="w-4 h-4 text-peacock-blue" />
 <span>عند تطبيق القالب، سيتم الاحتفاظ باسم المتدرب الحالي وطوله ووزنه تلقائياً.</span>
 </span>
 <button
 onClick={onClose}
 className="px-4 py-1.5 rounded-xl font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors cursor-pointer"
 >
 إغلاق
 </button>
 </div>
 </div>

 {/* DETAILED PREVIEW DRAWER / MODAL */}
 {previewPreset && (
 <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in zoom-in-95 duration-150">
 <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 app-overlay-shadow max-h-[88vh] flex flex-col overflow-hidden">
 
 {/* Preview Header */}
 <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
 <div className="flex items-center gap-2.5">
 <span className="text-2xl">{previewPreset.icon}</span>
 <div>
 <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base">
 معاينة قالب: {previewPreset.name}
 </h4>
 <span className={`text-[12px] font-extrabold px-2 py-0.5 rounded-lg border ${previewPreset.tagColor}`}>
 {previewPreset.badge}
 </span>
 </div>
 </div>

 <button
 onClick={() => setPreviewPreset(null)}
 className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Preview Content */}
 <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
 {/* Summary box */}
 <div className="p-3.5 rounded-2xl bg-peacock-mist dark:bg-peacock-ink-deep/40 border border-peacock-sage dark:border-peacock-indigo-deep/60 space-y-1">
 <span className="font-black text-peacock-indigo-deep dark:text-peacock-teal-light block"> الهدف والوصف الطبي:</span>
 <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
 {previewPreset.description}
 </p>
 </div>

 {/* Batch 3.1: سيناريو الحالة — إخلاء مسؤولية + نص العميل + تنبيهات الأخصائية */}
 {previewPreset.scenario && (
 <div className="space-y-2.5">
 <div className={`p-3 rounded-2xl border text-[12px] font-black flex items-center gap-1.5 ${
 previewPreset.scenario.cautionLevel === 'high'
? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200'
: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200'
 }`}>
 <AlertTriangle className="w-4 h-4 shrink-0" />
 <span>{SCENARIO_DISCLAIMER}</span>
 </div>
 <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1">
 <span className="font-black text-slate-800 dark:text-slate-100 block">النص الإرشادي للعميل:</span>
 <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
 {previewPreset.scenario.clientGuidance}
 </p>
 </div>
 <div className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 space-y-1.5">
 <span className="font-black text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
 <Stethoscope className="w-4 h-4" />
 <span>تنبيهات للأخصائية قبل التطبيق:</span>
 </span>
 <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300 font-medium">
 {previewPreset.scenario.coachAlerts.map((a, aidx) => (
 <li key={aidx}>{a}</li>
 ))}
 </ul>
 </div>
 </div>
 )}

 {/* Meals list */}
 <div className="space-y-2.5">
 <h5 className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
 <Utensils className="w-4 h-4 text-peacock-indigo" />
 <span>الوجبات والبدائل المقررة ({previewPreset.planData.meals.length}):</span>
 </h5>
 <div className="space-y-2">
 {previewPreset.planData.meals.map((m, idx) => (
 <div key={m.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1.5">
 <div className="flex items-center justify-between font-black text-slate-800 dark:text-slate-100">
 <span>{idx + 1}. {m.name}</span>
 <span className="text-[12px] text-peacock-indigo dark:text-peacock-teal">{m.calories} كالوري | {m.proteinGrams}g بروتين</span>
 </div>
 <p className="text-slate-600 dark:text-slate-300 font-medium">
 <strong className="text-slate-700 dark:text-slate-200">المحتوى الأساسي:</strong> {m.items}
 </p>
 {m.alternatives && m.alternatives.length > 0 && (
 <div className="pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[12px] text-slate-500 dark:text-slate-400 space-y-0.5">
 <strong className="text-peacock-indigo-dark dark:text-peacock-teal block"> البدائل المعتمدة:</strong>
 {m.alternatives.map((alt, aidx) => (
 <div key={aidx}>• {alt}</div>
 ))}
 </div>
 )}
 </div>
 ))}
 </div>
 </div>

 {/* Supplements */}
 {previewPreset.planData.supplements && previewPreset.planData.supplements.length > 0 && (
 <div className="space-y-2">
 <h5 className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
 <Pill className="w-4 h-4 text-indigo-600" />
 <span>المكملات والفيتامينات المقترحة:</span>
 </h5>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 {previewPreset.planData.supplements.map((s) => (
 <div key={s.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
 <span className="font-bold text-slate-800 dark:text-slate-200">{s.name}</span>
 <span className="text-[12px] text-slate-400 font-medium">{s.time}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Habits */}
 {previewPreset.planData.checklist && previewPreset.planData.checklist.length > 0 && (
 <div className="space-y-2">
 <h5 className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
 <CheckSquare className="w-4 h-4 text-emerald-600" />
 <span>العادات والتعليمات اليومية:</span>
 </h5>
 <div className="space-y-1">
 {previewPreset.planData.checklist.map((c) => (
 <div key={c.id} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-medium flex items-center gap-2">
 <span className="text-peacock-indigo font-black"></span>
 <span>{c.label}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Doctor tips */}
 {previewPreset.planData.tips && previewPreset.planData.tips.length > 0 && (
 <div className="space-y-1.5 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
 <span className="font-black text-amber-900 dark:text-amber-200 flex items-center gap-1">
 <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
 <span>إرشادات {BRAND.doctorName} المرفقة:</span>
 </span>
 <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300 text-[12px]">
 {previewPreset.planData.tips.map((t, tidx) => (
 <li key={tidx}>{t}</li>
 ))}
 </ul>
 </div>
 )}
 </div>

 {/* Preview Footer Actions */}
 <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-3">
 <button
 onClick={() => setPreviewPreset(null)}
 className="px-4 py-2.5 rounded-2xl text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors cursor-pointer"
 >
 إغلاق المعاينة
 </button>

 <button
 onClick={() => {
 handleApply(previewPreset);
 }}
 className="px-6 py-2.5 rounded-2xl text-xs font-black bg-peacock-indigo hover:bg-peacock-indigo-dark text-white transition-all cursor-pointer flex items-center gap-1.5"
 >
 <Zap className="w-4 h-4" />
 <span>تطبيق هذا القالب على مسودة الخطة </span>
 </button>
 </div>
 </div>
 </div>
 )}

 {/* SAVE CURRENT PLAN AS CUSTOM PRESET MODAL */}
 {showSaveCustomModal && (
 <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in zoom-in-95 duration-150">
 <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 app-overlay-shadow p-5 space-y-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-xl dark: text-peacock-indigo flex items-center justify-center font-bold">
 <BookmarkPlus className="w-4 h-4" />
 </div>
 <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm">
 حفظ الخطة الحالية كقالب جديد 
 </h4>
 </div>
 <button onClick={() => setShowSaveCustomModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
 <X className="w-4 h-4" />
 </button>
 </div>

 <form onSubmit={handleSaveCurrentAsPreset} className="space-y-3 text-xs">
 <div>
 <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
 اسم القالب الجديد:
 </label>
 <input
 type="text"
 required
 placeholder="مثلاً: خطة نباتية خاصة / تنشيف سريع 1400 كالوري..."
 value={customPresetName}
 onChange={(e) => setCustomPresetName(e.target.value)}
 className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold outline-none focus:ring-2 focus:ring-peacock-blue"
 />
 </div>

 <div>
 <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
 التصنيف:
 </label>
 <select
 value={customPresetCategory}
 onChange={(e) => setCustomPresetCategory(e.target.value as any)}
 className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold outline-none"
 >
 <option value="custom">قالب مخصص عام</option>
 <option value="medical"> علاجي (مقاومة إنسولين / غدة / تكيسات)</option>
 <option value="weight_loss"> نزول وزن سريع</option>
 <option value="fitness"> تنشيف وبناء عضلات</option>
 <option value="keto"> كيتو دايت</option>
 <option value="maintenance"> تثبيت وتوازن</option>
 </select>
 </div>

 <div>
 <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
 ملاحظة أو ملخص سريع للقالب (اختياري):
 </label>
 <textarea
 rows={2}
 placeholder="وصف مختصر لمميزات هذا القالب وحالات استخدامه..."
 value={customPresetSummary}
 onChange={(e) => setCustomPresetSummary(e.target.value)}
 className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium outline-none focus:ring-2 focus:ring-peacock-blue"
 />
 </div>

 <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[12px] text-slate-500 space-y-1">
 <span>سيتم حفظ:</span>
 <div className="font-bold text-slate-700 dark:text-slate-300">
 {currentDraft.meals.length} وجبات وبدائل • {currentDraft.supplements?.length || 0} مكملات • {currentDraft.checklist.length} عادات • {currentDraft.targetCalories || 0} كالوري
 </div>
 </div>

 <div className="flex gap-2 pt-2">
 <button
 type="button"
 onClick={() => setShowSaveCustomModal(false)}
 className="flex-1 py-2.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
 >
 إلغاء
 </button>
 <button
 type="submit"
 className="flex-1 py-2.5 rounded-xl font-black bg-peacock-indigo hover:bg-peacock-indigo-dark text-white"
 >
 حفظ في مكتبتي 
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </div>
 );
};
