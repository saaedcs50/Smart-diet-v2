import React, { useState } from 'react';
import {
 Plus,
 Trash2,
 Edit3,
 TrendingUp,
 TrendingDown,
 Minus,
 CheckCircle2,
 AlertTriangle,
 Info,
 Calendar,
 Circle,
 ChevronDown,
 ChevronUp,
 User,
 Stethoscope,
 Activity,
 FileText
, FlaskConical} from 'lucide-react';
import { PlanConfig, LabEntry, LabTrackingConfig } from '../types';
import {
 LAB_CATALOG,
 LAB_DISCLAIMER_NOTE,
 getLabTestMeta,
 calculateTestTrend,
 groupLabEntriesByTest,
 LabTestCatalogItem
} from '../utils/labTracking';
import { LabChart } from './LabChart';

interface LabTrackingManagerProps {
 draft: PlanConfig;
 onUpdateDraft: React.Dispatch<React.SetStateAction<PlanConfig>>;
 onNotify?: (msg: string) => void;
}

export const LabTrackingManager: React.FC<LabTrackingManagerProps> = ({
 draft,
 onUpdateDraft,
 onNotify,
}) => {
 const currentConfig: LabTrackingConfig = draft.labTracking || {
 showToClient: true,
 allowClientAdd: false,
 entries: [],
 };

 const [isAdding, setIsAdding] = useState(false);
 const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

 // Form state
 const [formTestId, setFormTestId] = useState<string>('fasting_glucose');
 const [formCustomName, setFormCustomName] = useState<string>('');
 const [formValue, setFormValue] = useState<string>('');
 const [formUnit, setFormUnit] = useState<string>('mg/dL');
 const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
 const [formNote, setFormNote] = useState<string>('');

 // Expanded card state for details & chart
 const [expandedTestKey, setExpandedTestKey] = useState<string | null>(null);

 // Update whole config
 const updateConfig = (updater: (prev: LabTrackingConfig) => LabTrackingConfig) => {
 onUpdateDraft((prev) => {
 const prevConf = prev.labTracking || {
 showToClient: true,
 allowClientAdd: false,
 entries: [],
 };
 const updated = updater(prevConf);
 return {
...prev,
 labTracking: {
...updated,
 lastUpdatedAt: new Date().toISOString(),
 lastUpdatedBy: 'coach',
 },
 };
 });
 };

 // Open add form
 const handleOpenAdd = (presetTestId?: string) => {
 const selectedId = presetTestId || 'fasting_glucose';
 const meta = getLabTestMeta(selectedId);
 setFormTestId(selectedId);
 setFormCustomName('');
 setFormValue('');
 setFormUnit(meta.defaultUnit || 'mg/dL');
 setFormDate(new Date().toISOString().split('T')[0]);
 setFormNote('');
 setEditingEntryId(null);
 setIsAdding(true);
 };

 // Open edit form
 const handleOpenEdit = (entry: LabEntry) => {
 setFormTestId(entry.testId);
 setFormCustomName(entry.customName || '');
 setFormValue(String(entry.value));
 setFormUnit(entry.unit);
 setFormDate(entry.date);
 setFormNote(entry.note || '');
 setEditingEntryId(entry.id);
 setIsAdding(true);
 };

 // Handle testId select change in form
 const handleTestIdChange = (id: string) => {
 setFormTestId(id);
 const meta = getLabTestMeta(id);
 if (meta.defaultUnit) {
 setFormUnit(meta.defaultUnit);
 }
 };

 // Save entry
 const handleSaveEntry = (e: React.FormEvent) => {
 e.preventDefault();
 const valNum = parseFloat(formValue);
 if (isNaN(valNum)) {
 alert('يرجى إدخال قيمة رقمية صحيحة للتحليل');
 return;
 }

 if (formTestId === 'custom' &&!formCustomName.trim()) {
 alert('يرجى كتابة اسم التحليل المخصص');
 return;
 }

 if (editingEntryId) {
 // Edit existing
 updateConfig((prev) => ({
...prev,
 entries: prev.entries.map((item) =>
 item.id === editingEntryId
? {
...item,
 testId: formTestId,
 customName: formTestId === 'custom'? formCustomName.trim(): undefined,
 value: valNum,
 unit: formUnit.trim(),
 date: formDate,
 note: formNote.trim() || undefined,
 }
: item
 ),
 }));
 onNotify?.('تم تعديل قراءة التحليل بنجاح ');
 } else {
 // Add new
 const newEntry: LabEntry = {
 id: `lab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
 testId: formTestId,
 customName: formTestId === 'custom'? formCustomName.trim(): undefined,
 value: valNum,
 unit: formUnit.trim(),
 date: formDate,
 note: formNote.trim() || undefined,
 addedBy: 'coach',
 createdAt: new Date().toISOString(),
 };
 updateConfig((prev) => ({
...prev,
 entries: [...prev.entries, newEntry],
 }));
 onNotify?.('تم تسجيل قراءة التحليل بنجاح ');
 }

 setIsAdding(false);
 setEditingEntryId(null);
 };

 // Delete entry
 const handleDeleteEntry = (id: string) => {
 if (!window.confirm('هل أنت متأكد من حذف هذه القراءة؟')) return;
 updateConfig((prev) => ({
...prev,
 entries: prev.entries.filter((item) => item.id!== id),
 }));
 onNotify?.('تم حذف القراءة');
 };

 // Delete all entries of a specific test
 const handleDeleteAllOfTest = (testKey: string, testName: string) => {
 if (!window.confirm(`هل أنت متأكد من حذف جميع قراءات تحليل "${testName}"؟`)) return;
 updateConfig((prev) => ({
...prev,
 entries: prev.entries.filter((item) => {
 const itemKey = item.testId === 'custom' && item.customName
? `custom__${item.customName.toLowerCase()}`
: item.testId;
 return itemKey!== testKey;
 }),
 }));
 onNotify?.(`تم حذف قراءات ${testName}`);
 };

 const grouped = groupLabEntriesByTest(currentConfig.entries);
 const testKeys = Object.keys(grouped);

 return (
 <div className="space-y-4">
 {/* 1. Header & Configuration Banner */}
 <div className="p-4 rounded-3xl bg-peacock-mist/80 dark:bg-peacock-ink-deep/30 border border-peacock-sage/80 dark:border-peacock-ink/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
 <div>
 <div className="flex items-center gap-2">
 <span className="text-xl"></span>
 <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">
 سجل ومتابعة التحاليل المعملية (Lab Tests)
 </h3>
 </div>
 <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed max-w-2xl">
 سجل نتائج تحاليل السكر التراكمي، دهون الدم، الفيتامينات، الغدة ومخزون الحديد لتتبع الاستجابة للتغذية وملاحظة المنحنى الزمني.
 </p>
 </div>

 <button
 type="button"
 onClick={() => handleOpenAdd()}
 className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-peacock-indigo hover:bg-peacock-indigo text-white font-bold text-xs transition-all shrink-0"
 >
 <Plus className="w-4 h-4" />
 <span>إضافة قراءة تحليل </span>
 </button>
 </div>

 {/* 2. Client Visibility & Permission Toggles */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {/* Toggle 1: Show to client */}
 <label className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
 <div className="space-y-0.5">
 <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
 إظهار قسم التحاليل للعميل في تاب الجسم 
 </span>
 <span className="text-[12px] text-slate-500 dark:text-slate-400">
 يستطيع العميل رؤية كروت التحاليل ورسم الاتجاه في ملف الجسم
 </span>
 </div>
 <input
 type="checkbox"
 checked={currentConfig.showToClient}
 onChange={(e) => updateConfig((prev) => ({...prev, showToClient: e.target.checked }))}
 className="w-5 h-5 accent-peacock-indigo rounded cursor-pointer"
 />
 </label>

 {/* Toggle 2: Allow client add */}
 <label className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
 <div className="space-y-0.5">
 <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
 السماح للعميل بإضافة قراءات جديدة 
 </span>
 <span className="text-[12px] text-slate-500 dark:text-slate-400">
 إتاحة زر إضافة للمتدرب (لا يمكنه حذف قراءات الأخصائي)
 </span>
 </div>
 <input
 type="checkbox"
 checked={currentConfig.allowClientAdd}
 onChange={(e) => updateConfig((prev) => ({...prev, allowClientAdd: e.target.checked }))}
 className="w-5 h-5 accent-peacock-indigo rounded cursor-pointer"
 />
 </label>
 </div>

 {/* 3. Add / Edit Reading Modal / Sheet */}
 {isAdding && (
 <form
 onSubmit={handleSaveEntry}
 className="p-5 rounded-3xl bg-white dark:bg-slate-900 border-2 border-peacock-blue/40 space-y-4 animate-in fade-in duration-200"
 >
 <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
 <div className="flex items-center gap-2">
 <span className="text-lg"></span>
 <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
 {editingEntryId? 'تعديل قراءة تحليل ': 'تسجيل قراءة تحليل جديدة '}
 </h4>
 </div>
 <button
 type="button"
 onClick={() => {
 setIsAdding(false);
 setEditingEntryId(null);
 }}
 className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold px-2 py-1"
 >
 إلغاء 
 </button>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
 {/* Test Type selector */}
 <div className="space-y-1">
 <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
 نوع التحليل *
 </label>
 <select
 value={formTestId}
 onChange={(e) => handleTestIdChange(e.target.value)}
 className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-peacock-blue outline-none"
 >
 {LAB_CATALOG.map((cat) => (
 <option key={cat.id} value={cat.id}>
 {cat.icon} {cat.nameAr}
 </option>
 ))}
 </select>
 </div>

 {/* Custom Name if selected 'custom' */}
 {formTestId === 'custom' && (
 <div className="space-y-1">
 <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
 اسم التحليل المخصص *
 </label>
 <input
 type="text"
 value={formCustomName}
 onChange={(e) => setFormCustomName(e.target.value)}
 placeholder="مثال: وظائف كبد ALT أو حمض اليوريك"
 required
 className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-peacock-blue outline-none"
 />
 </div>
 )}

 {/* Value */}
 <div className="space-y-1">
 <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
 النتيجة / القيمة *
 </label>
 <input
 type="number"
 step="any"
 value={formValue}
 onChange={(e) => setFormValue(e.target.value)}
 placeholder="مثال: 95 أو 5.6"
 required
 className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-peacock-blue outline-none"
 />
 </div>

 {/* Unit */}
 <div className="space-y-1">
 <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
 الوحدة *
 </label>
 <input
 type="text"
 value={formUnit}
 onChange={(e) => setFormUnit(e.target.value)}
 placeholder="mg/dL أو % أو ng/mL"
 required
 className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-peacock-blue outline-none"
 />
 </div>

 {/* Date */}
 <div className="space-y-1">
 <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
 تاريخ إجراء التحليل *
 </label>
 <input
 type="date"
 value={formDate}
 onChange={(e) => setFormDate(e.target.value)}
 required
 className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-peacock-blue outline-none"
 />
 </div>

 {/* Clinical Note */}
 <div className="space-y-1 sm:col-span-2">
 <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
 ملاحظة إكلينيكية / توصية (اختياري)
 </label>
 <input
 type="text"
 value={formNote}
 onChange={(e) => setFormNote(e.target.value)}
 placeholder="مثال: تحليل بعد جرعة فيتامين د الأسبوعية أو صيام 12 ساعة"
 className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-peacock-blue outline-none"
 />
 </div>
 </div>

 {/* Reference range guidance reminder box */}
 {(() => {
 const meta = getLabTestMeta(formTestId, formCustomName);
 return (
 <div className="p-3 rounded-2xl bg-peacock-mist/60 dark:bg-peacock-ink-deep/30 border border-peacock-sage/60 dark:border-peacock-ink/40 text-xs text-peacock-ink dark:text-peacock-sage flex items-start gap-2">
 <Info className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal shrink-0 mt-0.5" />
 <div>
 <span className="font-bold">النطاق الإرشادي العام: </span>
 <span>{meta.rangeGuidance.text}</span>
 {meta.rangeGuidance.hint && (
 <span className="block text-[12px] text-peacock-indigo dark:text-peacock-teal-light mt-0.5">
 {meta.rangeGuidance.hint}
 </span>
 )}
 </div>
 </div>
 );
 })()}

 <div className="flex items-center justify-end gap-2 pt-2">
 <button
 type="button"
 onClick={() => {
 setIsAdding(false);
 setEditingEntryId(null);
 }}
 className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
 >
 إلغاء
 </button>
 <button
 type="submit"
 className="px-5 py-2 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo text-white text-xs font-bold transition-all"
 >
 {editingEntryId? 'حفظ التعديل ': 'حفظ القراءة '}
 </button>
 </div>
 </form>
 )}

 {/* 4. Quick-start buttons if empty or want to quick-add common tests */}
 {testKeys.length === 0 &&!isAdding && (
 <div className="p-5 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
 <div className="w-10 h-10 mx-auto text-peacock-indigo dark:text-peacock-teal flex items-center justify-center">
 <FlaskConical className="w-8 h-8" />
 </div>
 <div>
 <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">
 لا توجد تحاليل مسجلة بعد
 </h4>
 <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
 سجل قراءات التحاليل لمتابعة تطور دهون الدم، السكر التراكمي، الفيتامينات والنشاط الأيضي عبر رسوم بيانية تفاعلية.
 </p>
 </div>

 <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
 <button
 type="button"
 onClick={() => handleOpenAdd('fasting_glucose')}
 className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold transition-all"
 >
 + سكر صائم
 </button>
 <button
 type="button"
 onClick={() => handleOpenAdd('hba1c')}
 className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-bold transition-all"
 >
 + السكر التراكمي
 </button>
 <button
 type="button"
 onClick={() => handleOpenAdd('vitamin_d')}
 className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold transition-all"
 >
 + فيتامين د
 </button>
 <button
 type="button"
 onClick={() => handleOpenAdd('ferritin')}
 className="px-3.5 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-900/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 text-xs font-bold transition-all"
 >
 + فيريتين
 </button>
 <button
 type="button"
 onClick={() => handleOpenAdd('triglycerides')}
 className="px-3.5 py-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/40 dark:hover:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 text-xs font-bold transition-all"
 >
 + دهون ثلاثية
 </button>
 <button
 type="button"
 onClick={() => handleOpenAdd('tsh')}
 className="px-3.5 py-2 rounded-xl bg-peacock-mist hover:bg-peacock-pale dark:bg-peacock-ink-deep/40 dark:hover:bg-peacock-ink/60 text-peacock-indigo-dark dark:text-peacock-teal-light border border-peacock-sage dark:border-peacock-indigo-deep text-xs font-bold transition-all"
 >
 + TSH غدة
 </button>
 </div>
 </div>
 )}

 {/* 5. Grouped Lab Tests List */}
 {testKeys.length > 0 && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
 التحاليل المسجلة ({testKeys.length} تحاليل • {currentConfig.entries.length} قراءة)
 </span>
 <button
 type="button"
 onClick={() => handleOpenAdd()}
 className="text-xs font-bold text-peacock-indigo dark:text-peacock-teal hover:underline flex items-center gap-1"
 >
 <Plus className="w-3.5 h-3.5" />
 <span>إضافة قراءة جديدة</span>
 </button>
 </div>

 <div className="grid grid-cols-1 gap-3.5">
 {testKeys.map((key) => {
 const entries = grouped[key];
 const summary = calculateTestTrend(entries);
 if (!summary) return null;

 const sample = summary.current;
 const meta = getLabTestMeta(sample.testId, sample.customName);
 const isExpanded = expandedTestKey === key;

 // Evaluation of latest reading
 const evalResult = meta.evaluator
? meta.evaluator(summary.current.value)
: {
 status: 'guideline' as const,
 label: `مرجع: ${meta.rangeGuidance.text}`,
 badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
 };

 return (
 <div
 key={key}
 className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden transition-all"
 >
 {/* Card Header Summary */}
 <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
 <div className="flex items-center gap-3">
 <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg border ${meta.color.bg} ${meta.color.border}`}>
 {meta.icon}
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
 {meta.nameAr}
 </h4>
 <span className="text-[12px] font-bold px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
 {meta.categoryLabel}
 </span>
 </div>
 <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
 <span>النطاق الإرشادي: <strong className="text-slate-700 dark:text-slate-300">{meta.rangeGuidance.text}</strong></span>
 </div>
 </div>
 </div>

 {/* Latest Value & Trend */}
 <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800">
 <div className="text-left">
 <div className="flex items-center gap-1.5 justify-end">
 <span className="text-base font-black text-slate-900 dark:text-white">
 {summary.current.value}
 </span>
 <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
 {summary.current.unit}
 </span>

 {/* Trend indicator */}
 {summary.trend === 'up' && (
 <span className="inline-flex items-center gap-0.5 text-xs font-extrabold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded-md">
 <TrendingUp className="w-3.5 h-3.5" />
 <span>+{summary.diff}</span>
 </span>
 )}
 {summary.trend === 'down' && (
 <span className="inline-flex items-center gap-0.5 text-xs font-extrabold text-peacock-indigo dark:text-peacock-teal bg-peacock-mist dark:bg-peacock-ink-deep/60 px-1.5 py-0.5 rounded-md">
 <TrendingDown className="w-3.5 h-3.5" />
 <span>{summary.diff}</span>
 </span>
 )}
 {summary.trend === 'same' && (
 <span className="inline-flex items-center gap-0.5 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
 <Minus className="w-3.5 h-3.5" />
 <span>ثابت</span>
 </span>
 )}
 </div>

 <div className="flex items-center justify-end gap-1.5 mt-0.5">
 <span className="text-[12px] text-slate-400">
 بتاريخ {summary.current.date}
 </span>
 <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full border ${evalResult.badgeClass}`}>
 {evalResult.label}
 </span>
 </div>
 </div>

 {/* Action buttons */}
 <div className="flex items-center gap-1">
 <button
 type="button"
 onClick={() => handleOpenAdd(sample.testId)}
 title="إضافة قراءة لهذا التحليل"
 className="p-2 rounded-xl bg-peacock-mist dark:bg-peacock-ink-deep/50 text-peacock-indigo dark:text-peacock-teal hover:bg-peacock-pale dark:hover:bg-peacock-ink/60 transition-colors"
 >
 <Plus className="w-4 h-4" />
 </button>
 <button
 type="button"
 onClick={() => setExpandedTestKey(isExpanded? null: key)}
 className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
 >
 {isExpanded? <ChevronUp className="w-4 h-4" />: <ChevronDown className="w-4 h-4" />}
 </button>
 </div>
 </div>
 </div>

 {/* Expandable Chart & History Table */}
 {isExpanded && (
 <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-4 animate-in fade-in duration-150">
 {/* Chart */}
 <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2">
 <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
 <span className="flex items-center gap-1.5">
 <Activity className="w-4 h-4 text-peacock-blue" />
 <span>رسم الاتجاه الزمني ({entries.length} قراءات)</span>
 </span>
 <span className="text-[12px] text-slate-400">
 النطاق الإرشادي مظلل بالأخضر
 </span>
 </div>
 <LabChart entries={entries} meta={meta} height={160} />
 </div>

 {/* History list */}
 <div className="space-y-2">
 <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
 <span>سجل القراءات التاريخية:</span>
 <button
 type="button"
 onClick={() => handleDeleteAllOfTest(key, meta.nameAr)}
 className="text-[12px] text-rose-500 hover:underline flex items-center gap-1"
 >
 <Trash2 className="w-3 h-3" />
 <span>حذف جميع قراءات هذا التحليل</span>
 </button>
 </div>

 <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
 {summary.allSorted
.slice()
.reverse()
.map((item, idx) => (
 <div
 key={item.id}
 className="p-3 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
 >
 <div className="space-y-0.5">
 <div className="flex items-center gap-2">
 <span className="font-extrabold text-slate-900 dark:text-white text-sm">
 {item.value} {item.unit}
 </span>
 <span className="text-[12px] text-slate-400 font-medium">
 {item.date}
 </span>
 <span className={`text-[12px] font-bold px-1.5 py-0.5 rounded ${
 item.addedBy === 'coach'
? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
: 'bg-peacock-mist text-peacock-indigo-dark dark:bg-peacock-ink-deep dark:text-peacock-teal-light'
 }`}>
 {item.addedBy === 'coach'? ' الأخصائي': ' العميل'}
 </span>
 </div>
 {item.note && (
 <p className="text-[12px] text-slate-600 dark:text-slate-400 italic">
 {item.note}
 </p>
 )}
 </div>

 <div className="flex items-center gap-1 shrink-0">
 <button
 type="button"
 onClick={() => handleOpenEdit(item)}
 className="p-1.5 rounded-lg text-slate-400 hover:text-peacock-indigo hover:bg-peacock-mist dark:hover:bg-peacock-ink-deep transition-colors"
 title="تعديل"
 >
 <Edit3 className="w-3.5 h-3.5" />
 </button>
 <button
 type="button"
 onClick={() => handleDeleteEntry(item.id)}
 className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
 title="حذف"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* 6. Clinical & Lab Disclaimer */}
 <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 leading-relaxed flex items-start gap-2">
 <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
 <span>
 <strong>تنويه مرجعي: </strong>
 {LAB_DISCLAIMER_NOTE}
 </span>
 </div>
 </div>
 );
};
