import React, { useState } from 'react';
import {
 TrendingUp,
 TrendingDown,
 Minus,
 Plus,
 Info,
 Calendar,
 X,
 ChevronLeft,
 ChevronDown,
 ChevronUp,
 Activity,
 FileText,
 Circle,
 CheckCircle2,
 AlertCircle
} from 'lucide-react';
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

interface LabTrackerSectionProps {
 plan: PlanConfig;
 onUpdatePlan: (updater: (prev: PlanConfig) => PlanConfig) => void;
 onNotify?: (msg: string) => void;
}

export const LabTrackerSection: React.FC<LabTrackerSectionProps> = ({
 plan,
 onUpdatePlan,
 onNotify,
}) => {
 const labConfig: LabTrackingConfig = plan.labTracking || {
 showToClient: true,
 allowClientAdd: false,
 entries: [],
 };

 const [selectedTestKey, setSelectedTestKey] = useState<string | null>(null);
 const [showAddModal, setShowAddModal] = useState(false);

 // Client add form state
 const [formTestId, setFormTestId] = useState<string>('fasting_glucose');
 const [formCustomName, setFormCustomName] = useState<string>('');
 const [formValue, setFormValue] = useState<string>('');
 const [formUnit, setFormUnit] = useState<string>('mg/dL');
 const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
 const [formNote, setFormNote] = useState<string>('');

 const grouped = groupLabEntriesByTest(labConfig.entries);
 const testKeys = Object.keys(grouped);

 // If section is hidden or empty with no client add permission
 if (!labConfig.showToClient) return null;
 if (testKeys.length === 0 &&!labConfig.allowClientAdd) return null;

 const handleOpenAdd = (presetTestId?: string) => {
 const selectedId = presetTestId || 'fasting_glucose';
 const meta = getLabTestMeta(selectedId);
 setFormTestId(selectedId);
 setFormCustomName('');
 setFormValue('');
 setFormUnit(meta.defaultUnit || 'mg/dL');
 setFormDate(new Date().toISOString().split('T')[0]);
 setFormNote('');
 setShowAddModal(true);
 };

 const handleTestIdChange = (id: string) => {
 setFormTestId(id);
 const meta = getLabTestMeta(id);
 if (meta.defaultUnit) {
 setFormUnit(meta.defaultUnit);
 }
 };

 const handleSaveClientEntry = (e: React.FormEvent) => {
 e.preventDefault();
 const valNum = parseFloat(formValue);
 if (isNaN(valNum)) {
 alert('يرجى إدخال قيمة رقمية صحيحة للتحليل');
 return;
 }

 if (formTestId === 'custom' &&!formCustomName.trim()) {
 alert('يرجى كتابة اسم التحليل');
 return;
 }

 const newEntry: LabEntry = {
 id: `lab_c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
 testId: formTestId,
 customName: formTestId === 'custom'? formCustomName.trim(): undefined,
 value: valNum,
 unit: formUnit.trim(),
 date: formDate,
 note: formNote.trim() || undefined,
 addedBy: 'client',
 createdAt: new Date().toISOString(),
 };

 onUpdatePlan((prev) => {
 const prevLab = prev.labTracking || {
 showToClient: true,
 allowClientAdd: true,
 entries: [],
 };
 return {
...prev,
 labTracking: {
...prevLab,
 entries: [...prevLab.entries, newEntry],
 lastUpdatedAt: new Date().toISOString(),
 lastUpdatedBy: 'client',
 },
 };
 });

 onNotify?.('تم تسجيل نتيجة التحليل بنجاح ');
 setShowAddModal(false);
 };

 // Selected test details for modal/expanded card
 const selectedEntries = selectedTestKey? grouped[selectedTestKey] || []: [];
 const selectedSummary = selectedEntries.length > 0? calculateTestTrend(selectedEntries): null;
 const selectedMeta = selectedSummary
? getLabTestMeta(selectedSummary.current.testId, selectedSummary.current.customName)
: null;

 return (
 <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 transition-colors space-y-4">
 {/* 1. Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-xl text-white flex items-center justify-center font-bold text-sm">
 
 </div>
 <div>
 <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
 سجل التحاليل والمؤشرات الحيوية
 </h3>
 <span className="text-[12px] text-slate-400">
 متابعة السكر، الدهون، الفيتامينات والنشاط الأيضي
 </span>
 </div>
 </div>

 {labConfig.allowClientAdd && (
 <button
 type="button"
 onClick={() => handleOpenAdd()}
 className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-peacock-mist hover:bg-peacock-pale dark:bg-peacock-ink-deep/60 dark:hover:bg-peacock-ink/60 text-peacock-indigo dark:text-peacock-teal-light border border-peacock-sage dark:border-peacock-indigo-deep text-xs font-bold transition-all"
 >
 <Plus className="w-3.5 h-3.5" />
 <span>إضافة تحليل </span>
 </button>
 )}
 </div>

 {/* 2. Empty State if no tests yet */}
 {testKeys.length === 0 && (
 <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-center space-y-2">
 <p className="text-xs text-slate-500 dark:text-slate-400">
 لم يتم تسجيل أي تحاليل معملية بعد.
 </p>
 {labConfig.allowClientAdd && (
 <button
 type="button"
 onClick={() => handleOpenAdd()}
 className="text-xs font-bold text-peacock-indigo dark:text-peacock-teal hover:underline"
 >
 + إضافة أول نتيجة تحليل الآن
 </button>
 )}
 </div>
 )}

 {/* 3. Compact Grid of Tracked Lab Tests */}
 {testKeys.length > 0 && (
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
 {testKeys.map((key) => {
 const entries = grouped[key];
 const summary = calculateTestTrend(entries);
 if (!summary) return null;

 const sample = summary.current;
 const meta = getLabTestMeta(sample.testId, sample.customName);

 const evalResult = meta.evaluator
? meta.evaluator(summary.current.value)
: {
 status: 'guideline' as const,
 label: meta.rangeGuidance.text,
 badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
 };

 return (
 <button
 key={key}
 type="button"
 onClick={() => setSelectedTestKey(key)}
 className="text-right p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 transition-all hover: group flex flex-col justify-between gap-2.5"
 >
 {/* Top: Icon + Name + Category */}
 <div className="flex items-center justify-between w-full">
 <div className="flex items-center gap-2">
 <span className="text-base">{meta.icon}</span>
 <span className="font-extrabold text-slate-800 dark:text-slate-100 text-xs group-hover:text-peacock-indigo dark:group-hover:text-peacock-teal transition-colors">
 {meta.shortName}
 </span>
 </div>

 <span className="text-[12px] text-slate-400 font-medium">
 {summary.current.date}
 </span>
 </div>

 {/* Middle: Big Value + Trend Arrow */}
 <div className="flex items-baseline justify-between w-full">
 <div className="flex items-baseline gap-1.5">
 <span className="text-lg font-black text-slate-900 dark:text-white">
 {summary.current.value}
 </span>
 <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
 {summary.current.unit}
 </span>
 </div>

 {/* Trend Indicator */}
 {summary.trend === 'up' && (
 <span className="inline-flex items-center gap-0.5 text-xs font-extrabold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded-md">
 <TrendingUp className="w-3 h-3" />
 <span>+{summary.diff}</span>
 </span>
 )}
 {summary.trend === 'down' && (
 <span className="inline-flex items-center gap-0.5 text-xs font-extrabold text-peacock-indigo dark:text-peacock-teal bg-peacock-mist dark:bg-peacock-ink-deep/60 px-1.5 py-0.5 rounded-md">
 <TrendingDown className="w-3 h-3" />
 <span>{summary.diff}</span>
 </span>
 )}
 {summary.trend === 'same' && (
 <span className="inline-flex items-center gap-0.5 text-xs font-bold text-slate-500 bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
 <Minus className="w-3 h-3" />
 <span>ثابت</span>
 </span>
 )}
 {summary.trend === 'none' && (
 <span className="text-[12px] text-slate-400">
 قراءة أولى
 </span>
 )}
 </div>

 {/* Bottom: Guidance status tag */}
 <div className="flex items-center justify-between w-full pt-1 border-t border-slate-200/50 dark:border-slate-700/40">
 <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full border truncate max-w-[200px] ${evalResult.badgeClass}`}>
 {evalResult.label}
 </span>
 <span className="text-[12px] text-peacock-indigo dark:text-peacock-teal font-bold transition-transform">
 عرض الرسم ←
 </span>
 </div>
 </button>
 );
 })}
 </div>
 )}

 {/* 4. Detailed Modal/Drawer when a test is selected */}
 {selectedTestKey && selectedSummary && selectedMeta && (
 <div
 className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
 onClick={() => setSelectedTestKey(null)}
 >
 <div
 className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 app-overlay-shadow space-y-5 animate-in zoom-in-95 duration-150 my-auto"
 onClick={(e) => e.stopPropagation()}
 >
 {/* Modal Header */}
 <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
 <div className="flex items-center gap-3">
 <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl border ${selectedMeta.color.bg} ${selectedMeta.color.border}`}>
 {selectedMeta.icon}
 </div>
 <div>
 <h4 className="font-extrabold text-slate-900 dark:text-white text-base">
 {selectedMeta.nameAr}
 </h4>
 <span className="text-xs text-slate-400 font-medium">
 {selectedEntries.length} قراءات مسجلة
 </span>
 </div>
 </div>

 <button
 type="button"
 onClick={() => setSelectedTestKey(null)}
 className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Latest Value Banner */}
 <div className="p-4 rounded-2xl bg-peacock-mist/80 dark:bg-peacock-ink-deep/30 border border-peacock-sage/70 dark:border-peacock-ink/50 flex items-center justify-between">
 <div>
 <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
 آخر قراءة ({selectedSummary.current.date})
 </span>
 <div className="flex items-baseline gap-1.5 mt-0.5">
 <span className="text-2xl font-black text-slate-900 dark:text-white">
 {selectedSummary.current.value}
 </span>
 <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
 {selectedSummary.current.unit}
 </span>
 </div>
 </div>

 <div className="text-left space-y-1">
 {selectedSummary.trend!== 'none' && selectedSummary.previous && (
 <span
 className={`inline-flex items-center gap-1 text-xs font-black px-2 py-0.5 rounded-lg ${
 selectedSummary.trend === 'up'
? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
: selectedSummary.trend === 'down'
? 'bg-peacock-pale dark:bg-peacock-ink-deep text-peacock-indigo dark:text-peacock-teal-light'
: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
 }`}
 >
 {selectedSummary.trend === 'up'? <TrendingUp className="w-3.5 h-3.5" />: selectedSummary.trend === 'down'? <TrendingDown className="w-3.5 h-3.5" />: <Minus className="w-3.5 h-3.5" />}
 <span>{selectedSummary.trend === 'up'? `+${selectedSummary.diff}`: selectedSummary.diff} عن السابقة</span>
 </span>
 )}
 <div className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">
 النطاق الإرشادي: <strong className="text-peacock-indigo dark:text-peacock-teal-light">{selectedMeta.rangeGuidance.text}</strong>
 </div>
 </div>
 </div>

 {/* Line Chart */}
 <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2">
 <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
 <span className="flex items-center gap-1.5">
 <Activity className="w-4 h-4 text-peacock-blue" />
 <span>تتبع الاتجاه عبر الزمن</span>
 </span>
 <span className="text-[12px] text-slate-400">
 المظلل بالأخضر: نطاق إرشادي
 </span>
 </div>
 <LabChart entries={selectedEntries} meta={selectedMeta} height={170} />
 </div>

 {/* Clinical Reference Explanation */}
 <div className="p-3.5 rounded-2xl bg-peacock-mist/50 dark:bg-peacock-ink-deep/20 border border-peacock-sage/60 dark:border-peacock-ink/40 text-xs text-peacock-ink dark:text-peacock-sage space-y-1">
 <div className="flex items-center gap-1.5 font-bold">
 <Circle className="w-4 h-4 text-peacock-blue" />
 <span>أهمية هذا المؤشر:</span>
 </div>
 <p className="leading-relaxed text-[12px] text-peacock-indigo-deep dark:text-peacock-teal-light">
 {selectedMeta.rangeGuidance.hint || selectedMeta.rangeGuidance.text}
 </p>
 </div>

 {/* Historical Readings Log */}
 <div className="space-y-2">
 <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">
 تاريخ القراءات المسجلة:
 </h5>
 <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800">
 {selectedSummary.allSorted
.slice()
.reverse()
.map((item) => (
 <div
 key={item.id}
 className="p-3 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 text-xs"
 >
 <div>
 <div className="flex items-center gap-2">
 <span className="font-extrabold text-slate-900 dark:text-white">
 {item.value} {item.unit}
 </span>
 <span className="text-[12px] text-slate-400 font-medium">
 {item.date}
 </span>
 </div>
 {item.note && (
 <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 italic">
 {item.note}
 </p>
 )}
 </div>

 <span className={`text-[12px] font-bold px-1.5 py-0.5 rounded ${
 item.addedBy === 'coach'
? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
: 'bg-peacock-mist text-peacock-indigo-dark dark:bg-peacock-ink-deep dark:text-peacock-teal-light'
 }`}>
 {item.addedBy === 'coach'? ' الأخصائي': ' العميل'}
 </span>
 </div>
 ))}
 </div>
 </div>

 {/* Action buttons */}
 <div className="flex items-center justify-between pt-2">
 {labConfig.allowClientAdd? (
 <button
 type="button"
 onClick={() => {
 setSelectedTestKey(null);
 handleOpenAdd(selectedMeta.id);
 }}
 className="px-4 py-2 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo text-white font-bold text-xs transition-all flex items-center gap-1.5"
 >
 <Plus className="w-3.5 h-3.5" />
 <span>إضافة قراءة جديدة لهذا التحليل</span>
 </button>
 ): <div />}

 <button
 type="button"
 onClick={() => setSelectedTestKey(null)}
 className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors"
 >
 إغلاق
 </button>
 </div>
 </div>
 </div>
 )}

 {/* 5. Client Add Reading Modal */}
 {showAddModal && (
 <div
 className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
 onClick={() => setShowAddModal(false)}
 >
 <form
 onSubmit={handleSaveClientEntry}
 className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 app-overlay-shadow space-y-4 animate-in zoom-in-95 duration-150 my-auto"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
 <div className="flex items-center gap-2">
 <span className="text-lg"></span>
 <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
 تسجيل نتيجة تحليل معملي جديدة 
 </h4>
 </div>
 <button
 type="button"
 onClick={() => setShowAddModal(false)}
 className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
 >
 إلغاء 
 </button>
 </div>

 {/* Test Selector */}
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

 {formTestId === 'custom' && (
 <div className="space-y-1">
 <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
 اسم التحليل المخصص *
 </label>
 <input
 type="text"
 value={formCustomName}
 onChange={(e) => setFormCustomName(e.target.value)}
 placeholder="مثال: وظائف كبد أو حمض اليوريك"
 required
 className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-peacock-blue outline-none"
 />
 </div>
 )}

 <div className="grid grid-cols-2 gap-3">
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
 placeholder="مثال: 95"
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
 placeholder="mg/dL"
 required
 className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-peacock-blue outline-none"
 />
 </div>
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

 {/* Note */}
 <div className="space-y-1">
 <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
 ملاحظة (اختياري)
 </label>
 <input
 type="text"
 value={formNote}
 onChange={(e) => setFormNote(e.target.value)}
 placeholder="مثال: تحليل بمعمل البرج بعد صيام 10 ساعات"
 className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-peacock-blue outline-none"
 />
 </div>

 {/* Reference info box */}
 {(() => {
 const meta = getLabTestMeta(formTestId, formCustomName);
 return (
 <div className="p-3 rounded-2xl bg-peacock-mist/60 dark:bg-peacock-ink-deep/30 border border-peacock-sage/60 dark:border-peacock-ink/40 text-xs text-peacock-ink dark:text-peacock-sage flex items-start gap-2">
 <Info className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal shrink-0 mt-0.5" />
 <div>
 <span className="font-bold">النطاق الإرشادي: </span>
 <span>{meta.rangeGuidance.text}</span>
 </div>
 </div>
 );
 })()}

 <div className="flex items-center justify-end gap-2 pt-2">
 <button
 type="button"
 onClick={() => setShowAddModal(false)}
 className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
 >
 إلغاء
 </button>
 <button
 type="submit"
 className="px-5 py-2 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo text-white text-xs font-bold transition-all"
 >
 حفظ النتيجة 
 </button>
 </div>
 </form>
 </div>
 )}

 {/* 6. Fixed Clinical & Lab Disclaimer */}
 <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-2">
 <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
 <span>
 <strong>تنويه سريري: </strong>
 {LAB_DISCLAIMER_NOTE}
 </span>
 </div>
 </div>
 );
};
