import React, { useState, useEffect, useMemo } from 'react';
import { BRAND } from '../config/brand';
import {
 NotificationSettings,
 SystemStatusInfo,
 getSystemNotificationStatus,
 requestNotificationPermission,
 sendTestNotification,
 saveNotificationSettings,
 getDeviceInfo,
 getMedicationSlotEstimatedTime,
} from '../utils/notifications';
import { PlanConfig, MedicationSlot } from '../types';
import { getAllScheduledDoses, WITH_FOOD_LABELS } from '../utils/medications';
import {
 Bell,
 Smartphone,
 BatteryCharging,
 CheckCircle2,
 AlertTriangle,
 XCircle,
 Volume2,
 Droplets,
 Utensils,
 Activity,
 Moon,
 Circle,
 RefreshCw,
 ShieldCheck,
 Pill,
 ChevronDown,
 ChevronUp,
 Scale,
 Timer,
 CheckSquare,
 Sunrise,
 Sliders,
 Flame,
} from 'lucide-react';

interface Props {
 isOpen: boolean;
 onClose: () => void;
 plan: PlanConfig;
 settings: NotificationSettings;
 onSave: (newSettings: NotificationSettings) => void;
}

const WEEKDAYS = [
 { val: 6, label: 'السبت' },
 { val: 0, label: 'الأحد' },
 { val: 1, label: 'الإثنين' },
 { val: 2, label: 'الثلاثاء' },
 { val: 3, label: 'الأربعاء' },
 { val: 4, label: 'الخميس' },
 { val: 5, label: 'الجمعة' },
];

export const NotificationSettingsModal: React.FC<Props> = ({
 isOpen,
 onClose,
 plan,
 settings: initialSettings,
 onSave,
}) => {
 const [settings, setSettings] = useState<NotificationSettings>(initialSettings);
 const [status, setStatus] = useState<SystemStatusInfo | null>(null);
 const [testSent, setTestSent] = useState<boolean>(false);
 const [requestingPerm, setRequestingPerm] = useState<boolean>(false);
 const [savedFeedback, setSavedFeedback] = useState<boolean>(false);
 const [activeGuideTab, setActiveGuideTab] = useState<'android' | 'ios' | 'none'>('none');

 // Accordion open states
 const [openSections, setOpenSections] = useState<Record<string, boolean>>({
 meals: true,
 medications: true,
 water: false,
 sleep: false,
 habits: false,
 streak: false,
 fasting: false,
 weight: false,
 workout: false,
 nightReview: false,
 guides: false,
 });

 const { isIOS, isAndroid } = getDeviceInfo();

 const toggleSection = (key: string) => {
 setOpenSections((prev) => ({
...prev,
 [key]:!prev[key],
 }));
 };

 const refreshStatus = async () => {
 const sysStatus = await getSystemNotificationStatus();
 setStatus(sysStatus);
 };

 useEffect(() => {
 if (isOpen) {
 setSettings(initialSettings);
 setTestSent(false);
 setSavedFeedback(false);
 refreshStatus();

 if (isAndroid) setActiveGuideTab('android');
 else if (isIOS &&!status?.isPWAStandalone) setActiveGuideTab('ios');
 }
 }, [isOpen, initialSettings]);

 // Active active non-PRN medications for preview
 const activeMedications = useMemo(() => {
 const items = plan.medicationPlan?.items || [];
 return items.filter((m) => m.active!== false);
 }, [plan.medicationPlan]);

 const scheduledMedDoses = useMemo(() => {
 return getAllScheduledDoses(activeMedications).filter((d) =>!d.isPRN);
 }, [activeMedications]);

 // Dynamic active badges summary
 const activeTagsSummary = useMemo(() => {
 if (!settings.enabled) return [];
 const tags: { label: string; color: string }[] = [];

 const activeMealsCount = settings.mealReminders.enabled
? settings.mealReminders.meals.filter((m) => m.enabled).length
: 0;
 if (activeMealsCount > 0) {
 tags.push({ label: `وجبات (${activeMealsCount})`, color: 'bg-peacock-ink-deep text-peacock-teal-light border-peacock-indigo-dark' });
 }

 if (settings.waterReminders.enabled) {
 tags.push({ label: `الماء (${settings.waterReminders.intervalMinutes} د)`, color: 'bg-cyan-950 text-cyan-300 border-cyan-700' });
 }

 if (settings.medicationReminders?.enabled) {
 const disabledSet = new Set(settings.medicationReminders.disabledMedicationIds || []);
 const enabledMedsCount = activeMedications.filter((m) =>!disabledSet.has(m.id)).length;
 if (enabledMedsCount > 0) {
 tags.push({ label: `أدوية (${enabledMedsCount})`, color: 'bg-peacock-ink-deep text-peacock-teal-light border-peacock-indigo' });
 }
 }

 if (settings.sleepReminder?.enabled) {
 tags.push({ label: 'النوم والراحة', color: 'bg-indigo-950 text-indigo-300 border-indigo-700' });
 }

 if (settings.habitsReminder?.enabled) {
 tags.push({ label: 'العادات والمكملات', color: 'bg-amber-950 text-amber-300 border-amber-700' });
 }

 if (settings.fastingReminders?.enabled) {
 tags.push({ label: 'الصيام المتقطع', color: 'bg-peacock-ink-deep text-peacock-teal-light border-peacock-indigo-dark' });
 }

 if (settings.weeklyWeightReminder?.enabled) {
 const dayName = WEEKDAYS.find((w) => w.val === (settings.weeklyWeightReminder.weekday ?? 6))?.label || 'السبت';
 tags.push({ label: `الوزن (${dayName})`, color: 'bg-pink-950 text-peacock-indigo-lighter border-pink-700' });
 }

 if (settings.workoutReminder?.enabled) {
 tags.push({ label: 'التمارين', color: 'bg-orange-950 text-orange-300 border-orange-700' });
 }

 if (settings.nightReviewReminder?.enabled) {
 tags.push({ label: 'المراجعة الليلية', color: 'bg-peacock-ink-deep text-peacock-teal-light border-peacock-indigo-dark' });
 }

 if (settings.streakReminder?.enabled) {
 tags.push({ label: 'السلسلة في خطر', color: 'bg-orange-950 text-orange-300 border-orange-700' });
 }

 return tags;
 }, [settings, activeMedications]);

 if (!isOpen) return null;

 const handleRequestPermission = async () => {
 setRequestingPerm(true);
 const granted = await requestNotificationPermission();
 await refreshStatus();
 if (granted) {
 setSettings((prev) => ({...prev, enabled: true }));
 }
 setRequestingPerm(false);
 };

 const handleToggleMaster = async (checked: boolean) => {
 if (checked && status?.permission!== 'granted') {
 const granted = await requestNotificationPermission();
 await refreshStatus();
 if (!granted) return;
 }
 setSettings((prev) => ({...prev, enabled: checked }));
 };

 const handleMealTimeChange = (index: number, newTime: string) => {
 const updatedMeals = [...settings.mealReminders.meals];
 if (updatedMeals[index]) {
 updatedMeals[index] = {...updatedMeals[index], time: newTime };
 setSettings({
...settings,
 mealReminders: {
...settings.mealReminders,
 meals: updatedMeals,
 },
 });
 }
 };

 const handleMealToggle = (index: number, enabled: boolean) => {
 const updatedMeals = [...settings.mealReminders.meals];
 if (updatedMeals[index]) {
 updatedMeals[index] = {...updatedMeals[index], enabled };
 setSettings({
...settings,
 mealReminders: {
...settings.mealReminders,
 meals: updatedMeals,
 },
 });
 }
 };

 const handleToggleMedicationItem = (medId: string, enabled: boolean) => {
 const currentDisabled = new Set(settings.medicationReminders?.disabledMedicationIds || []);
 if (enabled) {
 currentDisabled.delete(medId);
 } else {
 currentDisabled.add(medId);
 }
 setSettings({
...settings,
 medicationReminders: {
...settings.medicationReminders,
 disabledMedicationIds: Array.from(currentDisabled),
 },
 });
 };

 const handleCustomSlotTimeChange = (slot: MedicationSlot, time: string) => {
 setSettings({
...settings,
 medicationReminders: {
...settings.medicationReminders,
 customSlotTimes: {
...(settings.medicationReminders?.customSlotTimes || {}),
 [slot]: time,
 },
 },
 });
 };

 const handleTestNotification = async (category: 'general' | 'meal' | 'water' | 'medication' | 'sleep' | 'workout' | 'fasting' | 'weight' = 'general') => {
 setTestSent(false);
 const success = await sendTestNotification(category);
 await refreshStatus();
 if (success) {
 setTestSent(true);
 setTimeout(() => setTestSent(false), 4500);
 } else if (status?.permission!== 'granted') {
 alert('يرجى منح إذن الإشعارات أولاً لتتمكن من تجربة التنبيه.');
 }
 };

 const handleSaveAndClose = () => {
 saveNotificationSettings(settings);
 onSave(settings);
 setSavedFeedback(true);
 setTimeout(() => {
 onClose();
 }, 400);
 };

 const resetToDefaultPreset = () => {
 const defaultTimes = ['08:30', '12:00', '15:30', '18:30', '21:30'];
 const updatedMeals = plan.meals.map((m, idx) => ({
 id: m.id,
 name: m.name,
 time: defaultTimes[idx % defaultTimes.length] || '13:00',
 enabled: true,
 }));

 setSettings((prev) => ({
...prev,
 enabled: true,
 sound: true,
 vibrate: true,
 waterReminders: {
 enabled: true,
 intervalMinutes: 60,
 startHour: 8,
 endHour: 23,
 },
 mealReminders: {
 enabled: true,
 meals: updatedMeals,
 },
 medicationReminders: {
 enabled: activeMedications.length > 0,
 offsetMinutesBeforeMeal: 15,
 disabledMedicationIds: [],
 customSlotTimes: {},
 },
 sleepReminder: {
 enabled: true,
 time: '22:30',
 morningCheckEnabled: true,
 morningTime: '08:00',
 },
 habitsReminder: {
 enabled: (plan.checklist?.length || 0) > 0 || (plan.supplements?.length || 0) > 0,
 time: '10:00',
 },
 weeklyWeightReminder: {
 enabled: true,
 weekday: 6,
 time: '09:00',
 },
 fastingReminders: {
 enabled: plan.enableFastingTimer!== false,
 notifyOnComplete: true,
 },
 workoutReminder: {
 enabled: true,
 time: '17:30',
 },
 nightReviewReminder: {
 enabled: true,
 time: '22:30',
 },
 }));
 };

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in overflow-y-auto dir-rtl">
 <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-xl app-overlay-shadow overflow-hidden my-4 flex flex-col max-h-[92vh]">
 {/* Header */}
 <div className="bg-peacock-mist/80 dark:bg-peacock-ink-deep/30 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-2xl backdrop-blur-md flex items-center justify-center text-xl shrink-0">
 <Bell className="w-5 h-5 text-white" />
 </div>
 <div>
 <h2 className="text-base sm:text-lg font-black">منظومة الإشعارات والتنبيهات المتقدمة</h2>
 <p className="text-[12px] text-peacock-pale">تغطية شاملة للوجبات، الأدوية، النوم، الصيام، والعادات</p>
 </div>
 </div>
 <button
 onClick={onClose}
 className="w-8 h-8 rounded-full hover: flex items-center justify-center transition-colors text-white font-bold text-sm cursor-pointer"
 >
 
 </button>
 </div>

 {/* Modal Body */}
 <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-200 divide-y divide-slate-800">
 {/* Active Summary Ribbon */}
 {settings.enabled && activeTagsSummary.length > 0 && (
 <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 space-y-1.5">
 <div className="flex items-center justify-between text-[12px] font-bold text-slate-400">
 <span className="flex items-center gap-1.5 text-peacock-teal">
 <Circle className="w-3.5 h-3.5" />
 <span>المفعّل حالياً في منظومة التنبيهات:</span>
 </span>
 <span className="text-[12px] text-slate-500">{activeTagsSummary.length} مسارات نشطة</span>
 </div>
 <div className="flex flex-wrap gap-1.5 pt-0.5">
 {activeTagsSummary.map((tag, idx) => (
 <span
 key={idx}
 className={`text-[12px] font-black px-2.5 py-1 rounded-lg border ${tag.color}`}
 >
 {tag.label}
 </span>
 ))}
 </div>
 </div>
 )}

 {/* System Health Status Dashboard */}
 <div className="space-y-2.5 pb-1">
 <div className="flex items-center justify-between">
 <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
 <ShieldCheck className="w-4 h-4 text-emerald-400" />
 حالة جاهزية الإشعارات بالجهاز:
 </span>
 <button
 onClick={refreshStatus}
 className="text-[12px] text-peacock-teal hover:text-peacock-teal-light font-bold flex items-center gap-1 cursor-pointer"
 >
 <RefreshCw className="w-3 h-3" />
 <span>فحص حي</span>
 </button>
 </div>

 <div className="grid grid-cols-3 gap-2 text-[12px] sm:text-xs">
 {/* SW Status */}
 <div className="p-2 rounded-xl bg-slate-800/90 border border-slate-700/80 text-center space-y-0.5">
 <span className="text-slate-400 block">Service Worker</span>
 {status?.swActive? (
 <span className="font-black text-peacock-teal flex items-center justify-center gap-1">
 <CheckCircle2 className="w-3 h-3" /> نشط وجاهز
 </span>
 ): (
 <span className="font-bold text-amber-400 flex items-center justify-center gap-1">
 <RefreshCw className="w-3 h-3 animate-spin" /> جاري التهيئة
 </span>
 )}
 </div>

 {/* Permission Status */}
 <div className="p-2 rounded-xl bg-slate-800/90 border border-slate-700/80 text-center space-y-0.5">
 <span className="text-slate-400 block">صلاحية التنبيه</span>
 {status?.permission === 'granted'? (
 <span className="font-black text-peacock-teal flex items-center justify-center gap-1">
 <CheckCircle2 className="w-3 h-3" /> مسموح
 </span>
 ): status?.permission === 'denied'? (
 <span className="font-bold text-rose-400 flex items-center justify-center gap-1">
 <XCircle className="w-3 h-3" /> محظور
 </span>
 ): (
 <span className="font-bold text-amber-400 flex items-center justify-center gap-1">
 <AlertTriangle className="w-3 h-3" /> تحتاج موافقة
 </span>
 )}
 </div>

 {/* App Mode / Background */}
 <div className="p-2 rounded-xl bg-slate-800/90 border border-slate-700/80 text-center space-y-0.5">
 <span className="text-slate-400 block">نمط التطبيق</span>
 {status?.isPWAStandalone? (
 <span className="font-black text-cyan-400 flex items-center justify-center gap-1">
 <Smartphone className="w-3 h-3" /> PWA مثبت
 </span>
 ): (
 <span className="font-bold text-slate-300 flex items-center justify-center gap-1">
 متصفح ويب
 </span>
 )}
 </div>
 </div>

 {/* Permission Action Banner */}
 {status?.permission === 'granted'? (
 <div className="bg-peacock-ink-deep/70 border border-peacock-blue/40 rounded-2xl p-3 flex items-center justify-between text-peacock-teal-light">
 <div className="flex items-center gap-2">
 <span className="w-2.5 h-2.5 rounded-full bg-peacock-teal "></span>
 <span className="text-xs font-bold">الإشعارات مفعلة ومستعدة للظهور </span>
 </div>
 <button
 onClick={() => handleTestNotification('general')}
 className="text-xs bg-peacock-indigo hover:bg-peacock-blue text-white font-bold px-3 py-1.5 rounded-xl transition-all shadow flex items-center gap-1 cursor-pointer"
 >
 <Circle className="w-3.5 h-3.5" />
 <span>تجربة إشعار حي</span>
 </button>
 </div>
 ): status?.permission === 'denied'? (
 <div className="bg-rose-950/70 border border-rose-500/40 rounded-2xl p-3 text-xs text-rose-300 space-y-1">
 <p className="font-bold flex items-center gap-1.5">
 <AlertTriangle className="w-4 h-4 text-rose-400" />
 <span>إذن الإشعارات محظور في إعدادات متصفح جهازك</span>
 </p>
 <p className="text-slate-300 text-[12px]">
 لتفعيله، اضغط على علامة القفل/الإعدادات بجوار شريط عنوان المتصفح واختر "السماح بالإشعارات" (Allow Notifications).
 </p>
 </div>
 ): (
 <div className="bg-amber-950/70 border border-amber-500/40 rounded-2xl p-3 flex items-center justify-between gap-3 text-amber-300">
 <div className="text-xs">
 <span className="font-bold block">إذن الإشعارات غير مفعل</span>
 <span className="text-amber-200/80 text-[12px]">اضغط للموافقة على تلقي التنبيهات المجدولة</span>
 </div>
 <button
 onClick={handleRequestPermission}
 disabled={requestingPerm}
 className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl transition-all shadow cursor-pointer"
 >
 {requestingPerm? 'جاري الطلب...': 'تفعيل الإشعارات '}
 </button>
 </div>
 )}

 {testSent && (
 <div className="text-xs text-peacock-teal bg-peacock-ink-deep/80 p-2.5 rounded-xl border border-peacock-blue/40 text-center font-bold flex items-center justify-center gap-1">
 <Circle className="w-4 h-4" />
 <span>تم إرسال الإشعار التجريبي مع النغمة بنجاح! تفقد أعلى الشاشة.</span>
 </div>
 )}
 </div>

 {/* Master System Switch */}
 <div className="pt-3 flex items-center justify-between">
 <div>
 <h3 className="font-black text-white text-sm">تشغيل منظومة الإشعارات والتذكيرات العامة</h3>
 <p className="text-xs text-slate-400">المفتاح الرئيسي لكافة التنبيهات المجدولة تلقائياً</p>
 </div>
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={settings.enabled}
 onChange={(e) => handleToggleMaster(e.target.checked)}
 className="sr-only peer"
 />
 <div className="w-12 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
 </label>
 </div>

 {/* Sound & Tone Setting */}
 <div className="pt-3 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Volume2 className="w-4 h-4 text-peacock-teal" />
 <div>
 <h4 className="text-xs font-bold text-slate-200">صوت ونغمات التنبيه الموسيقية</h4>
 <p className="text-[12px] text-slate-400">نغمات لطيفة متخصصة لكل تصنيف (ماء، وجبات، أدوية، نوم)</p>
 </div>
 </div>
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={settings.sound}
 onChange={(e) => setSettings({...settings, sound: e.target.checked })}
 className="sr-only peer"
 />
 <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
 </label>
 </div>

 {/* ACCORDION 1: Meals Reminders Schedule */}
 <div className="pt-3">
 <div className="border border-slate-700/80 rounded-2xl overflow-hidden bg-slate-800/40">
 <button
 type="button"
 onClick={() => toggleSection('meals')}
 className="w-full p-3.5 flex items-center justify-between bg-slate-800/80 hover:bg-slate-750 transition-colors text-right cursor-pointer"
 >
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-xl flex items-center justify-center text-peacock-teal shrink-0">
 <Utensils className="w-4 h-4" />
 </div>
 <div>
 <h4 className="font-bold text-sm text-peacock-teal-light">مواعيد وتنبيهات الوجبات اليومية</h4>
 <p className="text-[12px] text-slate-400">
 {settings.mealReminders.enabled? `مفعل (${settings.mealReminders.meals.filter((m) => m.enabled).length} وجبات)`: 'معطل'}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
 <input
 type="checkbox"
 checked={settings.mealReminders.enabled}
 onChange={(e) =>
 setSettings({
...settings,
 mealReminders: {...settings.mealReminders, enabled: e.target.checked },
 })
 }
 className="sr-only peer"
 />
 <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
 </label>
 {openSections.meals? <ChevronUp className="w-4 h-4 text-slate-400" />: <ChevronDown className="w-4 h-4 text-slate-400" />}
 </div>
 </button>

 {openSections.meals && (
 <div className="p-3.5 space-y-2.5 border-t border-slate-700/60 animate-in fade-in">
 <div className="flex items-center justify-between">
 <span className="text-[12px] text-slate-400">اضبط وقت كل وجبة للتنبيه قبل أو عند حلول موعدها:</span>
 <button
 type="button"
 onClick={() => handleTestNotification('meal')}
 className="text-[12px] text-peacock-teal hover:text-peacock-teal-light font-bold underline cursor-pointer"
 >
 تجربة نغمة الوجبة 
 </button>
 </div>

 {settings.mealReminders.meals.length === 0? (
 <p className="text-xs text-slate-400 text-center py-2">لا توجد وجبات في الخطة.</p>
 ): (
 settings.mealReminders.meals.map((meal, idx) => (
 <div
 key={meal.id || idx}
 className="flex items-center justify-between bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5 gap-2"
 >
 <div className="flex items-center gap-2 min-w-0">
 <input
 type="checkbox"
 checked={meal.enabled}
 onChange={(e) => handleMealToggle(idx, e.target.checked)}
 className="w-4 h-4 rounded text-peacock-blue focus:ring-peacock-teal accent-peacock-blue cursor-pointer"
 />
 <span className={`text-xs font-bold truncate ${meal.enabled? 'text-slate-100': 'text-slate-500 line-through'}`}>
 {meal.name}
 </span>
 </div>

 <div className="flex items-center gap-1.5 shrink-0">
 <span className="text-[12px] text-slate-400">الوقت:</span>
 <input
 type="time"
 value={meal.time}
 onChange={(e) => handleMealTimeChange(idx, e.target.value)}
 disabled={!meal.enabled}
 className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-peacock-teal font-mono font-bold focus:border-peacock-blue focus:outline-none disabled:opacity-40"
 />
 </div>
 </div>
 ))
 )}
 </div>
 )}
 </div>
 </div>

 {/* ACCORDION 2: Medications & Clinical Timings (High Priority) */}
 <div className="pt-3">
 <div className="border border-slate-700/80 rounded-2xl overflow-hidden bg-slate-800/40">
 <button
 type="button"
 onClick={() => toggleSection('medications')}
 className="w-full p-3.5 flex items-center justify-between bg-slate-800/80 hover:bg-slate-750 transition-colors text-right cursor-pointer"
 >
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-xl flex items-center justify-center text-peacock-teal shrink-0">
 <Pill className="w-4 h-4" />
 </div>
 <div>
 <h4 className="font-bold text-sm text-peacock-teal-light">مواعيد وجرعات الأدوية العلاجية </h4>
 <p className="text-[12px] text-slate-400">
 {settings.medicationReminders?.enabled
? `مفعل (${activeMedications.length} أدوية مسجلة بالخطة)`
: 'معطل'}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
 <input
 type="checkbox"
 checked={settings.medicationReminders?.enabled || false}
 onChange={(e) =>
 setSettings({
...settings,
 medicationReminders: {
...settings.medicationReminders,
 enabled: e.target.checked,
 },
 })
 }
 className="sr-only peer"
 />
 <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-peacock-blue"></div>
 </label>
 {openSections.medications? <ChevronUp className="w-4 h-4 text-slate-400" />: <ChevronDown className="w-4 h-4 text-slate-400" />}
 </div>
 </button>

 {openSections.medications && (
 <div className="p-3.5 space-y-3 border-t border-slate-700/60 animate-in fade-in">
 <div className="flex items-center justify-between text-xs">
 <span className="text-slate-300 font-bold">توقيت الجرعات المرتبطة بالوجبات:</span>
 <button
 type="button"
 onClick={() => handleTestNotification('medication')}
 className="text-[12px] text-peacock-teal hover:text-peacock-teal-light font-bold underline cursor-pointer"
 >
 تجربة نغمة الدواء 
 </button>
 </div>

 {/* Offset selector */}
 <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-2.5 flex items-center justify-between text-xs">
 <div>
 <span className="font-bold text-slate-200 block">فارق التنبيه قبل/بعد الوجبة:</span>
 <span className="text-[12px] text-slate-400">للجرعات المحددة (قبل الإفطار / بعد الغداء، إلخ)</span>
 </div>
 <select
 value={settings.medicationReminders?.offsetMinutesBeforeMeal || 15}
 onChange={(e) =>
 setSettings({
...settings,
 medicationReminders: {
...settings.medicationReminders,
 offsetMinutesBeforeMeal: Number(e.target.value),
 },
 })
 }
 className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-peacock-teal font-bold focus:outline-none"
 >
 <option value={15}>15 دقيقة</option>
 <option value={30}>30 دقيقة</option>
 <option value={45}>45 دقيقة</option>
 <option value={60}>60 دقيقة</option>
 </select>
 </div>

 {/* List of active medications */}
 {activeMedications.length === 0? (
 <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
 لم يُضف الأخصائي أدوية في خطتك الحالية بعد. عند إضافة أي علاج سيتم تفعيله هنا تلقائياً.
 </div>
 ): (
 <div className="space-y-2">
 <span className="text-[12px] font-bold text-slate-400 block">الأدوية المقررة بالخطة وإمكانية استثناء دواء محدد:</span>
 {activeMedications.map((med) => {
 const disabledSet = new Set(settings.medicationReminders?.disabledMedicationIds || []);
 const isMedEnabled =!disabledSet.has(med.id);
 const timings = med.timings || [];

 return (
 <div
 key={med.id}
 className={`p-3 rounded-xl border transition-all ${
 isMedEnabled
? 'bg-slate-900/90 border-peacock-indigo-deep/60 text-slate-200'
: 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-60'
 }`}
 >
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-2 min-w-0">
 <input
 type="checkbox"
 checked={isMedEnabled}
 onChange={(e) => handleToggleMedicationItem(med.id, e.target.checked)}
 className="w-4 h-4 rounded text-peacock-blue focus:ring-peacock-teal accent-peacock-blue cursor-pointer"
 />
 <div className="min-w-0">
 <span className="font-bold text-xs truncate block">{med.name}</span>
 <span className="text-[12px] text-slate-400">الجرعة: {med.dose}</span>
 </div>
 </div>

 {med.withFood && WITH_FOOD_LABELS[med.withFood] && (
 <span className={`text-[12px] px-2 py-0.5 rounded-md border font-bold ${WITH_FOOD_LABELS[med.withFood].badgeColor}`}>
 {WITH_FOOD_LABELS[med.withFood].label}
 </span>
 )}
 </div>

 {/* Timings preview */}
 <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
 {timings.map((t, idx) => {
 const approxTime = getMedicationSlotEstimatedTime(
 t.slot,
 settings.mealReminders.meals,
 settings.medicationReminders?.customSlotTimes,
 settings.medicationReminders?.offsetMinutesBeforeMeal || 15
 );

 return (
 <div
 key={idx}
 className="text-[12px] px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1.5"
 >
 <span>{t.label || t.slot}</span>
 {approxTime && (
 <span className="text-peacock-teal font-mono font-bold">({approxTime})</span>
 )}
 </div>
 );
 })}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 )}
 </div>
 </div>

 {/* ACCORDION 3: Water Reminders */}
 <div className="pt-3">
 <div className="border border-slate-700/80 rounded-2xl overflow-hidden bg-slate-800/40">
 <button
 type="button"
 onClick={() => toggleSection('water')}
 className="w-full p-3.5 flex items-center justify-between bg-slate-800/80 hover:bg-slate-750 transition-colors text-right cursor-pointer"
 >
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-xl flex items-center justify-center text-cyan-400 shrink-0">
 <Droplets className="w-4 h-4" />
 </div>
 <div>
 <h4 className="font-bold text-sm text-cyan-300">تذكير شرب الماء الدوري</h4>
 <p className="text-[12px] text-slate-400">
 {settings.waterReminders.enabled? `كل ${settings.waterReminders.intervalMinutes} دقيقة`: 'معطل'}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
 <input
 type="checkbox"
 checked={settings.waterReminders.enabled}
 onChange={(e) =>
 setSettings({
...settings,
 waterReminders: {...settings.waterReminders, enabled: e.target.checked },
 })
 }
 className="sr-only peer"
 />
 <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
 </label>
 {openSections.water? <ChevronUp className="w-4 h-4 text-slate-400" />: <ChevronDown className="w-4 h-4 text-slate-400" />}
 </div>
 </button>

 {openSections.water && (
 <div className="p-3.5 space-y-3 border-t border-slate-700/60 animate-in fade-in">
 <div className="flex items-center justify-between">
 <label className="text-slate-300 font-bold text-xs">معدل تكرار التنبيه بالماء:</label>
 <button
 type="button"
 onClick={() => handleTestNotification('water')}
 className="text-[12px] text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer"
 >
 تجربة صوت الماء 
 </button>
 </div>

 <div className="grid grid-cols-4 gap-2">
 {[
 { label: '45 دقيقة', val: 45 },
 { label: '60 دقيقة', val: 60 },
 { label: '90 دقيقة', val: 90 },
 { label: 'ساعتين', val: 120 },
 ].map((opt) => (
 <button
 key={opt.val}
 type="button"
 onClick={() =>
 setSettings({
...settings,
 waterReminders: {...settings.waterReminders, intervalMinutes: opt.val },
 })
 }
 className={`py-2 px-1 rounded-xl text-center font-bold text-xs transition-all border cursor-pointer ${
 settings.waterReminders.intervalMinutes === opt.val
? 'bg-cyan-600 text-white border-cyan-400'
: 'bg-slate-900/80 text-slate-400 border-slate-700 hover:border-slate-600'
 }`}
 >
 {opt.label}
 </button>
 ))}
 </div>

 <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
 <div>
 <label className="text-slate-300 block mb-1">من الساعة:</label>
 <select
 value={settings.waterReminders.startHour}
 onChange={(e) =>
 setSettings({
...settings,
 waterReminders: {...settings.waterReminders, startHour: Number(e.target.value) },
 })
 }
 className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-cyan-500 focus:outline-none"
 >
 {Array.from({ length: 24 }).map((_, i) => (
 <option key={i} value={i}>
 {i === 0? '12 منتصف الليل': i < 12? `${i} صباحاً`: i === 12? '12 ظهراً': `${i - 12} مساءً`}
 </option>
 ))}
 </select>
 </div>

 <div>
 <label className="text-slate-300 block mb-1">إلى الساعة:</label>
 <select
 value={settings.waterReminders.endHour}
 onChange={(e) =>
 setSettings({
...settings,
 waterReminders: {...settings.waterReminders, endHour: Number(e.target.value) },
 })
 }
 className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-cyan-500 focus:outline-none"
 >
 {Array.from({ length: 24 }).map((_, i) => (
 <option key={i} value={i}>
 {i === 0? '12 منتصف الليل': i < 12? `${i} صباحاً`: i === 12? '12 ظهراً': `${i - 12} مساءً`}
 </option>
 ))}
 </select>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* ACCORDION 4: Sleep & Recovery Reminders */}
 <div className="pt-3">
 <div className="border border-slate-700/80 rounded-2xl overflow-hidden bg-slate-800/40">
 <button
 type="button"
 onClick={() => toggleSection('sleep')}
 className="w-full p-3.5 flex items-center justify-between bg-slate-800/80 hover:bg-slate-750 transition-colors text-right cursor-pointer"
 >
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-xl flex items-center justify-center text-indigo-400 shrink-0">
 <Moon className="w-4 h-4" />
 </div>
 <div>
 <h4 className="font-bold text-sm text-indigo-300">مواعيد النوم والراحة والاستشفاء </h4>
 <p className="text-[12px] text-slate-400">
 {settings.sleepReminder?.enabled? `مساءً (${settings.sleepReminder.time})`: 'معطل'}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
 <input
 type="checkbox"
 checked={settings.sleepReminder?.enabled || false}
 onChange={(e) =>
 setSettings({
...settings,
 sleepReminder: {...settings.sleepReminder, enabled: e.target.checked },
 })
 }
 className="sr-only peer"
 />
 <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
 </label>
 {openSections.sleep? <ChevronUp className="w-4 h-4 text-slate-400" />: <ChevronDown className="w-4 h-4 text-slate-400" />}
 </div>
 </button>

 {openSections.sleep && (
 <div className="p-3.5 space-y-3 border-t border-slate-700/60 animate-in fade-in text-xs">
 <div className="flex items-center justify-between">
 <span className="text-slate-300 font-bold">تنبيه الاستعداد للنوم المسائي:</span>
 <button
 type="button"
 onClick={() => handleTestNotification('sleep')}
 className="text-[12px] text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer"
 >
 تجربة نغمة النوم 
 </button>
 </div>

 <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5 flex items-center justify-between gap-2">
 <div>
 <span className="text-xs font-bold text-slate-200 block">موعد الاسترخاء والنوم</span>
 <span className="text-[12px] text-slate-400">تذكير بأخذ قسط كافٍ لحماية الحرق والمناعة</span>
 </div>
 <input
 type="time"
 value={settings.sleepReminder?.time || '22:30'}
 onChange={(e) =>
 setSettings({
...settings,
 sleepReminder: {...settings.sleepReminder, time: e.target.value },
 })
 }
 className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-indigo-400 font-mono font-bold focus:border-indigo-500 focus:outline-none"
 />
 </div>

 {/* Morning Sleep Quality Check */}
 <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5 space-y-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Sunrise className="w-4 h-4 text-amber-400" />
 <div>
 <span className="text-xs font-bold text-slate-200 block">تذكير توثيق جودة النوم صباحاً</span>
 <span className="text-[12px] text-slate-400">تنبيه خفيف إذا لم تسجل ساعات النوم بعد</span>
 </div>
 </div>
 <input
 type="checkbox"
 checked={settings.sleepReminder?.morningCheckEnabled || false}
 onChange={(e) =>
 setSettings({
...settings,
 sleepReminder: {
...settings.sleepReminder,
 morningCheckEnabled: e.target.checked,
 },
 })
 }
 className="w-4 h-4 rounded text-indigo-500 accent-indigo-500 cursor-pointer"
 />
 </div>

 {settings.sleepReminder?.morningCheckEnabled && (
 <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
 <span className="text-[12px] text-slate-300">وقت التذكير الصباحي:</span>
 <input
 type="time"
 value={settings.sleepReminder?.morningTime || '08:00'}
 onChange={(e) =>
 setSettings({
...settings,
 sleepReminder: {
...settings.sleepReminder,
 morningTime: e.target.value,
 },
 })
 }
 className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-amber-400 font-mono font-bold focus:border-amber-500 focus:outline-none"
 />
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 </div>

 {/* ACCORDION 5: Daily Habits & Supplements */}
 <div className="pt-3">
 <div className="border border-slate-700/80 rounded-2xl overflow-hidden bg-slate-800/40">
 <button
 type="button"
 onClick={() => toggleSection('habits')}
 className="w-full p-3.5 flex items-center justify-between bg-slate-800/80 hover:bg-slate-750 transition-colors text-right cursor-pointer"
 >
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-xl flex items-center justify-center text-amber-400 shrink-0">
 <CheckSquare className="w-4 h-4" />
 </div>
 <div>
 <h4 className="font-bold text-sm text-amber-300">العادات والمكملات الغذائية </h4>
 <p className="text-[12px] text-slate-400">
 {settings.habitsReminder?.enabled? `يومياً (${settings.habitsReminder.time})`: 'معطل'}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
 <input
 type="checkbox"
 checked={settings.habitsReminder?.enabled || false}
 onChange={(e) =>
 setSettings({
...settings,
 habitsReminder: {...settings.habitsReminder, enabled: e.target.checked },
 })
 }
 className="sr-only peer"
 />
 <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
 </label>
 {openSections.habits? <ChevronUp className="w-4 h-4 text-slate-400" />: <ChevronDown className="w-4 h-4 text-slate-400" />}
 </div>
 </button>

 {openSections.habits && (
 <div className="p-3.5 space-y-2.5 border-t border-slate-700/60 animate-in fade-in text-xs">
 <p className="text-slate-300">
 تذكير يومي بتفقد قائمة مهام الالتزام والمكملات المقررة من قِبل {BRAND.doctorName}.
 </p>

 <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5 flex items-center justify-between gap-2">
 <div>
 <span className="font-bold text-slate-200 block">وقت التذكير اليومي</span>
 <span className="text-[12px] text-slate-400">
 {plan.supplements?.length || 0} مكملات • {plan.checklist?.length || 0} عادات بالخطة
 </span>
 </div>
 <input
 type="time"
 value={settings.habitsReminder?.time || '10:00'}
 onChange={(e) =>
 setSettings({
...settings,
 habitsReminder: {...settings.habitsReminder, time: e.target.value },
 })
 }
 className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-amber-400 font-mono font-bold focus:border-amber-500 focus:outline-none"
 />
 </div>
 </div>
 )}
 </div>
 </div>

 {/* ACCORDION 5.5: Streak At Risk (Batch 1.4) */}
 <div className="pt-3">
 <div className="border border-slate-700/80 rounded-2xl overflow-hidden bg-slate-800/40">
 <button
 type="button"
 onClick={() => toggleSection('streak')}
 className="w-full p-3.5 flex items-center justify-between bg-slate-800/80 hover:bg-slate-750 transition-colors text-right cursor-pointer"
 >
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-xl flex items-center justify-center text-orange-400 shrink-0">
 <Flame className="w-4 h-4" />
 </div>
 <div>
 <h4 className="font-bold text-sm text-orange-300">تنبيه «السلسلة في خطر» 🔥</h4>
 <p className="text-[12px] text-slate-400">
 {settings.streakReminder?.enabled? `يومياً (${settings.streakReminder.time || '20:30'}) عند غياب أي نشاط`: 'معطل'}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
 <input
 type="checkbox"
 checked={settings.streakReminder?.enabled || false}
 onChange={(e) =>
 setSettings({
...settings,
 streakReminder: { enabled: e.target.checked, time: settings.streakReminder?.time || '20:30' },
 })
 }
 className="sr-only peer"
 />
 <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
 </label>
 {openSections.streak? <ChevronUp className="w-4 h-4 text-slate-400" />: <ChevronDown className="w-4 h-4 text-slate-400" />}
 </div>
 </button>

 {openSections.streak && (
 <div className="p-3.5 space-y-2.5 border-t border-slate-700/60 animate-in fade-in text-xs">
 <p className="text-slate-300">
 تذكير مسائي ودي يصلك فقط لو سلسلة التزامك 3 أيام أو أكثر ولم تسجل أي نشاط اليوم — عشان تحافظ عليها قبل ما تنكسر.
 </p>

 <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5 flex items-center justify-between gap-2">
 <div>
 <span className="font-bold text-slate-200 block">وقت التنبيه المسائي</span>
 <span className="text-[12px] text-slate-400">الافتراضي 20:30 — قابل للإيقاف بالكامل من المفتاح بالأعلى</span>
 </div>
 <input
 type="time"
 value={settings.streakReminder?.time || '20:30'}
 onChange={(e) =>
 setSettings({
...settings,
 streakReminder: { enabled: settings.streakReminder?.enabled ?? true, time: e.target.value },
 })
 }
 className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-orange-400 font-mono font-bold focus:border-orange-500 focus:outline-none"
 />
 </div>
 </div>
 )}
 </div>
 </div>

 {/* ACCORDION 6: Intermittent Fasting Reminders */}
 <div className="pt-3">
 <div className="border border-slate-700/80 rounded-2xl overflow-hidden bg-slate-800/40">
 <button
 type="button"
 onClick={() => toggleSection('fasting')}
 className="w-full p-3.5 flex items-center justify-between bg-slate-800/80 hover:bg-slate-750 transition-colors text-right cursor-pointer"
 >
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-xl flex items-center justify-center text-peacock-teal shrink-0">
 <Timer className="w-4 h-4" />
 </div>
 <div>
 <h4 className="font-bold text-sm text-peacock-teal-light">الصيام المتقطع ونهاية النافذة ⏱</h4>
 <p className="text-[12px] text-slate-400">
 {settings.fastingReminders?.enabled? 'مفعل (تنبيه عند اكتمال الهدف)': 'معطل'}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
 <input
 type="checkbox"
 checked={settings.fastingReminders?.enabled || false}
 onChange={(e) =>
 setSettings({
...settings,
 fastingReminders: {...settings.fastingReminders, enabled: e.target.checked },
 })
 }
 className="sr-only peer"
 />
 <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-peacock-blue"></div>
 </label>
 {openSections.fasting? <ChevronUp className="w-4 h-4 text-slate-400" />: <ChevronDown className="w-4 h-4 text-slate-400" />}
 </div>
 </button>

 {openSections.fasting && (
 <div className="p-3.5 space-y-2.5 border-t border-slate-700/60 animate-in fade-in text-xs">
 <div className="flex items-center justify-between">
 <span className="text-slate-300">إشعار فوري عند اكتمال ساعات الصيام المقررة ({plan.fastingTargetHours || 16} ساعة):</span>
 <button
 type="button"
 onClick={() => handleTestNotification('fasting')}
 className="text-[12px] text-peacock-teal hover:text-peacock-teal-light font-bold underline cursor-pointer"
 >
 تجربة إشعار الصيام 
 </button>
 </div>

 <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5 flex items-center justify-between gap-2">
 <div>
 <span className="font-bold text-slate-200 block">إشعار فتح نافذة الأكل</span>
 <span className="text-[12px] text-slate-400">يُرسل التنبيه عند وصولك لهدف الصيام في العداد</span>
 </div>
 <span className="text-peacock-teal font-bold text-xs bg-peacock-ink-deep px-2 py-1 rounded-md border border-peacock-indigo-deep">
 تلقائي عند بلوغ الهدف
 </span>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* ACCORDION 7: Weekly Weight Measurement */}
 <div className="pt-3">
 <div className="border border-slate-700/80 rounded-2xl overflow-hidden bg-slate-800/40">
 <button
 type="button"
 onClick={() => toggleSection('weight')}
 className="w-full p-3.5 flex items-center justify-between bg-slate-800/80 hover:bg-slate-750 transition-colors text-right cursor-pointer"
 >
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-xl flex items-center justify-center text-peacock-indigo-light shrink-0">
 <Scale className="w-4 h-4" />
 </div>
 <div>
 <h4 className="font-bold text-sm text-peacock-indigo-lighter">قياس وتوثيق الوزن الأسبوعي </h4>
 <p className="text-[12px] text-slate-400">
 {settings.weeklyWeightReminder?.enabled
? `أسبوعياً (يوم ${WEEKDAYS.find((w) => w.val === (settings.weeklyWeightReminder.weekday ?? 6))?.label} - ${settings.weeklyWeightReminder.time})`
: 'معطل'}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
 <input
 type="checkbox"
 checked={settings.weeklyWeightReminder?.enabled || false}
 onChange={(e) =>
 setSettings({
...settings,
 weeklyWeightReminder: {
...settings.weeklyWeightReminder,
 enabled: e.target.checked,
 },
 })
 }
 className="sr-only peer"
 />
 <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-peacock-blue"></div>
 </label>
 {openSections.weight? <ChevronUp className="w-4 h-4 text-slate-400" />: <ChevronDown className="w-4 h-4 text-slate-400" />}
 </div>
 </button>

 {openSections.weight && (
 <div className="p-3.5 space-y-2.5 border-t border-slate-700/60 animate-in fade-in text-xs">
 <div className="flex items-center justify-between">
 <span className="text-slate-300 font-bold">تحديد موعد قياس الوزن الصباحي:</span>
 <button
 type="button"
 onClick={() => handleTestNotification('weight')}
 className="text-[12px] text-peacock-indigo-light hover:text-peacock-indigo-lighter font-bold underline cursor-pointer"
 >
 تجربة نغمة الوزن 
 </button>
 </div>

 <div className="grid grid-cols-2 gap-3 bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5">
 <div>
 <label className="text-slate-300 block mb-1 font-bold">يوم القياس المفضل:</label>
 <select
 value={settings.weeklyWeightReminder?.weekday ?? 6}
 onChange={(e) =>
 setSettings({
...settings,
 weeklyWeightReminder: {
...settings.weeklyWeightReminder,
 weekday: Number(e.target.value),
 },
 })
 }
 className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-peacock-indigo-light font-bold focus:outline-none"
 >
 {WEEKDAYS.map((w) => (
 <option key={w.val} value={w.val}>
 {w.label}
 </option>
 ))}
 </select>
 </div>

 <div>
 <label className="text-slate-300 block mb-1 font-bold">وقت التنبيه الصباحي:</label>
 <input
 type="time"
 value={settings.weeklyWeightReminder?.time || '09:00'}
 onChange={(e) =>
 setSettings({
...settings,
 weeklyWeightReminder: {
...settings.weeklyWeightReminder,
 time: e.target.value,
 },
 })
 }
 className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-peacock-indigo-light font-mono font-bold focus:border-peacock-blue focus:outline-none"
 />
 </div>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* ACCORDION 8: Workout & Activity */}
 <div className="pt-3">
 <div className="border border-slate-700/80 rounded-2xl overflow-hidden bg-slate-800/40">
 <button
 type="button"
 onClick={() => toggleSection('workout')}
 className="w-full p-3.5 flex items-center justify-between bg-slate-800/80 hover:bg-slate-750 transition-colors text-right cursor-pointer"
 >
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-xl flex items-center justify-center text-orange-400 shrink-0">
 <Activity className="w-4 h-4" />
 </div>
 <div>
 <h4 className="font-bold text-sm text-orange-300">النشاط والتمارين الرياضية ‍</h4>
 <p className="text-[12px] text-slate-400">
 {settings.workoutReminder?.enabled? `يومياً (${settings.workoutReminder.time})`: 'معطل'}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
 <input
 type="checkbox"
 checked={settings.workoutReminder.enabled}
 onChange={(e) =>
 setSettings({
...settings,
 workoutReminder: {...settings.workoutReminder, enabled: e.target.checked },
 })
 }
 className="sr-only peer"
 />
 <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
 </label>
 {openSections.workout? <ChevronUp className="w-4 h-4 text-slate-400" />: <ChevronDown className="w-4 h-4 text-slate-400" />}
 </div>
 </button>

 {openSections.workout && (
 <div className="p-3.5 space-y-2.5 border-t border-slate-700/60 animate-in fade-in text-xs">
 <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5 flex items-center justify-between gap-2">
 <div>
 <span className="font-bold text-slate-200 block">وقت تذكير الرياضة اليومي</span>
 <span className="text-[12px] text-slate-400">30 دقيقة مشي أو تمرين لحرق السعرات وتنشيط الدورة الدموية</span>
 </div>
 <input
 type="time"
 value={settings.workoutReminder.time}
 onChange={(e) =>
 setSettings({
...settings,
 workoutReminder: {...settings.workoutReminder, time: e.target.value },
 })
 }
 className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-orange-400 font-mono font-bold focus:border-orange-500 focus:outline-none"
 />
 </div>
 </div>
 )}
 </div>
 </div>

 {/* ACCORDION 9: Smart Night Review */}
 <div className="pt-3">
 <div className="border border-slate-700/80 rounded-2xl overflow-hidden bg-slate-800/40">
 <button
 type="button"
 onClick={() => toggleSection('nightReview')}
 className="w-full p-3.5 flex items-center justify-between bg-slate-800/80 hover:bg-slate-750 transition-colors text-right cursor-pointer"
 >
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-xl flex items-center justify-center text-peacock-teal shrink-0">
 <Circle className="w-4 h-4" />
 </div>
 <div>
 <h4 className="font-bold text-sm text-peacock-teal-light">المراجعة والتوثيق الليلي الذكي </h4>
 <p className="text-[12px] text-slate-400">
 {settings.nightReviewReminder?.enabled? `يومياً (${settings.nightReviewReminder.time})`: 'معطل'}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
 <input
 type="checkbox"
 checked={settings.nightReviewReminder.enabled}
 onChange={(e) =>
 setSettings({
...settings,
 nightReviewReminder: {...settings.nightReviewReminder, enabled: e.target.checked },
 })
 }
 className="sr-only peer"
 />
 <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-peacock-blue"></div>
 </label>
 {openSections.nightReview? <ChevronUp className="w-4 h-4 text-slate-400" />: <ChevronDown className="w-4 h-4 text-slate-400" />}
 </div>
 </button>

 {openSections.nightReview && (
 <div className="p-3.5 space-y-2.5 border-t border-slate-700/60 animate-in fade-in text-xs">
 <p className="text-slate-300">
 تنبيه ذكي يفحص يومك؛ وإذا وُجدت وجبات، ماء، أو أدوية لم تُوثّق بعد، يُلخّص الناقص باختصار لتسجيله قبل النوم.
 </p>

 <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5 flex items-center justify-between gap-2">
 <div>
 <span className="font-bold text-slate-200 block">وقت المراجعة والتقرير اليومي</span>
 <span className="text-[12px] text-slate-400">مشاركة التقرير اليومي وتثبيت نقاط الالتزام</span>
 </div>
 <input
 type="time"
 value={settings.nightReviewReminder.time}
 onChange={(e) =>
 setSettings({
...settings,
 nightReviewReminder: {...settings.nightReviewReminder, time: e.target.value },
 })
 }
 className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-peacock-teal font-mono font-bold focus:border-peacock-blue focus:outline-none"
 />
 </div>
 </div>
 )}
 </div>
 </div>

 {/* ACCORDION 10: OS Optimizations Guide */}
 <div className="pt-3">
 <div className="border border-slate-700/80 rounded-2xl overflow-hidden bg-slate-800/40">
 <button
 type="button"
 onClick={() => toggleSection('guides')}
 className="w-full p-3.5 flex items-center justify-between bg-slate-800/80 hover:bg-slate-750 transition-colors text-right cursor-pointer"
 >
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 shrink-0">
 <Smartphone className="w-4 h-4" />
 </div>
 <div>
 <h4 className="font-bold text-sm text-slate-200">دليل ضبط الهاتف (أندرويد وآيفون) </h4>
 <p className="text-[12px] text-slate-400">إرشادات تجاوز قيود توفير الطاقة والبطارية</p>
 </div>
 </div>
 {openSections.guides? <ChevronUp className="w-4 h-4 text-slate-400" />: <ChevronDown className="w-4 h-4 text-slate-400" />}
 </button>

 {openSections.guides && (
 <div className="p-3.5 space-y-3 border-t border-slate-700/60 animate-in fade-in">
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => setActiveGuideTab('android')}
 className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
 activeGuideTab === 'android'
? 'bg-peacock-ink-deep/80 border-peacock-blue text-peacock-teal-light'
: 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
 }`}
 >
 <BatteryCharging className="w-3.5 h-3.5 text-peacock-teal" />
 <span>دليل أندرويد (توفير البطارية)</span>
 </button>

 <button
 type="button"
 onClick={() => setActiveGuideTab('ios')}
 className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
 activeGuideTab === 'ios'
? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
: 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
 }`}
 >
 <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
 <span>دليل آيفون iOS (تثبيت PWA)</span>
 </button>
 </div>

 {/* Android Guide Content */}
 {activeGuideTab === 'android' && (
 <div className="p-3.5 rounded-2xl bg-peacock-ink-deep/40 border border-peacock-indigo-deep/80 space-y-2 text-xs leading-relaxed">
 <h5 className="font-black text-peacock-teal-light flex items-center gap-1.5">
 <BatteryCharging className="w-4 h-4 text-peacock-teal" />
 خطوة واحدة لضمان وصول التنبيهات دائماً في أندرويد (Unrestrict Battery):
 </h5>
 <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[12px]">
 <li>افتح إعدادات الهاتف التطبيقات (Apps).</li>
 <li>ابحث عن هذا التطبيق أو متصفحك الحالي (Chrome / Edge).</li>
 <li>اضغط على <b>"البطارية" (Battery)</b> وقم بتغيير الخيار إلى <b>"غير مقيد" (Unrestricted)</b>.</li>
 </ol>
 <p className="text-[12px] text-peacock-teal/90 italic">
 * هذا يمنع نظام أندرويد من إدخال الخدمة في وضع النوم (Doze Mode) ويضمن وصول الإشعارات في دقيقتها.
 </p>
 </div>
 )}

 {/* iOS Guide Content */}
 {activeGuideTab === 'ios' && (
 <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-800/80 space-y-2 text-xs leading-relaxed">
 <h5 className="font-black text-cyan-300 flex items-center gap-1.5">
 <Smartphone className="w-4 h-4 text-cyan-400" />
 تفعيل الإشعارات على الآيفون والآيباد (iOS PWA Setup):
 </h5>
 <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[12px]">
 <li>افتح التطبيق من متصفح <b>Safari</b> على هاتف الآيفون.</li>
 <li>اضغط على زر المشاركة <b>(Share Button )</b> في أسفل الشاشة.</li>
 <li>اختر <b>"إضافة إلى الشاشة الرئيسية" (Add to Home Screen )</b>.</li>
 <li>افتح التطبيق من أيقونة الشاشة الرئيسية الجديدة وقم بتفعيل الإشعارات من هنا.</li>
 </ol>
 </div>
 )}
 </div>
 )}
 </div>
 </div>

 {/* Quick Presets Reset */}
 <div className="pt-3 flex items-center justify-between text-xs">
 <button
 type="button"
 onClick={resetToDefaultPreset}
 className="text-peacock-teal hover:text-peacock-teal-light font-bold underline decoration-dashed flex items-center gap-1 cursor-pointer"
 >
 <span>إعادة ضبط المواعيد النموذجية لكافة الأقسام</span>
 </button>
 <span className="text-[12px] text-slate-500">محفوظة محلياً 100% على هاتفك</span>
 </div>
 </div>

 {/* Footer */}
 <div className="bg-slate-950 p-4 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
 <button
 onClick={onClose}
 className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
 >
 إلغاء
 </button>
 <button
 onClick={handleSaveAndClose}
 className="px-6 py-2.5 rounded-xl text-xs font-black text-slate-950 bg-peacock-teal hover:bg-peacock-teal-light transition-all flex items-center gap-2 cursor-pointer"
 >
 {savedFeedback? 'تم حفظ الإعدادات بنجاح ': 'حفظ ونشاط الإشعارات'}
 </button>
 </div>
 </div>
 </div>
 );
};
