import React, { useState, useMemo, lazy, Suspense } from 'react';
import { BRAND, brandCopy } from '../config/brand';
import { CoachPinGate } from './coach/CoachPinGate';
import { StorageKeys } from '../utils/storageKeys';

import { 
 Settings, 
 Copy, 
 Download, 
 Upload, 
 RotateCcw, 
 Plus, 
 Trash2, 
 Save, 
 X, 
 Utensils, 
 CheckSquare, 
 Pill, 
 Lightbulb, 
 User,
 Sliders,
 Calculator,
 Flame,
 Timer,
 LayoutGrid,
 Eye,
 EyeOff,
 Droplets,
 Moon,
 Smile,
 Activity,
 Stethoscope,
 MessageSquare,
 Share2,
 Ruler,
 BarChart3,
 CheckCircle2,
 Circle,
 FolderHeart,
 BookmarkPlus,
 Zap,
 BookOpen,
 Heart,
 Wand2,
 Send,
 FileText,
 Code2,
 Smartphone,
 LogOut,
 Leaf,
 Fish,
 Sparkles,
 Search,
 FileDown,
 Printer
} from 'lucide-react';
import { MealItem, CheckItem, SupplementItem, PlanConfig, SectionVisibility, WeeklyFocusType } from '../types';
import { IntakeDraftRecord, loadIntakeDraft, clearIntakeDraft } from '../utils/intake';
import { loadNotificationSettings, saveNotificationSettings } from '../utils/notifications';
import { RAMADAN_SCENARIO } from '../utils/caseScenarios';
import {
 SeasonalActivation,
 loadSeasonalActivation,
 saveSeasonalActivation,
 buildSeasonalActivation,
 applySeasonalWaterReminders,
 restoreSeasonalWaterReminders,
 getSeasonalPhase,
 seasonalPhaseNotice,
 isValidSeasonRange,
} from '../utils/seasonalTemplate';
import { getWeekStartISO } from '../utils/shoppingList';
import { WEEKLY_FOCUS_TYPE_LABELS } from '../utils/weeklyFocus';
import { IntakeWizard } from './IntakeWizard';
import { DEFAULT_PLAN, DEFAULT_VISIBLE_SECTIONS, exportFullBackupJSON, importFullBackupJSON, isSectionVisible, loadDayLog, getTodayDateString, getAllStoredDayLogs, parseLocalDate } from '../utils/storage';
import { findLastActivityDate } from '../utils/welcomeBack';
import { calculateDayScore } from '../utils/calculations';
import { generateWhatsAppPlanMessage, generatePlanReadableText, generatePlanSyncCode } from '../utils/planShare';
// تحميل كسول للحاسبات الثقيلة — تُحمَّل فقط عند فتحها
const ClinicalCalculatorSuiteModal = lazy(() =>
  import('./ClinicalCalculatorSuiteModal').then((m) => ({ default: m.ClinicalCalculatorSuiteModal }))
);
const BMRCalculatorModal = lazy(() =>
  import('./BMRCalculatorModal').then((m) => ({ default: m.BMRCalculatorModal }))
);
import { PresetsLibraryModal } from './PresetsLibraryModal';
import { MedicalConditionsEditor } from './MedicalConditionsEditor';
import { MedicationsManager } from './MedicationsManager';
import { CycleTrackingManager } from './CycleTrackingManager';
import { LabTrackingManager } from './LabTrackingManager';
import { MealExchangePlanner } from './MealExchangePlanner';
import { CoachOnboardingModal } from './CoachOnboardingModal';
import { MedicationCatalogModal } from './MedicationCatalogModal';
import { MedicationInputRow } from './MedicationInputRow';
// تحميل كسول: مكتبات PDF الثقيلة (jspdf/html2canvas) تُحمَّل فقط عند فتح تصدير PDF
const PlanPDFExportModal = lazy(() =>
  import('./PlanPDFExportModal').then((m) => ({ default: m.PlanPDFExportModal }))
);
import { 
  autoConvertMealTextToFasting, 
  detectFastingSubstitutions, 
  SMART_SUBSTITUTIONS_BANK 
} from '../utils/fastingSubstitutions';
import { HelpButton } from './FeatureHelpModal';
import { generateLocalWeeklyDraft } from '../utils/coachDraft';
import { 
 getAllPresets, 
 saveCustomPreset, 
 deleteCustomPreset, 
 createPresetFromPlan, 
 applyPresetToPlanDraft, 
 PlanPreset 
} from '../utils/planPresets';

interface CoachModalProps {
 plan: PlanConfig;
 coachSessionUnlocked?: boolean;
 onSavePlan: (newPlan: PlanConfig) => void;
 onClose: () => void;
 onNotify: (msg: string) => void;
 isPageMode?: boolean;
 onNavigateClient?: () => void;
 onLogoutCoach?: () => void;
 onUnlockSession?: (enteredPin: string) => Promise<boolean | string> | boolean | string;
}

export const CoachModal: React.FC<CoachModalProps> = ({
 plan,
 coachSessionUnlocked,
 onSavePlan,
 onClose,
 onNotify,
 isPageMode = false,
 onNavigateClient,
 onLogoutCoach,
 onUnlockSession,
}) => {
 // Batch 1.5: آخر نشاط للعميل من السجلات المحلية على هذا الجهاز (بلا سحابة)
 const lastActivityDate = useMemo(() => findLastActivityDate(getAllStoredDayLogs()), []);
 const lastActivityLabel = lastActivityDate
 ? parseLocalDate(lastActivityDate).toLocaleDateString('ar-EG', { dateStyle: 'medium' })
 : null;

 const handleCopyClientLink = () => {
 const origin = window.location.origin;
 navigator.clipboard.writeText(origin).then(() => {
 onNotify('تم نسخ رابط شاشة العميل بنجاح ');
 });
 };

 const [draft, setDraft] = useState<PlanConfig>(() => ({
...JSON.parse(JSON.stringify(plan)),
 visibleSections: {
...DEFAULT_VISIBLE_SECTIONS,
...(plan.visibleSections || {}),
 },
 }));
 const [activeSubTab, setActiveSubTab] = useState<'presets' | 'profile' | 'calculators' | 'medical' | 'medications' | 'cycle' | 'labs' | 'meals' | 'habits' | 'sections' | 'weights' | 'backup'>('presets');
 const [mealEditMode, setMealEditMode] = useState<'exchanges' | 'manual'>('exchanges');
 const [showBMRCalc, setShowBMRCalc] = useState(false);
 const [showClinicalSuite, setShowClinicalSuite] = useState(false);
 const [showPresetsModal, setShowPresetsModal] = useState(false);
 const [selectedPresetCategory, setSelectedPresetCategory] = useState<string>('all');
 const [previewPreset, setPreviewPreset] = useState<PlanPreset | null>(null);
 const [showSavePresetPrompt, setShowSavePresetPrompt] = useState(false);
 const [newPresetName, setNewPresetName] = useState('');
 const [newPresetCategory, setNewPresetCategory] = useState<PlanPreset['category']>('custom');
 const [newPresetSummary, setNewPresetSummary] = useState('');
 const [presetsList, setPresetsList] = useState<PlanPreset[]>(getAllPresets);
 const [showCoachOnboarding, setShowCoachOnboarding] = useState(() => {
 try {
 const seen = localStorage.getItem(StorageKeys.coachOnboardingSeen());
 if (!seen) {
 localStorage.setItem(StorageKeys.coachOnboardingSeen(), 'true');
 return true;
 }
 return false;
 } catch {
 return false;
 }
 });

 // Weekly Message Draft state in Coach Panel
 const [coachWeeklyDraftText, setCoachWeeklyDraftText] = useState<string | null>(null);

 // Batch 2.5: مسودة الاستبيان المحفوظة (مستقلة عن الخطة النشطة)
 const [intakeDraftRecord, setIntakeDraftRecord] = useState<IntakeDraftRecord | null>(() => loadIntakeDraft());
 const [intakeImported, setIntakeImported] = useState(false);
 const [showIntakeWizard, setShowIntakeWizard] = useState(false);

 const handleImportIntakeDraft = () => {
 const record = loadIntakeDraft();
 if (!record) {
 onNotify('لا توجد مسودة استبيان محفوظة بعد');
 return;
 }
 setDraft(JSON.parse(JSON.stringify(record.draft)) as PlanConfig);
 setIntakeImported(true);
 onNotify('تم تحميل مسودة الاستبيان في النموذج — راجِعيها وعدّليها قبل الحفظ');
 };

 const handleDeleteIntakeDraft = () => {
 clearIntakeDraft();
 setIntakeDraftRecord(null);
 setIntakeImported(false);
 onNotify('تم حذف مسودة الاستبيان دون أي أثر على الخطة الحالية');
 };

 // Batch 3.3: القالب الموسمي (رمضان) — تفعيل بتاريخ يدوي + استعادة إعدادات الماء
 const [seasonalActivation, setSeasonalActivation] = useState<SeasonalActivation | null>(() => loadSeasonalActivation());
 const [seasonStart, setSeasonStart] = useState('');
 const [seasonEnd, setSeasonEnd] = useState('');
 const seasonalPhase = seasonalActivation ? getSeasonalPhase(seasonalActivation, getTodayDateString()) : null;

 const handleActivateSeasonal = () => {
 if (!isValidSeasonRange(seasonStart, seasonEnd)) {
 onNotify('يرجى ضبط تاريخ بداية ونهاية صحيحين للموسم (البداية قبل النهاية)');
 return;
 }
 const currentSettings = loadNotificationSettings();
 // لقطة إعدادات الماء الحالية قبل أي تغيير — هي ما يُستعاد عند الانتهاء
 const activation = buildSeasonalActivation(RAMADAN_SCENARIO.id, seasonStart, seasonEnd, currentSettings);
 saveSeasonalActivation(activation);
 setSeasonalActivation(activation);
 saveNotificationSettings(applySeasonalWaterReminders(currentSettings));
 const updatedDraft = applyPresetToPlanDraft(draft, RAMADAN_SCENARIO);
 setDraft(updatedDraft);
 onSavePlan(updatedDraft);
 onNotify('تم تفعيل قالب رمضان الموسمي: حُفظت الخطة بالوجبات الموسمية، وطُبّقت تنبيهات الماء الليلية (ستُستعاد إعداداتك السابقة تلقائيًا عند انتهاء الموسم)');
 };

 const handleDeactivateSeasonal = () => {
 if (seasonalActivation) {
 const currentSettings = loadNotificationSettings();
 saveNotificationSettings(restoreSeasonalWaterReminders(currentSettings, seasonalActivation));
 saveSeasonalActivation(null);
 setSeasonalActivation(null);
 }
 onNotify('تم إلغاء القالب الموسمي واستعادة إعدادات الماء السابقة — راجِع الخطة وعدّل الوجبات للموسم العادي');
 };

 // Medication Catalog state
 const [showMedicationCatalog, setShowMedicationCatalog] = useState(false);

 // Dedicated WhatsApp Share Options Modal state
 const [showShareOptionsModal, setShowShareOptionsModal] = useState(false);
 const [showPDFExportModal, setShowPDFExportModal] = useState(false);
 const [showFastingSubBankModal, setShowFastingSubBankModal] = useState(false);
 const [fastingSubSearch, setFastingSubSearch] = useState('');
 const [fastingSubCategory, setFastingSubCategory] = useState<string>('all');

 const handleFastingAutoConvert = (allowFish: boolean) => {
 const updatedMeals = draft.meals.map((m) => ({
 ...m,
 items: autoConvertMealTextToFasting(m.items, allowFish),
 }));
 setDraft({ ...draft, meals: updatedMeals });
 onNotify(allowFish ? 'تم تحويل الوجبات لبدائل صيامية مع السماح بالأسماك' : 'تم تحويل الوجبات لبدائل نباتية صيامية خالصة');
 };

 const handleIslamicMealRemap = () => {
 const names = [
 'وجبة الإفطار الرئيسية (تمر + ماء + بروتين وخضار)',
 'سناك خفيف بعد صلاة التراويح',
 'وجبة السحور المتكاملة (بروتين بطيء الامتصاص وبوتاسيوم)',
 'سناك إضافي (بين الإفطار والسحور)',
 'وجبة قبل الإمساك',
 ];
 const updatedMeals = draft.meals.map((m, idx) => ({
 ...m,
 name: names[idx] || `وجبة ليلية (${idx + 1})`,
 }));
 setDraft({ ...draft, meals: updatedMeals });
 onNotify('تمت إعادة تسمية الوجبات لنمط الصيام الإسلامي (إفطار، تراويح، سحور)');
 };

 const handleAutoPopulateFastingAlternatives = (allowFish: boolean) => {
 const updatedMeals = draft.meals.map((m) => {
 const subs = detectFastingSubstitutions(m.items, allowFish);
 if (subs.length === 0) return m;

 const currentAlts = m.alternatives || [];
 const newAlts = [...currentAlts];
 subs.forEach((s) => {
 const altText = allowFish && s.fishAlternative
 ? `${s.fishAlternative} (${s.proteinGrams}g بروتين)`
 : `${s.plantAlternative} (${s.proteinGrams}g بروتين)`;
 if (!newAlts.includes(altText)) {
 newAlts.push(altText);
 }
 });

 return {
 ...m,
 alternatives: newAlts,
 };
 });
 setDraft({ ...draft, meals: updatedMeals });
 onNotify('تم توليد البدائل الصيامية الذكية تلقائياً في قائمة البدائل المعتمدة');
 };

 const refreshPresets = () => {
 setPresetsList(getAllPresets());
 };

 const handleGenerateCoachWeeklyDraft = () => {
 const todayStr = getTodayDateString();
 const ref = new Date(todayStr);
 let totalScore = 0;
 let bestScore = -1;
 let bestDate = todayStr;
 let totalWater = 0;
 let waterDaysCount = 0;
 let exerciseDays = 0;
 const weights: number[] = [];

 for (let i = 6; i >= 0; i--) {
 const d = new Date(ref);
 d.setDate(ref.getDate() - i);
 const dateStr = d.toISOString().slice(0, 10);
 const log = loadDayLog(dateStr);
 const score = calculateDayScore(draft, log).total;
 totalScore += score;
 if (score > bestScore) {
 bestScore = score;
 bestDate = dateStr;
 }
 if (log.water && log.water > 0) {
 totalWater += log.water;
 waterDaysCount++;
 }
 if (log.checks && Object.values(log.checks).some(Boolean)) {
 exerciseDays++;
 }
 if (typeof log.weight === 'number' && log.weight > 0) {
 weights.push(log.weight);
 }
 }

 const avgAdherence = Math.round(totalScore / 7);
 const weightChange = weights.length >= 2? parseFloat((weights[weights.length - 1] - weights[0]).toFixed(1)): null;
 const avgWater = waterDaysCount > 0? Math.round(totalWater / 7): null;

 const draftText = generateLocalWeeklyDraft({
 clientName: draft.clientName || 'المشترك',
 avgAdherence,
 bestDay: `${bestDate} (${bestScore}%)`,
 weightChange,
 avgWater,
 exerciseDays,
 goal: draft.goal,
 rangeDays: 7,
 });

 setCoachWeeklyDraftText(draftText);
 onNotify('تمت صياغة مسودة رسالة الأسبوع بنجاح ');
 };

 const handleApplyPreset = (preset: PlanPreset) => {
 const updated = applyPresetToPlanDraft(draft, preset);
 setDraft(updated);
 onNotify(`تم تطبيق قالب «${preset.name}» على مسودة خطة ${draft.clientName || 'المتدرب'} `);
 };

 const handleDeletePreset = (preset: PlanPreset, e: React.MouseEvent) => {
 e.stopPropagation();
 if (window.confirm(`هل أنتِ متأكدة من حذف قالب «${preset.name}» من مكتبتك؟`)) {
 deleteCustomPreset(preset.id);
 refreshPresets();
 if (previewPreset?.id === preset.id) setPreviewPreset(null);
 onNotify('تم حذف القالب المخصص من المكتبة ');
 }
 };

 const handleSaveCurrentAsCustomPreset = (e: React.FormEvent) => {
 e.preventDefault();
 if (!newPresetName.trim()) {
 alert('الرجاء إدخال اسم للقالب');
 return;
 }
 const preset = createPresetFromPlan(
 draft,
 newPresetName.trim(),
 newPresetCategory,
 newPresetSummary.trim()
 );
 const ok = saveCustomPreset(preset);
 if (ok) {
 refreshPresets();
 setShowSavePresetPrompt(false);
 setNewPresetName('');
 setNewPresetSummary('');
 onNotify(`تم حفظ الخطة الحالية كقالب «${preset.name}» في مكتبتك بنجاح `);
 } else {
 alert('حدث خطأ أثناء حفظ القالب');
 }
 };

 const handleToggleSection = (key: keyof SectionVisibility) => {
 const isCurrentlyVisible = isSectionVisible(draft, key);
 const updatedVisible: SectionVisibility = {
...DEFAULT_VISIBLE_SECTIONS,
...(draft.visibleSections || {}),
 [key]:!isCurrentlyVisible,
 };
 setDraft({
...draft,
 visibleSections: updatedVisible,
...(key === 'macrosTracker'? { enableMacrosTracker:!isCurrentlyVisible }: {}),
...(key === 'fastingTimer'? { enableFastingTimer:!isCurrentlyVisible }: {}),
 });
 };

 const handleSetAllSections = (visible: boolean) => {
 const updated: SectionVisibility = {
 scoreCard: visible,
 macrosTracker: visible,
 fastingTimer: visible,
 tipsBanner: visible,
 mealsList: visible,
 waterTracker: visible,
 sleepTracker: visible,
 moodTracker: visible,
 exerciseTracker: visible,
 checklistTracker: visible,
 supplementsTracker: visible,
 symptomsTracker: visible,
 doctorNotes: visible,
 quickReportBtn: visible,
 bodyTab: visible,
 reportsTab: visible,
 };
 setDraft({
...draft,
 visibleSections: updated,
 enableMacrosTracker: visible,
 enableFastingTimer: visible,
 });
 onNotify(visible? 'تم تفعيل وإظهار كافة اللوحات': 'تم إخفاء اللوحات المحددة');
 };

 const handleSetMinimalSections = () => {
 const updated: SectionVisibility = {
 scoreCard: true,
 macrosTracker: false,
 fastingTimer: false,
 tipsBanner: false,
 mealsList: true,
 waterTracker: true,
 sleepTracker: false,
 moodTracker: false,
 exerciseTracker: false,
 checklistTracker: false,
 supplementsTracker: false,
 symptomsTracker: false,
 doctorNotes: true,
 quickReportBtn: true,
 bodyTab: true,
 reportsTab: true,
 };
 setDraft({
...draft,
 visibleSections: updated,
 enableMacrosTracker: false,
 enableFastingTimer: false,
 });
 onNotify('تم تطبيق الوضع المبسط (الوجبات والماء فقط)');
 };

 const handleSave = () => {
 const sw = draft.scoreWeights;
 const totalWeights = (sw.checklist || 0) + (sw.water || 0) + (sw.sleep || 0) + (sw.meals || 0);
 if (totalWeights <= 0) {
 alert('يجب أن يكون مجموع أوزان التقييم أكبر من صفر');
 return;
 }

 onSavePlan(draft);
 onNotify('تم حفظ إعدادات الخطة وتخصيص اللوحات بنجاح ');
 onClose();
 };

 // 1. Readable Plan Text Only (Without #START_PLAN_DATA# Code)
 const handleShareReadablePlanWhatsApp = () => {
 const text = generatePlanReadableText(draft);
 const encoded = encodeURIComponent(text);
 window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
 onNotify('جاري فتح الواتساب بنص الخطة المكتوبة الشاملة (بدون كود) ');
 };

 const handleCopyReadablePlan = () => {
 const text = generatePlanReadableText(draft);
 navigator.clipboard.writeText(text).then(() => {
 onNotify('تم نسخ الخطة المكتوبة بالكامل (بدون كود) ');
 });
 };

 // 2. Sync Code Only (#START_PLAN_DATA#... #END_PLAN_DATA#)
 const handleShareSyncCodeWhatsApp = () => {
 const text = generatePlanSyncCode(draft);
 const encoded = encodeURIComponent(text);
 window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
 onNotify('جاري فتح الواتساب بكود تفعيل الخطة للتطبيق فقط ');
 };

 const handleCopySyncCode = () => {
 const text = generatePlanSyncCode(draft);
 navigator.clipboard.writeText(text).then(() => {
 onNotify('تم نسخ كود تفعيل الخطة للتطبيق بنجاح ');
 });
 };

 // 3. Full Combined Message (Text + Code)
 const handleShareFullPlanWhatsApp = () => {
 const fullMessage = generateWhatsAppPlanMessage(draft);
 const encoded = encodeURIComponent(fullMessage);
 window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
 onNotify('جاري فتح الواتساب بالرسالة الشاملة (نص + كود المزامنة) ');
 };

 const handleCopyFullPlan = () => {
 const fullMessage = generateWhatsAppPlanMessage(draft);
 navigator.clipboard.writeText(fullMessage).then(() => {
 onNotify('تم نسخ رسالة الخطة الشاملة (نص + كود) للواتساب ');
 });
 };

 const handleCopyRawJson = () => {
 const jsonStr = JSON.stringify(draft, null, 2);
 navigator.clipboard.writeText(jsonStr).then(() => {
 onNotify('تم نسخ كود الخطة الخام (JSON) ');
 });
 };

 const handleExportFullBackup = () => {
 const backupStr = exportFullBackupJSON();
 const blob = new Blob([backupStr], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `backup_${draft.clientName || 'client'}_${new Date().toISOString().slice(0, 10)}.json`;
 a.click();
 URL.revokeObjectURL(url);
 onNotify('تم تنزيل النسخة الاحتياطية ');
 };

 const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 const reader = new FileReader();
 reader.onload = (event) => {
 try {
 const content = event.target?.result as string;
 const success = importFullBackupJSON(content);
 if (success) {
 onNotify('تم استيراد النسخة الاحتياطية بنجاح ');
 onClose();
 window.location.reload();
 } else {
 alert('تعذر استيراد الملف، تأكد من صحة التنسيق');
 }
 } catch (err) {
 alert('الملف غير صالح');
 }
 };
 reader.readAsText(file);
 e.target.value = '';
 };

 const handleResetToDefault = () => {
 if (window.confirm('هل أنت متأكد من استعادة الخطة الافتراضية؟ سيتم إلغاء التعديلات.')) {
 setDraft(JSON.parse(JSON.stringify(DEFAULT_PLAN)));
 onNotify('تمت استعادة الإعدادات الافتراضية');
 }
 };

 const handleAddMeal = () => {
 const newMeal: MealItem = {
 id: `m_${Date.now()}`,
 name: 'وجبة جديدة ',
 items: 'مكونات الوجبة والكميات...',
 alternatives: ['بديل أول...', 'بديل ثانٍ...'],
 calories: 400,
 proteinGrams: 30,
 };
 setDraft({...draft, meals: [...draft.meals, newMeal] });
 };

 const handleRemoveMeal = (index: number) => {
 const updated = [...draft.meals];
 updated.splice(index, 1);
 setDraft({...draft, meals: updated });
 };

 const handleAddCheck = () => {
 const newItem: CheckItem = {
 id: `c_${Date.now()}`,
 label: 'مهمة جديدة...',
 };
 setDraft({...draft, checklist: [...draft.checklist, newItem] });
 };

 const handleRemoveCheck = (index: number) => {
 const updated = [...draft.checklist];
 updated.splice(index, 1);
 setDraft({...draft, checklist: updated });
 };

 const handleAddSupp = () => {
 const newItem: SupplementItem = {
 id: `s_${Date.now()}`,
 name: 'مكمل جديد...',
 time: 'مع الوجبة',
 };
 setDraft({...draft, supplements: [...(draft.supplements || []), newItem] });
 };

 const handleRemoveSupp = (index: number) => {
 const updated = [...(draft.supplements || [])];
 updated.splice(index, 1);
 setDraft({...draft, supplements: updated });
 };

 const handleAddTip = () => {
 setDraft({...draft, tips: [...(draft.tips || []), 'نصيحة جديدة للمتدرب...'] });
 };

 const handleRemoveTip = (index: number) => {
 const updated = [...(draft.tips || [])];
 updated.splice(index, 1);
 setDraft({...draft, tips: updated });
 };

  if (!coachSessionUnlocked) {
    if (!onUnlockSession) return null;
    return (
      <CoachPinGate
        onUnlockSession={onUnlockSession}
        onNavigateClient={onNavigateClient}
        onClose={onClose}
      />
    );
  }

 return (
 <div className={isPageMode? "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col text-right dir-rtl pb-24": "fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150"}>
 <div className={isPageMode? "w-full flex-1 flex flex-col text-right dir-rtl": "bg-white dark:bg-slate-900 w-full max-w-6xl 2xl:max-w-7xl rounded-3xl border border-slate-200/90 dark:border-slate-800 app-overlay-shadow h-[95vh] sm:h-[92vh] flex flex-col overflow-hidden text-right dir-rtl"}>
 
 {/* Header - Spacious Ergonomic Workstation */}
 <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-slate-50/80 dark:bg-slate-900/90 backdrop-blur-xs">
 <div className="flex items-center gap-3 min-w-0">
 <div className="w-11 h-11 rounded-2xl text-peacock-indigo dark:text-peacock-teal flex items-center justify-center font-bold shrink-0">
 <Settings className="w-5 h-5" />
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base md:text-lg truncate">
 {brandCopy.coachPanelNamed} 
 </h3>
 {draft.clientName && (
 <span className="text-[12px] sm:text-xs font-black px-2.5 py-0.5 rounded-full bg-peacock-pale text-peacock-indigo-deep dark:bg-peacock-ink-deep dark:text-peacock-teal-light border border-peacock-teal-light dark:border-peacock-indigo-deep truncate max-w-[160px]">
 المتدرب: {draft.clientName}
 </span>
 )}
 </div>
 <p className="text-[12px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
 تخصيص الخطة والسعرات والبدائل الإكلينيكية وإدارة الحالات الطبية
 </p>
 <p className="text-[12px] sm:text-xs text-peacock-indigo dark:text-peacock-teal font-bold truncate">
 آخر نشاط للعميل: {lastActivityLabel ?? 'لا يوجد نشاط مسجل بعد'}
 </p>
 {intakeImported && (
 <p className="text-[12px] sm:text-xs font-black px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 inline-block">
 مسودة من الاستبيان — راجِع قبل الاعتماد
 </p>
 )}
 </div>
 </div>
 <div className="flex items-center gap-2 shrink-0 flex-wrap">
 {isPageMode? (
 <>
 <button
 type="button"
 onClick={handleSave}
 className="min-h-[40px] px-3.5 sm:px-4 py-2 rounded-2xl bg-peacock-indigo hover:bg-peacock-indigo-dark text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
 title="حفظ الخطة"
 >
 <Save className="w-4 h-4" />
 <span>حفظ الخطة </span>
 </button>

 <button
 type="button"
 onClick={() => setShowPDFExportModal(true)}
 className="min-h-[40px] px-3 sm:px-4 py-2 rounded-2xl bg-peacock-blue/10 hover:bg-peacock-blue/20 text-peacock-indigo dark:text-peacock-teal-light border border-peacock-blue/30 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
 title="تصدير الخطة كملف PDF رسمي (Medical Prescription)"
 >
 <FileDown className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal" />
 <span>تصدير PDF</span>
 </button>

 <button
 type="button"
 onClick={onNavigateClient}
 className="min-h-[40px] px-3 sm:px-4 py-2 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
 title="معاينة شاشة العميل"
 >
 <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
 <span className="hidden xs:inline">معاينة شاشة العميل </span>
 </button>

 <button
 type="button"
 onClick={handleCopyClientLink}
 className="min-h-[40px] px-3 sm:px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
 title="نسخ رابط شاشة العميل"
 >
 <Copy className="w-4 h-4" />
 <span className="hidden sm:inline">نسخ رابط العميل </span>
 </button>

 <button
 type="button"
 onClick={() => setShowCoachOnboarding(true)}
 className="min-h-[40px] px-3 sm:px-4 py-2 rounded-2xl bg-peacock-blue/10 hover:bg-peacock-blue/20 text-peacock-indigo-dark dark:text-peacock-teal-light border border-peacock-blue/30 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
 title={brandCopy.coachGuide}
 >
 <BookOpen className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal" />
 <span className="hidden md:inline">دليل اللوحة </span>
 </button>

 <button
 type="button"
 onClick={onLogoutCoach}
 className="min-h-[40px] px-3 sm:px-4 py-2 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
 title="تسجيل الخروج"
 >
 <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />
 <span className="hidden sm:inline">تسجيل الخروج </span>
 </button>
 </>
 ): (
 <>
 <button
 type="button"
 onClick={() => setShowPDFExportModal(true)}
 className="min-h-[40px] px-3 sm:px-4 py-2 rounded-2xl bg-peacock-blue/10 hover:bg-peacock-blue/20 text-peacock-indigo dark:text-peacock-teal-light border border-peacock-blue/30 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
 title="تصدير الخطة كملف PDF رسمي (Medical Prescription)"
 >
 <FileDown className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal" />
 <span>تصدير PDF</span>
 </button>

 <button
 type="button"
 onClick={() => setShowCoachOnboarding(true)}
 className="min-h-[40px] px-3 sm:px-4 py-2 rounded-2xl bg-peacock-blue/10 hover:bg-peacock-blue/20 text-peacock-indigo-dark dark:text-peacock-teal-light border border-peacock-blue/30 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
 title={brandCopy.coachGuide}
 >
 <BookOpen className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal" />
 <span className="hidden sm:inline">دليل اللوحة </span>
 </button>

 <button 
 onClick={onClose} 
 className="w-10 h-10 rounded-2xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover: dark:hover: flex items-center justify-center transition-colors shrink-0 cursor-pointer dark:"
 title="إغلاق"
 >
 <X className="w-5 h-5" />
 </button>
 </>
 )}
 </div>
 </div>

 {/* Sub-tabs Navigation Bar - Spacious & Categorized */}
 <div className="bg-slate-100/60 dark:bg-slate-850/60 border-b border-slate-200/80 dark:border-slate-800 px-3 sm:px-6 py-2.5 shrink-0">
 <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
 {[
 { id: 'presets', label: 'مكتبة القوالب ', icon: <FolderHeart className="w-4 h-4 text-peacock-blue" /> },
 { id: 'profile', label: 'المتدرب والسعرات', icon: <User className="w-4 h-4 text-blue-500" /> },
 { id: 'calculators', label: 'الحاسبة ', icon: <Calculator className="w-4 h-4 text-cyan-500" /> },
 { 
 id: 'medical', 
 label: `التشخيصات ${draft.medicalConditions?.conditions?.length? ` (${draft.medicalConditions.conditions.length})`: ''}`, 
 icon: <Stethoscope className="w-4 h-4 text-peacock-blue" /> 
 },
 { 
 id: 'medications', 
 label: `الأدوية ${draft.medicationPlan?.items?.length? ` (${draft.medicationPlan.items.length})`: ''}`, 
 icon: <Pill className="w-4 h-4 text-indigo-500" /> 
 },
 { 
 id: 'cycle', 
 label: `الدورة ${draft.cycleTracking?.enabled? ' (مفعّل)': ''}`, 
 icon: <Heart className="w-4 h-4 text-rose-500" /> 
 },
 { 
 id: 'labs', 
 label: `التحاليل ${draft.labTracking?.entries?.length? ` (${draft.labTracking.entries.length})`: ''}`, 
 icon: <Activity className="w-4 h-4 text-peacock-blue" /> 
 },
 { id: 'meals', label: 'الوجبات والبدائل', icon: <Utensils className="w-4 h-4 text-peacock-blue" /> },
 { id: 'habits', label: 'العادات والمكملات', icon: <CheckSquare className="w-4 h-4 text-peacock-blue" /> },
 { id: 'sections', label: 'تخصيص اللوحات ', icon: <LayoutGrid className="w-4 h-4 text-amber-500" /> },
 { id: 'weights', label: 'أوزان التقييم %', icon: <Sliders className="w-4 h-4 text-slate-500" /> },
 { id: 'backup', label: 'النسخ والمشاركة ', icon: <Copy className="w-4 h-4 text-peacock-blue" /> },
 ].map((tab) => {
 const isSelected = activeSubTab === tab.id;
 return (
 <button
 key={tab.id}
 onClick={() => setActiveSubTab(tab.id as any)}
 className={`min-h-[42px] px-3.5 sm:px-4 py-2 rounded-2xl text-xs sm:text-[13px] font-black whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
 isSelected
? 'bg-peacock-indigo text-white ring-2 ring-peacock-blue/30'
: 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200/80 dark:border-slate-700/70 hover:border-slate-300'
 }`}
 >
 {tab.icon}
 <span>{tab.label}</span>
 </button>
 );
 })}
 </div>
 </div>

 {/* Main Tab Content - Spacious & Multi-Column Optimized */}
 <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 space-y-4">
 
 {/* TAB 0: Presets Library */}
 {activeSubTab === 'presets' && (
 <div className="space-y-5">
 {/* Presets top info & Save Custom Button */}
 <div className="p-4 sm:p-5 rounded-2xl bg-peacock-mist/80 dark:bg-peacock-ink-deep/30 border border-peacock-sage dark:border-peacock-ink/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
 <div>
 <div className="flex items-center gap-2">
 <h4 className="text-xs sm:text-sm font-black text-peacock-ink dark:text-peacock-sage flex items-center gap-1.5">
 <FolderHeart className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal" />
 مكتبة القوالب العلاجية والغذائية الجاهزة 
 </h4>
 <HelpButton featureId="coachPresets" size="sm" />
 </div>
 <p className="text-[12px] sm:text-xs text-peacock-indigo-dark/90 dark:text-peacock-teal-light mt-1">
 اختاري قالب متكامل لحالة المتدرب ليتم ملء الوجبات والبدائل والمكملات والسعرات بضغطة واحدة
 </p>
 </div>

 <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
 <button
 onClick={() => setShowSavePresetPrompt(true)}
 className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo-dark text-white font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
 >
 <BookmarkPlus className="w-4 h-4" />
 <span>حفظ خطتي الحالية كقالب </span>
 </button>
 </div>
 </div>

 {/* Categories Pills */}
 <div className="flex gap-2 overflow-x-auto pb-1">
 {[
 { id: 'all', label: 'كافة القوالب' },
 { id: 'medical', label: ' علاجي PCOS' },
 { id: 'weight_loss', label: ' نزول سريع' },
 { id: 'fitness', label: ' تنشيف ولياقة' },
 { id: 'keto', label: ' كيتو علاجي' },
 { id: 'maintenance', label: ' تثبيت وتوازن' },
 { id: 'custom', label: ' قوالبي الخاصة' },
 ].map((c) => {
 const isSel = selectedPresetCategory === c.id;
 return (
 <button
 key={c.id}
 onClick={() => setSelectedPresetCategory(c.id)}
 className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
 isSel
? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
 }`}
 >
 {c.label}
 </button>
 );
 })}
 </div>

 {/* Presets List in 2-column or 3-column responsive grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
 {presetsList
.filter((p) => {
 if (selectedPresetCategory === 'all') return true;
 if (selectedPresetCategory === 'custom') return p.isCustom;
 return p.category === selectedPresetCategory;
 })
.map((preset) => {
 return (
 <div
 key={preset.id}
 className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 sm:p-4.5 hover:border-peacock-blue/60 transition-all flex flex-col justify-between space-y-3 hover:"
 >
 {/* Header */}
 <div>
 <div className="flex items-start justify-between gap-2">
 <div className="flex items-center gap-2.5">
 <span className="text-2xl">{preset.icon}</span>
 <div>
 <div className="flex items-center gap-2 flex-wrap">
 <h5 className="font-black text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
 {preset.name}
 </h5>
 <span className={`text-[12px] font-black px-2 py-0.5 rounded-lg border ${preset.tagColor}`}>
 {preset.badge}
 </span>
 </div>
 <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">
 {preset.description}
 </p>
 </div>
 </div>

 {preset.isCustom && (
 <button
 onClick={(e) => handleDeletePreset(preset, e)}
 className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer shrink-0"
 title="حذف القالب"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 )}
 </div>

 {/* Stats Badges */}
 <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-bold text-slate-600 dark:text-slate-300 pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-700/60">
 <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200">
 {preset.targetCalories} كالوري
 </span>
 <span className="px-2 py-0.5 rounded-lg bg-peacock-mist dark:bg-peacock-ink-deep/50 text-peacock-indigo-dark dark:text-peacock-teal-light">
 {preset.targetProtein}g بروتين
 </span>
 <span className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">
 {preset.targetCarbs}g كارب
 </span>
 <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300">
 ⏳ {preset.fastingHours}h صيام
 </span>
 <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300">
 {preset.dailyWaterGoalMl / 1000}L
 </span>
 <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-500">
 {preset.mealsCount} وجبات • {preset.supplementsCount} مكملات
 </span>
 </div>
 </div>

 {/* Action Buttons */}
 <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
 <button
 type="button"
 onClick={() => setPreviewPreset(preset)}
 className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
 >
 <Eye className="w-3.5 h-3.5" />
 <span>معاينة</span>
 </button>

 <button
 type="button"
 onClick={() => handleApplyPreset(preset)}
 className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-peacock-indigo hover:bg-peacock-indigo-dark text-white transition-all flex items-center gap-1 cursor-pointer"
 >
 <Zap className="w-3.5 h-3.5" />
 <span>تطبيق القالب </span>
 </button>
 </div>
 </div>
 );
 })}
 </div>

 <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 text-[12px] sm:text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2.5 border border-slate-200/70 dark:border-slate-700/60">
 <Circle className="w-4 h-4 text-peacock-blue shrink-0" />
 <span>
 ملاحظة: تطبيق القالب يقوم بملء الوجبات والبدائل والعادات والمكملات والسعرات مع الحفاظ التلقائي على اسم المتدرب ووزنه وطوله الحالي.
 </span>
 </div>
 </div>
 )}

 {/* TAB 1: Profile & Goals & Calories (Spacious 2-Column Grid) */}
 {activeSubTab === 'profile' && (
 <div className="space-y-5">
 {/* Presets & BMR Quick Shortcuts Banner */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="p-4 sm:p-5 rounded-2xl bg-peacock-mist dark:bg-peacock-ink-deep/40 border border-peacock-sage dark:border-peacock-indigo-deep/70 flex items-center justify-between gap-3">
 <div className="flex items-center gap-3 min-w-0">
 <FolderHeart className="w-6 h-6 text-peacock-indigo shrink-0" />
 <div className="min-w-0">
 <span className="text-xs sm:text-sm font-black text-peacock-ink dark:text-peacock-sage block truncate">
 قوالب الخطط الطبية
 </span>
 <span className="text-[12px] sm:text-xs text-peacock-indigo-dark/80 dark:text-peacock-teal-light/80 block truncate">
 بدء الخطة من قالب إكلينيكي جاهز
 </span>
 </div>
 </div>
 <button
 type="button"
 onClick={() => setActiveSubTab('presets')}
 className="min-h-[40px] px-4 py-2 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo-dark text-white text-xs font-black transition-colors cursor-pointer shrink-0"
 >
 القوالب 
 </button>
 </div>

 <div className="p-4 sm:p-5 rounded-2xl bg-peacock-mist/80 dark:bg-peacock-ink-deep/30 border border-peacock-sage dark:border-peacock-ink/60 flex items-center justify-between gap-3">
 <div className="flex items-center gap-3 min-w-0">
 <Calculator className="w-6 h-6 text-peacock-indigo dark:text-peacock-teal shrink-0" />
 <div className="min-w-0">
 <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 block truncate">
 حاسبة السعرات (معادلة سمر / معادلة خلود) 
 </h4>
 <p className="text-[12px] sm:text-xs text-slate-600 dark:text-slate-300 block truncate">
 حساب الاحتياج بالوزن المثالي أو معدل الحرق وعجز النزول وتطبيقها على الخطة
 </p>
 </div>
 </div>
 <button
 onClick={() => setShowBMRCalc(true)}
 className="min-h-[40px] px-4 py-2 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo-dark text-white font-black text-xs transition-colors shrink-0 cursor-pointer"
 >
 حاسبة السعرات 
 </button>
 </div>
 </div>

 {/* Batch 2.5 + 2.4: مسودة الاستبيان وهدف الأسبوع */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <div className="p-4 sm:p-5 rounded-2xl bg-peacock-mist/70 dark:bg-peacock-ink-deep/30 border border-peacock-sage dark:border-peacock-indigo-deep/60 space-y-3">
 <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
 <FileText className="w-4 h-4 text-peacock-indigo" />
 مسودة استبيان العميل الجديد
 </h4>
 {intakeImported && (
 <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-black text-center">
 مسودة من الاستبيان — راجِع قبل الاعتماد
 </div>
 )}
 <p className="text-[12px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
 {intakeDraftRecord
 ? `توجد مسودة محفوظة من ${new Date(intakeDraftRecord.createdAt).toLocaleDateString('ar-EG')} باسم «${intakeDraftRecord.draft.clientName || 'عميل'}». الاستيراد يحمّلها في هذا النموذج فقط — لا تُعتمد إلا بحفظك من زر الحفظ العام.`
 : 'لا توجد مسودة استبيان محفوظة بعد. المسودة لا تلمس الخطة النشطة أبدًا.'}
 </p>
 <div className="flex flex-wrap gap-2">
 <button
 type="button"
 onClick={handleImportIntakeDraft}
 disabled={!intakeDraftRecord}
 className="min-h-[40px] px-4 py-2 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo disabled:opacity-40 text-white text-xs font-black transition-colors cursor-pointer"
 >
 استيراد مسودة الاستبيان
 </button>
 <button
 type="button"
 onClick={() => setShowIntakeWizard(true)}
 className="min-h-[40px] px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-peacock-teal-light dark:border-peacock-indigo text-peacock-indigo dark:text-peacock-teal-light text-xs font-black transition-colors cursor-pointer"
 >
 فتح الاستبيان مع العميل
 </button>
 {intakeDraftRecord && (
 <button
 type="button"
 onClick={handleDeleteIntakeDraft}
 className="min-h-[40px] px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-black transition-colors cursor-pointer"
 >
 إلغاء المسودة
 </button>
 )}
 </div>
 </div>

 <div className="p-4 sm:p-5 rounded-2xl bg-peacock-mist/70 dark:bg-peacock-ink-deep/30 border border-peacock-sage dark:border-peacock-indigo-deep/60 space-y-3">
 <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
 <Zap className="w-4 h-4 text-peacock-indigo" />
 هدف الأسبوع الواحد (Weekly Focus)
 </h4>
 <label className="flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-300 cursor-pointer">
 <input
 type="checkbox"
 checked={!!draft.weeklyFocus}
 onChange={(e) => {
 if (e.target.checked) {
 setDraft({
 ...draft,
 weeklyFocus: { type: 'water', target: 14000, weekStartISO: getWeekStartISO(getTodayDateString()) },
 });
 } else {
 const next = { ...draft };
 delete next.weeklyFocus;
 setDraft(next);
 }
 }}
 className="w-4 h-4 accent-peacock-indigo"
 />
 تفعيل هدف أسبوعي للعميل
 </label>
 {draft.weeklyFocus && (
 <div className="space-y-3">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">النوع</label>
 <select
 value={draft.weeklyFocus.type}
 onChange={(e) =>
 setDraft({
 ...draft,
 weeklyFocus: { ...draft.weeklyFocus!, type: e.target.value as WeeklyFocusType },
 })
 }
 className="w-full text-xs sm:text-sm font-bold min-h-[40px] p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
 >
 {(Object.keys(WEEKLY_FOCUS_TYPE_LABELS) as WeeklyFocusType[]).map((t) => (
 <option key={t} value={t}>
 {WEEKLY_FOCUS_TYPE_LABELS[t]}
 </option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
 الهدف ({draft.weeklyFocus.type === 'water' ? 'مل' : draft.weeklyFocus.type === 'sleep' ? 'ساعة' : draft.weeklyFocus.type === 'meals' ? 'وجبة' : draft.weeklyFocus.type === 'checklist' ? 'بند' : 'يوم'})
 </label>
 <input
 type="number"
 min={1}
 value={draft.weeklyFocus.target}
 onChange={(e) =>
 setDraft({
 ...draft,
 weeklyFocus: { ...draft.weeklyFocus!, target: parseFloat(e.target.value) || 0 },
 })
 }
 className="w-full text-xs sm:text-sm font-bold min-h-[40px] p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
 />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">بداية الأسبوع</label>
 <input
 type="date"
 value={draft.weeklyFocus.weekStartISO}
 onChange={(e) =>
 setDraft({
 ...draft,
 weeklyFocus: { ...draft.weeklyFocus!, weekStartISO: e.target.value },
 })
 }
 className="w-full text-xs sm:text-sm font-bold min-h-[40px] p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
 />
 </div>
 {draft.weeklyFocus.type === 'custom' && (
 <div>
 <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">نص الهدف المخصص</label>
 <input
 type="text"
 value={draft.weeklyFocus.label || ''}
 onChange={(e) =>
 setDraft({
 ...draft,
 weeklyFocus: { ...draft.weeklyFocus!, label: e.target.value },
 })
 }
 placeholder="مثال: المشي بعد العشاء"
 className="w-full text-xs sm:text-sm font-bold min-h-[40px] p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
 />
 </div>
 )}
 </div>
 <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
 التقدم يُحسب تلقائيًا من سجلات العميل، والنوع «مخصص» يُحسب بزر «أنجزت اليوم» مرة واحدة في اليوم.
 </p>
 </div>
 )}
 </div>
 </div>

 {/* Batch 3.3: القالب الموسمي (رمضان) */}
 <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-3">
 <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
 <Moon className="w-4 h-4 text-indigo-600" />
 القالب الموسمي — رمضان (قالب فوق مكتبة السيناريوهات)
 </h4>
 {seasonalActivation ? (
 <div className="space-y-3">
 <p className="text-[12px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
 القالب مفعّل من <strong>{seasonalActivation.startDate}</strong> إلى <strong>{seasonalActivation.endDate}</strong>.
 تنبيهات الماء الليلية مطبقة حاليًا، وإعدادات الماء السابقة محفوظة وستُستعاد تلقائيًا عند انتهاء الموسم أو الإلغاء.
 </p>
 {seasonalPhase && seasonalPhase !== 'active' && (
 <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-black text-center">
 {seasonalPhaseNotice(seasonalPhase)}
 </div>
 )}
 <button
 type="button"
 onClick={handleDeactivateSeasonal}
 className="min-h-[40px] px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-black transition-colors cursor-pointer"
 >
 إلغاء التفعيل واستعادة الإعدادات
 </button>
 </div>
 ) : (
 <div className="space-y-3">
 <p className="text-[12px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
 التفعيل يطبق سيناريو رمضان على خطة العميل ويحفظها فورًا (إفطار/سناك ليلي/سحور + قسم الصيام)، ويضبط تنبيهات الماء لليلًا أثناء الموسم فقط — إعدادات الماء الحالية تُحفظ وتُستعاد كاملة عند الانتهاء. التواريخ يدوية (لا تقويم هجري تلقائي).
 </p>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">بداية الموسم</label>
 <input
 type="date"
 value={seasonStart}
 onChange={(e) => setSeasonStart(e.target.value)}
 className="w-full text-xs sm:text-sm font-bold min-h-[40px] p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
 />
 </div>
 <div>
 <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">نهاية الموسم</label>
 <input
 type="date"
 value={seasonEnd}
 onChange={(e) => setSeasonEnd(e.target.value)}
 className="w-full text-xs sm:text-sm font-bold min-h-[40px] p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
 />
 </div>
 </div>
 <button
 type="button"
 onClick={handleActivateSeasonal}
 className="min-h-[40px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-colors cursor-pointer"
 >
 تفعيل قالب رمضان الموسمي
 </button>
 </div>
 )}
 </div>

 {showIntakeWizard && (
 <IntakeWizard
 isOpen={showIntakeWizard}
 onClose={() => {
 setShowIntakeWizard(false);
 setIntakeDraftRecord(loadIntakeDraft());
 }}
 plan={draft}
 onNotify={onNotify}
 />
 )}

 {/* Main Profile Grid: Left Column (Basics & PIN) + Right Column (Calories & Fasting) */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
 
 {/* Column 1: Patient Basic Info & Target Measurements + PIN */}
 <div className="space-y-4">
 {/* Patient Basic Info Card */}
 <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 space-y-4">
 <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-700/60 pb-2.5">
 <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
 <User className="w-4 h-4 text-peacock-indigo" />
 بيانات المتدرب والقياسات الأساسية
 </h4>
 <HelpButton featureId="coachProfile" size="sm" />
 </div>

 <div>
 <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">اسم المتدرب</label>
 <input
 type="text"
 value={draft.clientName || ''}
 onChange={(e) => setDraft({...draft, clientName: e.target.value })}
 placeholder="مثال: سارة أحمد"
 className="w-full text-xs sm:text-sm font-bold min-h-[44px] p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-peacock-blue/20"
 />
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
 <div>
 <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">الطول (سم)</label>
 <input
 type="number"
 value={draft.heightCm || ''}
 onChange={(e) => setDraft({...draft, heightCm: parseFloat(e.target.value) || null })}
 placeholder="170"
 className="w-full text-xs sm:text-sm font-bold min-h-[44px] p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
 />
 </div>

 <div>
 <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">وزن البداية (كجم)</label>
 <input
 type="number"
 step="0.5"
 value={draft.startWeight || ''}
 onChange={(e) => setDraft({...draft, startWeight: parseFloat(e.target.value) || null })}
 placeholder="85"
 className="w-full text-xs sm:text-sm font-bold min-h-[44px] p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
 />
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
 <div>
 <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">الوزن المستهدف (كجم)</label>
 <input
 type="number"
 step="0.5"
 value={draft.targetWeight || ''}
 onChange={(e) => setDraft({...draft, targetWeight: parseFloat(e.target.value) || null })}
 placeholder="68"
 className="w-full text-xs sm:text-sm font-bold min-h-[44px] p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
 />
 </div>

 <div>
 <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">الوسط المستهدف (سم)</label>
 <input
 type="number"
 step="0.5"
 value={draft.targetWaist || ''}
 onChange={(e) => setDraft({...draft, targetWaist: parseFloat(e.target.value) || null })}
 placeholder="75"
 className="w-full text-xs sm:text-sm font-bold min-h-[44px] p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
 />
 </div>
 </div>
 </div>

 {/* Free Days & Admin PIN Card */}
 <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 space-y-3.5">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
 <div>
 <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">أيام الفري شهرياً (Freeze Days)</label>
 <input
 type="number"
 min="0"
 max="10"
 value={draft.freezeDaysPerMonth ?? 2}
 onChange={(e) => setDraft({...draft, freezeDaysPerMonth: parseInt(e.target.value, 10) || 0 })}
 className="w-full text-xs sm:text-sm font-bold min-h-[44px] p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
 />
 </div>

 <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-1">
 <p className="text-xs font-black text-amber-900 dark:text-amber-200">{brandCopy.pinLabel}</p>
 <p className="text-[12px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
 رمز الدخول يُضبط من إعدادات الاستضافة فقط (<span className="font-mono">COACH_PIN</span>) ولا يُحفظ داخل الخطة أو ملف الهوية.
 غيّره من Vercel/Netlify Environment Variables ثم أعد فتح اللوحة.
 </p>
 </div>
 </div>
 </div>
 </div>

 {/* Column 2: Target Calories & Macros + Fasting Intermittent Timer */}
 <div className="space-y-4">
 {/* Target Calories & Macros Card */}
 <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 space-y-4">
 <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-700/60 pb-2.5">
 <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
 <Flame className="w-4 h-4 text-orange-500" />
 السعرات والماكروز اليومية المستهدفة
 </span>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => setShowBMRCalc(true)}
 className="text-[12px] font-black text-peacock-indigo-dark dark:text-peacock-teal-light bg-peacock-mist dark:bg-peacock-ink-deep/60 hover:bg-peacock-pale dark:hover:bg-peacock-ink/50 px-2.5 py-1 rounded-xl border border-peacock-sage dark:border-peacock-indigo-deep transition-colors flex items-center gap-1 cursor-pointer"
 >
 <Calculator className="w-3.5 h-3.5" />
 <span>معادلة سمر / خلود </span>
 </button>
 <label className="flex items-center gap-2 text-xs font-black text-peacock-indigo dark:text-peacock-teal cursor-pointer min-h-[36px] px-2.5 rounded-lg hover:bg-peacock-mist dark:hover:bg-peacock-ink-deep/40">
 <input
 type="checkbox"
 checked={draft.enableMacrosTracker ?? true}
 onChange={(e) => setDraft({...draft, enableMacrosTracker: e.target.checked })}
 className="w-4 h-4 rounded text-peacock-indigo accent-peacock-indigo cursor-pointer"
 />
 تفعيل التتبع
 </label>
 </div>
 </div>

 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80">
 <label className="block text-[12px] font-black text-slate-500 mb-1"> السعرات</label>
 <input
 type="number"
 value={draft.targetCalories || ''}
 onChange={(e) => setDraft({...draft, targetCalories: parseInt(e.target.value, 10) || 0 })}
 placeholder="2000"
 className="w-full text-sm sm:text-base font-black p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-center"
 />
 </div>
 <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80">
 <label className="block text-[12px] font-black text-peacock-indigo mb-1"> بروتين (جم)</label>
 <input
 type="number"
 value={draft.targetProtein || ''}
 onChange={(e) => setDraft({...draft, targetProtein: parseInt(e.target.value, 10) || 0 })}
 placeholder="150"
 className="w-full text-sm sm:text-base font-black p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-center"
 />
 </div>
 <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80">
 <label className="block text-[12px] font-black text-amber-600 mb-1"> نشويات (جم)</label>
 <input
 type="number"
 value={draft.targetCarbs || ''}
 onChange={(e) => setDraft({...draft, targetCarbs: parseInt(e.target.value, 10) || 0 })}
 placeholder="180"
 className="w-full text-sm sm:text-base font-black p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-center"
 />
 </div>
 <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80">
 <label className="block text-[12px] font-black text-peacock-indigo mb-1"> دهون (جم)</label>
 <input
 type="number"
 value={draft.targetFats || ''}
 onChange={(e) => setDraft({...draft, targetFats: parseInt(e.target.value, 10) || 0 })}
 placeholder="60"
 className="w-full text-sm sm:text-base font-black p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-center"
 />
 </div>
 </div>
 </div>

 {/* Fasting Timer Settings Card */}
 <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 space-y-4">
 <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-700/60 pb-2.5">
 <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
 <Timer className="w-4 h-4 text-peacock-blue" />
 مؤقت الصيام المتقطع
 </span>
 <label className="flex items-center gap-2 text-xs font-black text-peacock-indigo dark:text-peacock-teal cursor-pointer min-h-[36px] px-2.5 rounded-lg hover:bg-peacock-mist dark:hover:bg-peacock-ink-deep/40">
 <input
 type="checkbox"
 checked={draft.enableFastingTimer ?? true}
 onChange={(e) => setDraft({...draft, enableFastingTimer: e.target.checked })}
 className="w-4 h-4 rounded text-peacock-indigo accent-peacock-indigo cursor-pointer"
 />
 تفعيل المؤقت
 </label>
 </div>
 <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
 <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">ساعات الصيام المستهدفة:</span>
 <div className="flex items-center gap-2">
 <input
 type="number"
 min="12"
 max="24"
 value={draft.fastingTargetHours || 16}
 onChange={(e) => setDraft({...draft, fastingTargetHours: parseInt(e.target.value, 10) || 16 })}
 className="w-24 min-h-[42px] text-sm sm:text-base font-black p-2 rounded-xl border bg-slate-50 dark:bg-slate-800 text-center text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700"
 />
 <span className="text-xs sm:text-sm font-black text-slate-500">ساعة</span>
 </div>
 </div>
 </div>
 </div>

 </div>
 </div>
 )}

 {/* TAB: Clinical Calculators Suite View */}
 {activeSubTab === 'calculators' && (
 <div className="space-y-4">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="p-4 rounded-2xl bg-peacock-mist/80 dark:bg-peacock-ink-deep/30 border border-peacock-sage dark:border-peacock-ink/60 flex flex-col justify-between gap-3">
 <div>
 <div className="flex items-center gap-2">
 <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
 <Calculator className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal" />
 حاسبة السعرات (معادلة سمر + معادلة خلود) 
 </h4>
 <span className="text-[12px] font-black bg-peacock-pale dark:bg-peacock-ink/60 text-peacock-indigo-deep dark:text-peacock-teal-light px-1.5 py-0.5 rounded-md">
 معتمدة للعيادة
 </span>
 </div>
 <p className="text-[12px] text-slate-600 dark:text-slate-300 mt-1">
 «معادلة سمر» بالوزن المثالي ومعامل النشاط، و«معادلة خلود» بمعدل REE وTDEE وأهداف النزول (-500 / -1000) مع تطبيق الماكروز مباشرة على الخطة.
 </p>
 </div>

 <button
 type="button"
 onClick={() => setShowBMRCalc(true)}
 className="w-full py-2.5 px-4 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo-dark text-white font-black text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
 >
 <Calculator className="w-4 h-4" />
 <span>فتح حاسبة السعرات (سمر / خلود) </span>
 </button>
 </div>

 <div className="p-4 rounded-2xl bg-[var(--app-card-muted)] border border-cyan-200 dark:border-cyan-900/60 flex flex-col justify-between gap-3">
 <div>
 <div className="flex items-center gap-2">
 <h4 className="text-xs sm:text-sm font-black text-cyan-950 dark:text-cyan-200 flex items-center gap-1.5">
 <Activity className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
 جناح القياسات الإكلينيكية الكامل 
 </h4>
 <HelpButton featureId="coachCalculators" size="sm" />
 </div>
 <p className="text-[12px] text-cyan-800/90 dark:text-cyan-300 mt-1">
 مقارنة معادلات الحرق، نسبة الدهون بطريقة الشريط (US Navy)، احتياج السوائل، والجدول الزمني للهدف.
 </p>
 </div>

 <button
 type="button"
 onClick={() => setShowClinicalSuite(true)}
 className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
 >
 <Activity className="w-4 h-4" />
 <span>فتح الجناح الإكلينيكي المتقدم </span>
 </button>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 space-y-2">
 <div className="flex items-center justify-between">
 <span className="text-xs font-bold text-slate-700 dark:text-slate-200">الوزن الحالي للمتدرب:</span>
 <span className="text-xs font-black text-peacock-indigo dark:text-peacock-teal">{draft.startWeight || 0} كجم</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-xs font-bold text-slate-700 dark:text-slate-200">الطول الحالي:</span>
 <span className="text-xs font-black text-blue-600 dark:text-blue-400">{draft.heightCm || 0} سم</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-xs font-bold text-slate-700 dark:text-slate-200">السعرات المقررة حالياً:</span>
 <span className="text-xs font-black text-amber-600 dark:text-amber-400">{draft.targetCalories || 2000} ك.س</span>
 </div>
 </div>

 <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 space-y-2">
 <div className="flex items-center justify-between">
 <span className="text-xs font-bold text-slate-700 dark:text-slate-200">بروتين:</span>
 <span className="text-xs font-black text-rose-600 dark:text-rose-400">{draft.targetProtein || 120} جم</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-xs font-bold text-slate-700 dark:text-slate-200">كاربوهيدرات:</span>
 <span className="text-xs font-black text-amber-600 dark:text-amber-400">{draft.targetCarbs || 180} جم</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-xs font-bold text-slate-700 dark:text-slate-200">دهون صحية:</span>
 <span className="text-xs font-black text-peacock-indigo dark:text-peacock-teal">{draft.targetFats || 50} جم</span>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* TAB: Medical Conditions & Diagnoses */}
 {activeSubTab === 'medical' && (
 <div className="space-y-3">
 <div className="flex items-center justify-between px-1">
 <div className="flex items-center gap-2">
 <Stethoscope className="w-4 h-4 text-peacock-indigo" />
 <span className="text-xs font-black text-slate-800 dark:text-slate-100">سجل الحالات المرضية والتنبيهات الإكلينيكية</span>
 <HelpButton featureId="coachMedical" size="sm" />
 </div>
 </div>
 <MedicalConditionsEditor
 draft={draft}
 onUpdateDraft={setDraft}
 onNotify={onNotify}
 />
 </div>
 )}

 {/* TAB: Medications & Interactions */}
 {activeSubTab === 'medications' && (
 <div className="space-y-3">
 <div className="flex items-center justify-between px-1">
 <div className="flex items-center gap-2">
 <Pill className="w-4 h-4 text-indigo-600" />
 <span className="text-xs font-black text-slate-800 dark:text-slate-100">سجل الأدوية والمكملات والتعارضات الغذائية</span>
 <HelpButton featureId="coachMedications" size="sm" />
 </div>
 </div>
 <MedicationsManager
 draft={draft}
 onUpdateDraft={setDraft}
 onNotify={onNotify}
 />
 </div>
 )}

 {/* TAB: Menstrual Cycle Tracking */}
 {activeSubTab === 'cycle' && (
 <div className="space-y-3">
 <div className="flex items-center justify-between px-1">
 <div className="flex items-center gap-2">
 <Heart className="w-4 h-4 text-rose-500" />
 <span className="text-xs font-black text-slate-800 dark:text-slate-100">تتبع الدورة الشهرية والمراحل الهرمونية</span>
 <HelpButton featureId="coachCycle" size="sm" />
 </div>
 </div>
 <CycleTrackingManager
 draft={draft}
 onUpdateDraft={setDraft}
 onNotify={onNotify}
 />
 </div>
 )}

 {/* TAB: Lab Tests Tracking */}
 {activeSubTab === 'labs' && (
 <div className="space-y-3">
 <div className="flex items-center justify-between px-1">
 <div className="flex items-center gap-2">
 <Activity className="w-4 h-4 text-peacock-indigo" />
 <span className="text-xs font-black text-slate-800 dark:text-slate-100">سجل التحاليل الطبية والنطاقات الحيوية</span>
 <HelpButton featureId="coachLabs" size="sm" />
 </div>
 </div>
 <LabTrackingManager
 draft={draft}
 onUpdateDraft={setDraft}
 onNotify={onNotify}
 />
 </div>
 )}

 {/* TAB 2: Meals & Alternatives */}
 {activeSubTab === 'meals' && (
 <div className="space-y-4">
 {/* Header Mode Selector & Actions */}
 <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-2">
 <div className="flex items-center gap-2 w-full sm:w-auto">
 <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex-1 sm:flex-none">
 <button
 type="button"
 onClick={() => setMealEditMode('exchanges')}
 className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
 mealEditMode === 'exchanges'
? 'bg-peacock-indigo text-white'
: 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
 }`}
 >
 نظام بدائل الأغذية الإكلينيكي
 </button>

 <button
 type="button"
 onClick={() => setMealEditMode('manual')}
 className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
 mealEditMode === 'manual'
? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
: 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
 }`}
 >
 التعديل اليدوي المباشر
 </button>
 </div>
 <HelpButton featureId="coachMeals" size="sm" />
 </div>

 <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
 <span className="text-xs font-bold text-slate-500">
 عدد الوجبات: ({draft.meals.length})
 </span>
 <button
 onClick={handleAddMeal}
 className="px-3 py-1.5 rounded-xl bg-peacock-indigo text-white font-bold text-xs hover:bg-peacock-indigo-dark flex items-center gap-1 cursor-pointer"
 >
 <Plus className="w-3.5 h-3.5" />
 إضافة وجبة
 </button>
 </div>
 </div>

 {/* Fasting Meal Designer & Smart Converter Bar */}
 <div className="p-4 rounded-2xl bg-peacock-mist/70 dark:bg-peacock-ink-deep/30 border border-peacock-sage/80 dark:border-peacock-ink/60 space-y-3">
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
 <div className="flex items-center gap-2">
 <Zap className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal" />
 <span className="text-xs font-black text-slate-800 dark:text-slate-100">
 مصمم وأدوات وجبات الصيام الذكية:
 </span>
 <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-peacock-pale dark:bg-peacock-ink/60 text-peacock-indigo-deep dark:text-peacock-sage border border-peacock-teal-light dark:border-peacock-indigo-deep">
 {draft.fastingPlan?.type === 'islamic' 
 ? `🌙 صيام إسلامي (${draft.fastingPlan.islamic?.pattern === 'ramadan' ? 'رمضان' : draft.fastingPlan.islamic?.pattern === 'mon_thu' ? 'إثنين وخميس' : draft.fastingPlan.islamic?.pattern === 'white_days' ? 'الأيام البيض' : 'مخصص'})`
 : draft.fastingPlan?.type === 'christian'
 ? `🌿 صيام مسيحي (${draft.fastingPlan.christian?.allowFish ? 'مسموح بالسمك' : 'نباتي صيامي خالص'})`
 : draft.fastingPlan?.type === 'intermittent'
 ? `⏱️ صيام متقطع (${draft.fastingPlan.intermittent?.fastingHours || 16}:${24 - (draft.fastingPlan.intermittent?.fastingHours || 16)})`
 : '☀️ إفطار اعتيادي'}
 </span>
 </div>

 <button
 type="button"
 onClick={() => setShowFastingSubBankModal(true)}
 className="text-xs font-bold text-peacock-indigo dark:text-peacock-teal-light hover:text-peacock-ink underline flex items-center gap-1 cursor-pointer"
 >
 <BookOpen className="w-3.5 h-3.5" />
 <span>استعراض بنك البدائل الذكي الكامل</span>
 </button>
 </div>

 <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-peacock-sage/50 dark:border-peacock-ink/40">
 <button
 type="button"
 onClick={handleIslamicMealRemap}
 className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-peacock-mist dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
 title="إعادة تسمية الوجبات إلى إفطار وسحور وتراويح"
 >
 <Moon className="w-3.5 h-3.5 text-peacock-indigo" />
 <span>تحويل لمسميات سحور وإفطار</span>
 </button>

 <button
 type="button"
 onClick={() => handleFastingAutoConvert(false)}
 className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-peacock-mist dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
 title="تحويل البروتينات الحيوانية لبدائل نباتية خالية من الزيوت"
 >
 <Leaf className="w-3.5 h-3.5 text-peacock-indigo" />
 <span>تحويل تلقائي لبدائل نباتية صيامية</span>
 </button>

 <button
 type="button"
 onClick={() => handleFastingAutoConvert(true)}
 className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
 title="تحويل لبدائل صيامية مع السماح بالأسماك والتونة والجمبري"
 >
 <Fish className="w-3.5 h-3.5 text-sky-600" />
 <span>تحويل لبدائل مع أسماك</span>
 </button>

 <button
 type="button"
 onClick={() => handleAutoPopulateFastingAlternatives(draft.fastingPlan?.christian?.allowFish ?? false)}
 className="px-3 py-1.5 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
 title="توليد البدائل المعتمدة تلقائياً لكل وجبة"
 >
 <Sparkles className="w-3.5 h-3.5" />
 <span>توليد البدائل الصيامية في خانة البدائل</span>
 </button>
 </div>
 </div>

 {/* Fasting Substitutions Reference Bank Modal in Coach */}
 {showFastingSubBankModal && (
 <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
 <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-3xl w-full space-y-4 max-h-[88vh] flex flex-col overflow-hidden">
 {/* Header */}
 <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
 <div className="flex items-center gap-2.5">
 <div className="w-9 h-9 rounded-2xl bg-peacock-blue/10 text-peacock-indigo dark:text-peacock-teal flex items-center justify-center font-bold">
 <Sparkles className="w-5 h-5" />
 </div>
 <div>
 <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base">
 المكتبة الشاملة للبدائل والوجبات الذكية (Smart Substitutions Bank)
 </h3>
 <p className="text-[11px] text-slate-500 dark:text-slate-400">
 مكتبة غذائية إكلينيكية شاملة لبدائل الصيام النباتية والبحرية والسحور المحسوبة
 </p>
 </div>
 </div>
 <button
 type="button"
 onClick={() => setShowFastingSubBankModal(false)}
 className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Search & Category Filter */}
 <div className="space-y-2.5">
 <div className="relative">
 <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
 <input
 type="text"
 placeholder="ابحث في الوجبات، المكونات الأصلية، البدائل، أو النصائح (مثلاً: دجاج، سلمون، سحور، ترمس)..."
 value={fastingSubSearch}
 onChange={(e) => setFastingSubSearch(e.target.value)}
 className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-peacock-blue"
 />
 {fastingSubSearch && (
 <button
 type="button"
 onClick={() => setFastingSubSearch('')}
 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
 >
 مسح
 </button>
 )}
 </div>

 {/* Category Filter Chips */}
 <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
 {[
 { id: 'all', label: 'الكل' },
 { id: 'poultry', label: 'دواجن وطيور 🍗' },
 { id: 'meat', label: 'لحوم حمراء 🥩' },
 { id: 'seafood', label: 'أسماك وبحري 🐟' },
 { id: 'dairy', label: 'ألبان وأجبان 🧀' },
 { id: 'eggs', label: 'بيض وأومليت 🍳' },
 { id: 'legumes_grains', label: 'بقوليات وبروتين خارق 🌱' },
 { id: 'suhur', label: 'سحور وإفطار 🌙' },
 { id: 'snacks_desserts', label: 'سناكات وحلويات 🥜' },
 ].map((cat) => (
 <button
 key={cat.id}
 type="button"
 onClick={() => setFastingSubCategory(cat.id)}
 className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
 fastingSubCategory === cat.id
 ? 'bg-peacock-indigo text-white shadow-xs'
 : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
 }`}
 >
 {cat.label}
 </button>
 ))}
 </div>
 </div>

 {/* Substitutions List */}
 <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 text-xs">
 {(() => {
 const filtered = SMART_SUBSTITUTIONS_BANK.filter((item) => {
 const matchesCat = fastingSubCategory === 'all' || item.category === fastingSubCategory;
 if (!matchesCat) return false;
 if (!fastingSubSearch.trim()) return true;
 const q = fastingSubSearch.toLowerCase().trim();
 return (
 item.original.toLowerCase().includes(q) ||
 item.plantAlternative.toLowerCase().includes(q) ||
 (item.fishAlternative && item.fishAlternative.toLowerCase().includes(q)) ||
 item.notesAr.toLowerCase().includes(q) ||
 (item.tags && item.tags.some((t) => t.toLowerCase().includes(q)))
 );
 });

 if (filtered.length === 0) {
 return (
 <div className="text-center py-10 text-slate-400 space-y-2">
 <p className="font-bold text-sm">لا توجد نتائج مطابقة لبحثك</p>
 <p className="text-xs">جرب البحث بكلمات أخرى أو اختر تصنيف "الكل"</p>
 </div>
 );
 }

 return filtered.map((item) => (
 <div 
 key={item.id}
 className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2.5 hover:border-peacock-teal-light dark:hover:border-peacock-indigo transition-colors"
 >
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-2">
 <span className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-100">
 {item.original}
 </span>
 </div>
 <div className="flex items-center gap-1.5 shrink-0">
 <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-peacock-mist dark:bg-peacock-ink-deep/60 text-peacock-indigo dark:text-peacock-teal-light border border-peacock-sage dark:border-peacock-indigo-deep">
 ~{item.proteinGrams}g بروتين صافي
 </span>
 {item.caloriesApprox && (
 <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
 ~{item.caloriesApprox} كالوري
 </span>
 )}
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
 {/* Plant Alt */}
 <div className="p-2.5 rounded-xl bg-peacock-mist/70 dark:bg-peacock-ink-deep/30 border border-peacock-pale dark:border-peacock-ink/50 space-y-1 flex flex-col justify-between">
 <div>
 <div className="flex items-center justify-between">
 <span className="text-[10px] font-black text-peacock-indigo-deep dark:text-peacock-teal-light flex items-center gap-1">
 <Leaf className="w-3 h-3 text-peacock-indigo" /> بديل نباتي صيامي خالص:
 </span>
 <button
 type="button"
 onClick={() => {
 navigator.clipboard.writeText(item.plantAlternative);
 onNotify(`تم نسخ البديل النباتي لـ (${item.original})`);
 }}
 className="text-[10px] font-bold text-peacock-indigo-dark hover:text-peacock-ink dark:text-peacock-teal flex items-center gap-0.5 cursor-pointer"
 title="نسخ البديل"
 >
 <Copy className="w-2.5 h-2.5" /> نسخ
 </button>
 </div>
 <p className="font-semibold text-slate-700 dark:text-slate-200 mt-1 leading-relaxed">
 {item.plantAlternative}
 </p>
 </div>
 </div>

 {/* Fish Alt */}
 {item.fishAlternative ? (
 <div className="p-2.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/50 space-y-1 flex flex-col justify-between">
 <div>
 <div className="flex items-center justify-between">
 <span className="text-[10px] font-black text-sky-800 dark:text-sky-300 flex items-center gap-1">
 <Fish className="w-3 h-3 text-sky-600" /> بديل أسماك وبحري (درجة ثانية):
 </span>
 <button
 type="button"
 onClick={() => {
 navigator.clipboard.writeText(item.fishAlternative || '');
 onNotify(`تم نسخ البديل البحري لـ (${item.original})`);
 }}
 className="text-[10px] font-bold text-sky-700 hover:text-sky-900 dark:text-sky-400 flex items-center gap-0.5 cursor-pointer"
 title="نسخ البديل"
 >
 <Copy className="w-2.5 h-2.5" /> نسخ
 </button>
 </div>
 <p className="font-semibold text-slate-700 dark:text-slate-200 mt-1 leading-relaxed">
 {item.fishAlternative}
 </p>
 </div>
 </div>
 ) : (
 <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center text-slate-400 text-[11px]">
 نباتي فقط (لا يتطلب بديلاً بحرياً)
 </div>
 )}
 </div>

 <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
 <p className="flex items-center gap-1">
 <span>💡</span>
 <span>{item.notesAr}</span>
 </p>
 </div>
 </div>
 ));
 })()}
 </div>

 {/* Footer */}
 <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
 <span className="text-slate-500 font-bold">
 إجمالي البدائل المتاحة: ({SMART_SUBSTITUTIONS_BANK.length} صنف مسجل)
 </span>
 <button
 type="button"
 onClick={() => setShowFastingSubBankModal(false)}
 className="px-4 py-2 rounded-xl bg-peacock-indigo text-white font-bold hover:bg-peacock-indigo transition-colors cursor-pointer"
 >
 إغلاق المكتبة
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Mode 1: Clinical Exchange Allocator */}
 {mealEditMode === 'exchanges'? (
 <MealExchangePlanner
 draft={draft}
 coachSessionUnlocked={coachSessionUnlocked}
 onUpdateDraft={setDraft}
 onNotify={onNotify}
 />
 ): (
 /* Mode 2: Manual Text Editor */
 <div className="space-y-3">
 {draft.meals.map((meal, idx) => (
 <div
 key={meal.id || idx}
 className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5"
 >
 <div className="flex items-center justify-between gap-2">
 <input
 type="text"
 value={meal.name}
 onChange={(e) => {
 const updated = [...draft.meals];
 updated[idx].name = e.target.value;
 setDraft({...draft, meals: updated });
 }}
 className="text-xs font-bold px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 flex-1"
 placeholder="اسم الوجبة"
 />
 <button
 onClick={() => handleRemoveMeal(idx)}
 className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
 title="حذف الوجبة"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>

 <div>
 <label className="block text-[12px] font-semibold text-slate-400 mb-1">
 المكونات الأساسية المقررة:
 </label>
 <textarea
 rows={2}
 value={meal.items}
 onChange={(e) => {
 const updated = [...draft.meals];
 updated[idx].items = e.target.value;
 setDraft({...draft, meals: updated });
 }}
 className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 resize-none"
 placeholder="تفاصيل المكونات والكميات..."
 />
 </div>

 <div>
 <label className="block text-[12px] font-semibold text-amber-600 dark:text-amber-400 mb-1">
 البدائل المتاحة (افصل بين البدائل بعلامة |):
 </label>
 <input
 type="text"
 value={(meal.alternatives || []).join(' | ')}
 onChange={(e) => {
 const updated = [...draft.meals];
 updated[idx].alternatives = e.target.value
.split('|')
.map((s) => s.trim())
.filter(Boolean);
 setDraft({...draft, meals: updated });
 }}
 className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
 placeholder="بديل 1 | بديل 2 | بديل 3"
 />
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {/* TAB 3: Habits & Supplements & Tips (Spacious 3-Column Responsive Grid) */}
 {activeSubTab === 'habits' && (
 <div className="space-y-4">
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
 
 {/* Column 1: Daily Habits & Checklist */}
 <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 space-y-3.5">
 <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-700/60 pb-2.5">
 <div className="flex items-center gap-1.5 min-w-0">
 <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
 <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 truncate">
 المهام والعادات اليومية ({draft.checklist.length})
 </span>
 <HelpButton featureId="coachHabits" size="sm" />
 </div>
 <button
 onClick={handleAddCheck}
 className="px-3 py-1.5 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo-dark text-white font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0"
 >
 <Plus className="w-3.5 h-3.5" />
 إضافة
 </button>
 </div>
 <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
 {draft.checklist.map((c, idx) => (
 <div key={c.id || idx} className="flex gap-2 items-center bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
 <input
 type="text"
 value={c.label}
 onChange={(e) => {
 const updated = [...draft.checklist];
 updated[idx].label = e.target.value;
 setDraft({...draft, checklist: updated });
 }}
 className="flex-1 text-xs sm:text-sm font-medium p-2 rounded-lg bg-transparent text-slate-800 dark:text-slate-100 focus:outline-hidden"
 placeholder="نص العادة أو المهمة..."
 />
 <button
 onClick={() => handleRemoveCheck(idx)}
 className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
 title="حذف العادة"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 </div>
 ))}
 </div>
 </div>

 {/* Column 2: Supplements & Medications */}
 <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 space-y-3.5">
 <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-700/60 pb-2.5">
 <div className="flex items-center gap-1.5 min-w-0">
 <Pill className="w-4 h-4 text-peacock-indigo shrink-0" />
 <span className="text-xs sm:text-sm font-black text-peacock-indigo-deep dark:text-peacock-teal-light truncate">
 الأدوية والمكملات ({draft.supplements?.length || 0})
 </span>
 </div>
 <div className="flex items-center gap-1.5 shrink-0">
 <button
 type="button"
 onClick={() => setShowMedicationCatalog(true)}
 className="px-2.5 py-1.5 rounded-xl bg-peacock-pale hover:bg-peacock-sage dark:bg-peacock-ink-deep/60 dark:hover:bg-peacock-ink/80 text-peacock-indigo-dark dark:text-peacock-teal-light font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors border border-peacock-sage/80 dark:border-peacock-indigo-deep/60"
 title="تصفح دليل الأدوية والمكملات المصرية الشامل"
 >
 <Search className="w-3.5 h-3.5" />
 <span>دليل الأدوية 🇪🇬</span>
 </button>
 <button
 type="button"
 onClick={handleAddSupp}
 className="px-3 py-1.5 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo-dark text-white font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
 >
 <Plus className="w-3.5 h-3.5" />
 <span>إضافة</span>
 </button>
 </div>
 </div>

 <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
 {(!draft.supplements || draft.supplements.length === 0) && (
 <div className="text-center py-6 px-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 text-xs">
 <p className="font-semibold">لا توجد أدوية أو مكملات مضافة حالياً.</p>
 <p className="text-[11px] text-slate-400 mt-1">انقر على "دليل الأدوية 🇪🇬" للبحث في قاعدة بيانات السوق المصري.</p>
 </div>
 )}
 {(draft.supplements || []).map((s, idx) => (
 <MedicationInputRow
 key={s.id || idx}
 item={s}
 index={idx}
 onChange={(updated) => {
 const nextSupps = [...draft.supplements];
 nextSupps[idx] = updated;
 setDraft({ ...draft, supplements: nextSupps });
 }}
 onRemove={() => handleRemoveSupp(idx)}
 onOpenCatalog={() => setShowMedicationCatalog(true)}
 />
 ))}
 </div>
 </div>

 {/* Column 3: Doctor's Guidance & Tips */}
 <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 space-y-3.5">
 <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-700/60 pb-2.5">
 <div className="flex items-center gap-1.5 min-w-0">
 <Lightbulb className="w-4 h-4 text-peacock-indigo shrink-0" />
 <span className="text-xs sm:text-sm font-black text-peacock-indigo-deep dark:text-peacock-teal-light truncate">
 {brandCopy.tipsFrom} ({draft.tips?.length || 0})
 </span>
 </div>
 <button
 onClick={handleAddTip}
 className="px-3 py-1.5 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo-dark text-white font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0"
 >
 <Plus className="w-3.5 h-3.5" />
 إضافة
 </button>
 </div>
 <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
 {(draft.tips || []).map((t, idx) => (
 <div key={idx} className="flex gap-2 items-center bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
 <input
 type="text"
 value={t}
 onChange={(e) => {
 const updated = [...draft.tips];
 updated[idx] = e.target.value;
 setDraft({...draft, tips: updated });
 }}
 className="flex-1 text-xs sm:text-sm font-medium p-2 rounded-lg bg-transparent text-slate-800 dark:text-slate-100 focus:outline-hidden"
 placeholder="نص التوجيه أو النصيحة..."
 />
 <button
 onClick={() => handleRemoveTip(idx)}
 className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
 title="حذف النصيحة"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 </div>
 ))}
 </div>
 </div>

 </div>
 </div>
 )}

 {/* TAB 4: Sections Customization (Spacious 2-Column Responsive Grid) */}
 {activeSubTab === 'sections' && (
 <div className="space-y-5">
 {/* Header & Quick Presets */}
 <div className="p-4 sm:p-5 rounded-2xl bg-peacock-mist/80 dark:bg-peacock-ink-deep/30 border border-peacock-sage dark:border-peacock-ink/60 space-y-3">
 <div className="flex items-center justify-between">
 <div>
 <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
 <LayoutGrid className="w-4 h-4 text-peacock-indigo" />
 تخصيص لوحات وأقسام صفحة المتدرب
 </h4>
 <p className="text-[12px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
 يمكنك إخفاء أو إظهار أي لوحة أو عنصر في واجهة المتدرب بضغطة واحدة لتحقيق البساطة والتركيز
 </p>
 </div>
 <HelpButton featureId="coachSections" size="sm" />
 </div>

 {/* Quick Presets Buttons */}
 <div className="flex flex-wrap gap-2 pt-1">
 <button
 onClick={() => handleSetAllSections(true)}
 className="px-3.5 py-1.5 rounded-xl bg-peacock-indigo text-white font-bold text-xs hover:bg-peacock-indigo-dark transition-colors flex items-center gap-1.5 cursor-pointer"
 >
 <Eye className="w-3.5 h-3.5" />
 إظهار كافة اللوحات
 </button>
 <button
 onClick={handleSetMinimalSections}
 className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-1.5 cursor-pointer"
 >
 <Circle className="w-3.5 h-3.5 text-amber-500" />
 الوضع المبسط (وجبات وماء فقط)
 </button>
 </div>
 </div>

 {/* Categorized Panels List in 2-Column Responsive Layout */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
 {[
 {
 title: '1. اللوحات الرئيسية والتنبيهات',
 items: [
 {
 key: 'scoreCard' as const,
 label: 'بطاقة معدل الالتزام وسلسلة الأيام',
 desc: 'نسبة الالتزام الإجمالية، الستريك، ويوم الفري وأزرار التقرير',
 icon: <Circle className="w-4 h-4 text-peacock-blue" />,
 },
 {
 key: 'tipsBanner' as const,
 label: `بانر إرشادات ونصائح ${BRAND.doctorName}`,
 desc: 'الإرشادات اليومية الموجهة وزر دليل البدائل المعتمدة',
 icon: <Lightbulb className="w-4 h-4 text-amber-500" />,
 },
 {
 key: 'quickReportBtn' as const,
 label: 'زر الإرسال السريع لتقرير الواتساب',
 desc: 'الزر الأخضر الكبير في أسفل الصفحة لتصدير ومشاركة التقرير اليومي',
 icon: <Share2 className="w-4 h-4 text-peacock-indigo" />,
 },
 ],
 },
 {
 title: '2. التغذية والوجبات',
 items: [
 {
 key: 'mealsList' as const,
 label: 'قائمة الوجبات والبدائل المقررة',
 desc: 'بطاقات وجبات اليوم مع زر البدائل وخيارات التقييم',
 icon: <Utensils className="w-4 h-4 text-peacock-indigo" />,
 },
 {
 key: 'macrosTracker' as const,
 label: 'حاسبة وتتبع السعرات والماكروز',
 desc: 'شريط تتبع السعرات والبروتين والكارب والدهون المستهلكة',
 icon: <Flame className="w-4 h-4 text-orange-500" />,
 },
 {
 key: 'fastingTimer' as const,
 label: 'مؤقت ساعات الصيام المتقطع',
 desc: 'عداد الصيام التفاعلي مع حساب ساعات الصيام والبدء والإيقاف',
 icon: <Timer className="w-4 h-4 text-peacock-blue" />,
 },
 ],
 },
 {
 title: '3. السوائل والراحة والنشاط',
 items: [
 {
 key: 'waterTracker' as const,
 label: 'متابع استهلاك الماء اليومي',
 desc: 'أزرار الأكواب ومتابع الكمية المستهلكة نحو الهدف بالمل',
 icon: <Droplets className="w-4 h-4 text-cyan-500" />,
 },
 {
 key: 'sleepTracker' as const,
 label: 'متابع ساعات وجودة النوم',
 desc: 'حساب مدة النوم وأوقات النوم والاستيقاظ وتقييم الراحة',
 icon: <Moon className="w-4 h-4 text-indigo-500" />,
 },
 {
 key: 'moodTracker' as const,
 label: 'متابع الحالة المزاجية والطاقة',
 desc: 'تسجيل مستوى النشاط والمزاج اليومي للمتدرب',
 icon: <Smile className="w-4 h-4 text-amber-500" />,
 },
 {
 key: 'exerciseTracker' as const,
 label: 'متابع النشاط والتمرين الرياضي',
 desc: 'تسجيل دقائق التمرين والمشي وحساب حرق السعرات التقديري',
 icon: <Activity className="w-4 h-4 text-rose-500" />,
 },
 ],
 },
 {
 title: '4. العادات والمتابعة الطبية',
 items: [
 {
 key: 'checklistTracker' as const,
 label: 'قائمة العادات والمهام اليومية',
 desc: 'قائمة المهام المحددة للمتدرب (مشى، أكل خضار، التزام...)',
 icon: <CheckSquare className="w-4 h-4 text-peacock-blue" />,
 },
 {
 key: 'supplementsTracker' as const,
 label: 'الفيتامينات والمكملات الغذائية',
 desc: 'مواعيد وجرعات المكملات والفيتامينات المقررة',
 icon: <Pill className="w-4 h-4 text-peacock-blue" />,
 },
 {
 key: 'medicationsTracker' as const,
 label: 'بطاقة أدوية اليوم والالتزام الدوائي',
 desc: 'عرض جدول جرعات الأدوية وتسجيل الالتزام للعميل في تبويب اليوم',
 icon: <Pill className="w-4 h-4 text-blue-500" />,
 },
 {
 key: 'cycleTracker' as const,
 label: 'بطاقة دورة اليوم والسياق الهرموني ',
 desc: 'إظهار بطاقة تسجيل الدورة، الطور التقريبي، والأعراض في تبويب اليوم',
 icon: <Heart className="w-4 h-4 text-rose-500" />,
 },
 {
 key: 'symptomsTracker' as const,
 label: 'متابع الأعراض والتعب الجسدي',
 desc: 'تسجيل أي أعراض كالصداع أو الدوخة أو الخمول لمراجعتها',
 icon: <Stethoscope className="w-4 h-4 text-rose-500" />,
 },
 {
 key: 'doctorNotes' as const,
 label: `ملاحظات واستفسارات لـ ${BRAND.doctorName}`,
 desc: brandCopy.traineeNotes,
 icon: <MessageSquare className="w-4 h-4 text-peacock-blue" />,
 },
 ],
 },
 {
 title: '5. التبويبات السفلية الإضافية',
 items: [
 {
 key: 'bodyTab' as const,
 label: 'تبويب قياسات وصور تطور الجسم',
 desc: 'إتاحة تبويب قياسات الوزن والمحيطات ومقارنة الصور للمتدرب',
 icon: <Ruler className="w-4 h-4 text-blue-500" />,
 },
 {
 key: 'labTracker' as const,
 label: 'قسم التحاليل المعملية ورسوم التتبع ',
 desc: 'إظهار كروت التحاليل ورسم الاتجاه في تاب الجسم',
 icon: <Activity className="w-4 h-4 text-peacock-blue" />,
 },
 {
 key: 'reportsTab' as const,
 label: 'تبويب التقارير الأسبوعية والأرشيف',
 desc: 'إتاحة تبويب سجلات الأيام وتصدير تقارير المتابعة الشاملة',
 icon: <BarChart3 className="w-4 h-4 text-peacock-blue" />,
 },
 ],
 },
 ].map((grp) => (
 <div key={grp.title} className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
 <h5 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
 {grp.title}
 </h5>

 <div className="space-y-2">
 {grp.items.map((item) => {
 const isVisible = isSectionVisible(draft, item.key);
 return (
 <div
 key={item.key}
 onClick={() => handleToggleSection(item.key)}
 className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
 isVisible
? 'bg-white dark:bg-slate-850 border-slate-200/90 dark:border-slate-700 hover:border-peacock-teal dark:hover:border-peacock-indigo'
: 'bg-slate-100/50 dark:bg-slate-900/40 border-dashed border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-90'
 }`}
 >
 <div className="flex items-center gap-3 flex-1 min-w-0">
 <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
 isVisible 
? 'bg-slate-100 dark:bg-slate-750' 
: 'bg-slate-200 dark:bg-slate-800 text-slate-400'
 }`}>
 {item.icon}
 </div>

 <div className="min-w-0">
 <div className="flex items-center gap-1.5 flex-wrap">
 <span className={`text-xs sm:text-sm font-black block truncate ${
 isVisible? 'text-slate-800 dark:text-slate-100': 'text-slate-500 dark:text-slate-400'
 }`}>
 {item.label}
 </span>
 {isVisible? (
 <span className="text-[12px] font-black px-2 py-0.5 rounded-full bg-peacock-pale text-peacock-indigo-deep dark:bg-peacock-ink-deep dark:text-peacock-teal-light">
 ظاهرة
 </span>
 ): (
 <span className="text-[12px] font-black px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
 مخفية
 </span>
 )}
 </div>
 <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
 {item.desc}
 </p>
 </div>
 </div>

 {/* Toggle Switch */}
 <div className="shrink-0 flex items-center">
 <div
 className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
 isVisible? 'bg-peacock-indigo': 'bg-slate-300 dark:bg-slate-700'
 }`}
 >
 <div
 className={`bg-white w-4 h-4 rounded-full transform transition-transform duration-200 ease-in-out ${
 isVisible? '-translate-x-5': 'translate-x-0'
 }`}
 />
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* TAB 5: Score Weights (Spacious 4-Column Responsive Grid) */}
 {activeSubTab === 'weights' && (
 <div className="space-y-4">
 <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
 <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">
 حدد النسبة المئوية لتأثير كل محور على تقييم الالتزام اليومي الإجمالي للمتدرب:
 </p>
 <HelpButton featureId="coachWeights" size="sm" />
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 <div className="bg-slate-50/90 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
 <label className="block text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
 الوجبات (%)
 </label>
 <input
 type="number"
 min="0"
 max="100"
 value={draft.scoreWeights.meals}
 onChange={(e) =>
 setDraft({
...draft,
 scoreWeights: {...draft.scoreWeights, meals: parseInt(e.target.value, 10) || 0 },
 })
 }
 className="w-full text-sm sm:text-base font-black p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center"
 />
 </div>

 <div className="bg-slate-50/90 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
 <label className="block text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
 شرب المية (%)
 </label>
 <input
 type="number"
 min="0"
 max="100"
 value={draft.scoreWeights.water}
 onChange={(e) =>
 setDraft({
...draft,
 scoreWeights: {...draft.scoreWeights, water: parseInt(e.target.value, 10) || 0 },
 })
 }
 className="w-full text-sm sm:text-base font-black p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center"
 />
 </div>

 <div className="bg-slate-50/90 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
 <label className="block text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
 العادات والمهام (%)
 </label>
 <input
 type="number"
 min="0"
 max="100"
 value={draft.scoreWeights.checklist}
 onChange={(e) =>
 setDraft({
...draft,
 scoreWeights: {...draft.scoreWeights, checklist: parseInt(e.target.value, 10) || 0 },
 })
 }
 className="w-full text-sm sm:text-base font-black p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center"
 />
 </div>

 <div className="bg-slate-50/90 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
 <label className="block text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
 النوم والراحة (%)
 </label>
 <input
 type="number"
 min="0"
 max="100"
 value={draft.scoreWeights.sleep}
 onChange={(e) =>
 setDraft({
...draft,
 scoreWeights: {...draft.scoreWeights, sleep: parseInt(e.target.value, 10) || 0 },
 })
 }
 className="w-full text-sm sm:text-base font-black p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center"
 />
 </div>
 </div>

 <div className="p-3.5 rounded-2xl bg-peacock-mist dark:bg-peacock-ink-deep/40 text-peacock-indigo-deep dark:text-peacock-teal-light text-xs sm:text-sm font-black text-center border border-peacock-sage dark:border-peacock-indigo-deep/60">
 إجمالي الأوزان الحالية: {(draft.scoreWeights.checklist || 0) + (draft.scoreWeights.water || 0) + (draft.scoreWeights.sleep || 0) + (draft.scoreWeights.meals || 0)}%
 </div>
 </div>
 )}

 {/* TAB 6: Backup & Share (Spacious 2-Column Responsive Grid) */}
 {activeSubTab === 'backup' && (
 <div className="space-y-5">
  {/* Official Medical PDF Export Feature Card */}
  <div className="p-5 sm:p-6 rounded-3xl bg-linear-to-r from-peacock-mist via-peacock-mist to-peacock-mist dark:from-peacock-ink-deep/40 dark:via-peacock-ink-deep/40 dark:to-peacock-ink-deep/40 border-2 border-peacock-blue/40 dark:border-peacock-indigo/60 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
   <div className="flex items-start sm:items-center gap-3.5">
    <div className="w-12 h-12 rounded-2xl bg-peacock-indigo text-white flex items-center justify-center font-bold shadow-md shrink-0">
     <FileDown className="w-6 h-6" />
    </div>
    <div>
     <div className="flex items-center gap-2 flex-wrap">
      <h4 className="font-black text-slate-900 dark:text-slate-100 text-sm sm:text-base">
       تصدير الخطة كملف PDF رسمي (Medical Dietary Prescription)
      </h4>
      <span className="text-[12px] font-black px-2.5 py-0.5 rounded-full bg-peacock-pale text-peacock-indigo-deep dark:bg-peacock-ink dark:text-peacock-sage border border-peacock-teal-light dark:border-peacock-indigo">
       A4 عالي الدقة
      </span>
     </div>
     <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed font-medium">
      توليد وطباعة روشتة غذائية علاجية شاملة باسم المتدرب ({draft.clientName || 'غير محدد'})، تشمل جدول الوجبات، البدائل الإكلينيكية، الماكروز والسعرات، الأدوية والمكملات، والختم الطبي المعتمد لـ {BRAND.doctorName}.
     </p>
    </div>
   </div>

   <div className="flex items-center gap-2 shrink-0">
    <button
     type="button"
     onClick={() => setShowPDFExportModal(true)}
     className="px-5 py-3 rounded-2xl bg-peacock-indigo hover:bg-peacock-indigo text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer"
    >
     <FileDown className="w-4 h-4" />
     <span>معاينة وتصدير PDF الآن</span>
    </button>
   </div>
  </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
 
 {/* Column 1: WhatsApp Export Options & Sync Code */}
 <div className="space-y-4">
 {/* Option 1: Detailed Readable Plan (No Code) */}
 <div className="p-4 sm:p-5 rounded-2xl bg-peacock-mist/90 dark:bg-peacock-ink-deep/40 border border-peacock-sage dark:border-peacock-indigo-deep/80 space-y-3">
 <div className="flex items-center justify-between border-b border-peacock-sage/80 dark:border-peacock-indigo-deep/80 pb-2.5">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-xl dark: text-peacock-indigo-dark dark:text-peacock-teal-light flex items-center justify-center font-bold">
 <FileText className="w-4 h-4" />
 </div>
 <div>
 <h4 className="font-black text-peacock-ink-deep dark:text-peacock-sage text-xs sm:text-sm">
 1. إرسال الخطة الشاملة المكتوبة (بدون كود)
 </h4>
 <span className="text-[12px] text-peacock-indigo-dark dark:text-peacock-teal">
 مفصلة بالعربي • سهلة القراءة • للموبايلات القديمة
 </span>
 </div>
 </div>
 <span className="text-[12px] font-black px-2 py-0.5 rounded-full bg-peacock-sage/70 dark:bg-peacock-ink text-peacock-indigo-deep dark:text-peacock-teal-light">
 نص عربي فقط
 </span>
 </div>

 <p className="text-[12px] text-peacock-indigo-deep/90 dark:text-peacock-teal-light leading-relaxed">
 نص الخطة المكتوبة بالتفصيل (الوجبات والبدائل، السعرات، الماكروز، هدف الماء، المكملات، والعادات) <strong>بدون كود المزامنة المشفر</strong>. مثالي للقراءة المباشرة على الواتساب وللأجهزة ذات الحافظة (Clipboard) المحدودة.
 </p>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
 <button
 onClick={handleShareReadablePlanWhatsApp}
 className="w-full py-2.5 px-3 rounded-xl bg-peacock-indigo text-white font-black text-xs sm:text-sm hover:bg-peacock-indigo-dark transition-all flex items-center justify-center gap-1.5 cursor-pointer"
 >
 <Share2 className="w-4 h-4" />
 إرسال الخطة بالواتساب 
 </button>

 <button
 onClick={handleCopyReadablePlan}
 className="w-full py-2.5 px-3 rounded-xl bg-peacock-pale dark:bg-peacock-ink/60 text-peacock-indigo-deep dark:text-peacock-sage font-bold text-xs sm:text-sm hover:bg-peacock-sage dark:hover:bg-peacock-indigo-deep transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
 >
 <Copy className="w-4 h-4" />
 نسخ الخطة المكتوبة 
 </button>
 </div>
 </div>

 {/* Option 2: Sync Code Only */}
 <div className="p-4 sm:p-5 rounded-2xl bg-cyan-50/90 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/80 space-y-3">
 <div className="flex items-center justify-between border-b border-cyan-200/80 dark:border-cyan-800/80 pb-2.5">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-xl dark: text-cyan-700 dark:text-cyan-300 flex items-center justify-center font-bold">
 <Smartphone className="w-4 h-4" />
 </div>
 <div>
 <h4 className="font-black text-cyan-950 dark:text-cyan-200 text-xs sm:text-sm">
 2. إرسال كود تفعيل الخطة للتطبيق فقط
 </h4>
 <span className="text-[12px] text-cyan-700 dark:text-cyan-400">
 كود تفعيل مشفر • خفيف وصغير الحجم • #START_PLAN_DATA#
 </span>
 </div>
 </div>
 <span className="text-[12px] font-black px-2 py-0.5 rounded-full bg-cyan-200/70 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-300">
 كود فقط
 </span>
 </div>

 <p className="text-[12px] text-cyan-900/90 dark:text-cyan-300 leading-relaxed">
 يحتوي فقط على كود التفعيل الرقمي للخطة لتقوم المتدربة بنسخه ولصقه مباشرة في خانة <strong>" {brandCopy.addPlanCta}"</strong> داخل التطبيق، دون أي نصوص إضافية طويلة.
 </p>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
 <button
 onClick={handleShareSyncCodeWhatsApp}
 className="w-full py-2.5 px-3 rounded-xl bg-cyan-600 text-white font-black text-xs sm:text-sm hover:bg-cyan-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
 >
 <Share2 className="w-4 h-4" />
 إرسال الكود بالواتساب 
 </button>

 <button
 onClick={handleCopySyncCode}
 className="w-full py-2.5 px-3 rounded-xl bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 font-bold text-xs sm:text-sm hover:bg-cyan-200 dark:hover:bg-cyan-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
 >
 <Copy className="w-4 h-4" />
 نسخ كود التفعيل 
 </button>
 </div>
 </div>

 {/* Option 3: Full Combined Message & JSON Direct */}
 <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">
 <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-bold">
 <span> الخطة الشاملة المدمجة (نص + كود معاً):</span>
 <span className="text-[12px] text-slate-400 font-normal">للأجهزة الحديثة</span>
 </div>

 <div className="flex flex-wrap items-center gap-2">
 <button
 onClick={handleShareFullPlanWhatsApp}
 className="flex-1 py-2 px-2.5 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo-deep text-white font-black text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
 >
 <Send className="w-3.5 h-3.5" />
 <span>إرسال مدمجة</span>
 </button>

 <button
 onClick={handleCopyFullPlan}
 className="flex-1 py-2 px-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
 >
 <Copy className="w-3.5 h-3.5" />
 <span>نسخ مدمجة</span>
 </button>

 <button
 onClick={handleCopyRawJson}
 className="py-2 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold text-[12px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
 >
 <Code2 className="w-3.5 h-3.5" />
 <span>JSON</span>
 </button>
 </div>
 </div>
 </div>

 {/* Column 2: Weekly Follow-up Draft & Backup/Restore */}
 <div className="space-y-4">
 {/* Weekly Message Draft Card */}
 <div className="p-5 rounded-2xl bg-peacock-mist/80 dark:bg-peacock-ink-deep/30 border border-peacock-sage dark:border-peacock-indigo-deep/80 space-y-3.5">
 <div className="flex items-center justify-between border-b border-peacock-sage/80 dark:border-peacock-indigo-deep/80 pb-2.5">
 <h4 className="font-black text-peacock-ink-deep dark:text-peacock-sage text-xs sm:text-sm flex items-center gap-1.5">
 <Wand2 className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal" />
 صياغة رسالة المتابعة الأسبوعية ({BRAND.doctorName}) 
 </h4>
 <span className="text-[12px] font-black px-2 py-0.5 rounded-full bg-peacock-pale dark:bg-peacock-ink-deep text-peacock-indigo-deep dark:text-peacock-teal-light border border-peacock-sage dark:border-peacock-indigo-deep">
 تحليل 7 أيام
 </span>
 </div>
 <p className="text-[12px] sm:text-xs text-peacock-ink/80 dark:text-peacock-teal-light leading-relaxed">
 توليد رسالة تشجيعية وتوجيه عملي مباشر للواتساب بالاعتماد على التزام المتدرب، تغير وزنه، شربه للماء، وتمارينه خلال آخر أسبوع.
 </p>

 {coachWeeklyDraftText === null? (
 <button
 type="button"
 onClick={handleGenerateCoachWeeklyDraft}
 className="w-full py-3 px-4 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo-dark text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
 >
 <Wand2 className="w-4 h-4 text-amber-200" />
 <span>صياغة مسودة المتابعة للأسبوع </span>
 </button>
 ): (
 <div className="space-y-2.5 pt-1">
 <label className="block text-[12px] sm:text-xs font-black text-peacock-ink dark:text-peacock-teal-light">
 مراجعة وتعديل نص الرسالة المقترح:
 </label>
 <textarea
 rows={6}
 value={coachWeeklyDraftText}
 onChange={(e) => setCoachWeeklyDraftText(e.target.value)}
 className="w-full text-xs sm:text-sm p-3 rounded-xl border border-peacock-sage dark:border-peacock-indigo-deep bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 resize-none font-medium leading-relaxed"
 placeholder="مسودة الرسالة..."
 />

 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
 <button
 type="button"
 onClick={() => {
 const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(coachWeeklyDraftText)}`;
 window.open(url, '_blank');
 onNotify('جاري فتح الواتساب بالمسودة ');
 }}
 className="py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
 >
 <Send className="w-3.5 h-3.5" />
 <span>إرسال واتساب</span>
 </button>

 <button
 type="button"
 onClick={() => {
 navigator.clipboard.writeText(coachWeeklyDraftText).then(() => {
 onNotify('تم نسخ مسودة المتابعة بنجاح ');
 });
 }}
 className="py-2.5 px-3 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
 >
 <Copy className="w-3.5 h-3.5" />
 <span>نسخ النص</span>
 </button>

 <button
 type="button"
 onClick={handleGenerateCoachWeeklyDraft}
 className="py-2.5 px-3 rounded-xl bg-peacock-pale dark:bg-peacock-ink-deep text-peacock-indigo-deep dark:text-peacock-teal-light hover:bg-peacock-sage dark:hover:bg-peacock-ink font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
 >
 <RotateCcw className="w-3.5 h-3.5" />
 <span>إعادة التوليد</span>
 </button>
 </div>
 </div>
 )}
 </div>

 {/* Full JSON Backup & Restore + Reset */}
 <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
 <h4 className="font-black text-slate-800 dark:text-slate-100 text-xs sm:text-sm flex items-center gap-2">
 <Download className="w-4 h-4 text-blue-500" />
 نسخ احتياطي واستعادة كاملة
 </h4>
 <p className="text-[12px] text-slate-500 dark:text-slate-400">
 حفظ أو استرجاع جميع السجلات اليومية والبيانات في ملف خارجي.
 </p>
 <div className="grid grid-cols-2 gap-2.5 pt-1">
 <button
 onClick={handleExportFullBackup}
 className="py-2.5 px-3 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
 >
 <Download className="w-3.5 h-3.5" />
 تصدير (JSON)
 </button>

 <label className="py-2.5 px-3 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 transition-colors cursor-pointer flex items-center justify-center gap-1.5">
 <Upload className="w-3.5 h-3.5" />
 استيراد نسخة
 <input
 type="file"
 accept=".json"
 onChange={handleImportBackupFile}
 className="hidden"
 />
 </label>
 </div>

 <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
 <button
 onClick={handleResetToDefault}
 className="w-full py-2.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 font-bold text-xs hover:bg-rose-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
 >
 <RotateCcw className="w-3.5 h-3.5" />
 استعادة الخطة الافتراضية
 </button>
 </div>
 </div>

 </div>

 </div>
 </div>
 )}
 </div>

 {/* Sticky Mobile-First Footer Actions Bar */}
 <div className={isPageMode? "fixed bottom-0 left-0 right-0 z-40 p-3 sm:p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-2.5": "p-3 sm:p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-2.5 shrink-0 z-20"}>
 {isPageMode? (
 <button
 type="button"
 onClick={onNavigateClient}
 className="min-h-[44px] h-12 px-3 sm:px-4 rounded-2xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 bg-slate-100/80 dark:bg-slate-800/80 transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
 >
 <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
 <span className="hidden xs:inline">معاينة العميل</span>
 </button>
 ): (
 <button
 type="button"
 onClick={onClose}
 className="min-h-[44px] h-12 px-4 rounded-2xl text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 bg-slate-100/80 dark:bg-slate-800/80 transition-all cursor-pointer shrink-0"
 >
 إلغاء
 </button>
 )}
 
 <div className="flex items-center gap-2 flex-1 justify-end">
 <button
 type="button"
 onClick={() => setShowPDFExportModal(true)}
 className="min-h-[44px] h-12 px-3 sm:px-4 rounded-2xl bg-peacock-blue/10 hover:bg-peacock-blue/20 text-peacock-indigo dark:text-peacock-teal-light border border-peacock-blue/30 font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
 title="تصدير الخطة كملف PDF رسمي (Medical Prescription)"
 >
 <FileDown className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal" />
 <span className="hidden xs:inline">تصدير PDF</span>
 </button>

 <button
 type="button"
 onClick={() => setShowShareOptionsModal(true)}
 className="min-h-[44px] h-12 px-3 sm:px-4 rounded-2xl bg-peacock-blue/10 hover:bg-peacock-blue/20 text-peacock-indigo-dark dark:text-peacock-teal-light border border-peacock-blue/30 font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
 title="خيارات إرسال الخطة عبر واتساب"
 >
 <Share2 className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal" />
 <span className="hidden xs:inline">إرسال واتساب</span>
 </button>

 <button
 type="button"
 onClick={handleSave}
 className="min-h-[44px] h-12 flex-1 sm:flex-none sm:px-6 rounded-2xl bg-peacock-indigo hover:bg-peacock-indigo-dark text-white font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
 >
 <Save className="w-4 h-4" />
 <span>حفظ وتطبيق الخطة</span>
 </button>
 </div>
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
 <span className={`text-[12px] font-black px-2 py-0.5 rounded-lg border ${previewPreset.tagColor}`}>
 {previewPreset.badge}
 </span>
 </div>
 </div>

 <button
 onClick={() => setPreviewPreset(null)}
 className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Preview Content */}
 <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
 <div className="p-3 rounded-2xl bg-peacock-mist dark:bg-peacock-ink-deep/40 border border-peacock-sage dark:border-peacock-indigo-deep/60 space-y-1">
 <span className="font-black text-peacock-indigo-deep dark:text-peacock-teal-light block"> الهدف والوصف الطبي:</span>
 <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
 {previewPreset.description}
 </p>
 </div>

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
 className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors cursor-pointer"
 >
 إغلاق المعاينة
 </button>

 <button
 onClick={() => {
 handleApplyPreset(previewPreset);
 setPreviewPreset(null);
 }}
 className="px-5 py-2 rounded-xl text-xs font-black bg-peacock-indigo hover:bg-peacock-indigo-dark text-white transition-all cursor-pointer flex items-center gap-1.5"
 >
 <Zap className="w-3.5 h-3.5" />
 <span>تطبيق هذا القالب على المسودة </span>
 </button>
 </div>
 </div>
 </div>
 )}

 {/* SAVE CURRENT PLAN AS CUSTOM PRESET MODAL */}
 {showSavePresetPrompt && (
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
 <button onClick={() => setShowSavePresetPrompt(false)} className="p-1 text-slate-400 hover:text-slate-600">
 <X className="w-4 h-4" />
 </button>
 </div>

 <form onSubmit={handleSaveCurrentAsCustomPreset} className="space-y-3 text-xs">
 <div>
 <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
 اسم القالب الجديد:
 </label>
 <input
 type="text"
 required
 placeholder="مثلاً: خطة نباتية خاصة / تنشيف سريع 1400 كالوري..."
 value={newPresetName}
 onChange={(e) => setNewPresetName(e.target.value)}
 className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold outline-none focus:ring-2 focus:ring-peacock-blue"
 />
 </div>

 <div>
 <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
 التصنيف:
 </label>
 <select
 value={newPresetCategory}
 onChange={(e) => setNewPresetCategory(e.target.value as any)}
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
 value={newPresetSummary}
 onChange={(e) => setNewPresetSummary(e.target.value)}
 className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium outline-none focus:ring-2 focus:ring-peacock-blue"
 />
 </div>

 <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[12px] text-slate-500 space-y-1">
 <span>سيتم حفظ:</span>
 <div className="font-bold text-slate-700 dark:text-slate-300">
 {draft.meals.length} وجبات وبدائل • {draft.supplements?.length || 0} مكملات • {draft.checklist.length} عادات • {draft.targetCalories || 0} كالوري
 </div>
 </div>

 <div className="flex gap-2 pt-2">
 <button
 type="button"
 onClick={() => setShowSavePresetPrompt(false)}
 className="flex-1 py-2.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
 >
 إلغاء
 </button>
 <button
 type="submit"
 className="flex-1 py-2.5 rounded-xl font-black bg-peacock-indigo hover:bg-peacock-indigo-dark text-white cursor-pointer"
 >
 حفظ في مكتبتي 
 </button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* Standalone Presets Library Modal */}
 {showPresetsModal && (
 <PresetsLibraryModal
 currentDraft={draft}
 onApplyPreset={(newDraft) => setDraft(newDraft)}
 onClose={() => setShowPresetsModal(false)}
 onNotify={onNotify}
 />
 )}

 {/* BMR Calculator Modal (معادلة سمر + معادلة خلود ) */}
 {showBMRCalc && (
 <Suspense fallback={null}>
 <BMRCalculatorModal
 initialWeight={draft.startWeight || 70}
 initialHeight={draft.heightCm || 170}
 initialAge={28}
 initialGender={draft.cycleTracking?.enabled? 'female': 'male'}
 defaultMethod="samar"
 onApplyCalories={(calories, protein, carbs, fats, notes) => {
 setDraft((prev) => ({
...prev,
 targetCalories: calories,
 targetProtein: protein,
 targetCarbs: carbs,
 targetFats: fats,
...(notes? { notes: prev.notes? `${prev.notes}\n• ${notes}`: notes }: {}),
 }));
 onNotify(`تم تطبيق السعرات (${calories} ك.س) والماكروز بنجاح على الخطة `);
 setShowBMRCalc(false);
 }}
 onClose={() => setShowBMRCalc(false)}
 />
 </Suspense>
 )}

 {/* Clinical Calculator Suite Modal */}
 {showClinicalSuite && (
 <Suspense fallback={null}>
 <ClinicalCalculatorSuiteModal
 initialWeight={draft.startWeight || 80}
 initialHeight={draft.heightCm || 175}
 initialAge={28}
 onApplyCalories={(calories, protein, carbs, fats, notesInfo) => {
 setDraft((prev) => ({
...prev,
 targetCalories: calories,
 targetProtein: protein,
 targetCarbs: carbs,
 targetFats: fats,
...(notesInfo? { notes: prev.notes? `${prev.notes}\n\n${notesInfo}`: notesInfo }: {}),
 }));
 onNotify(`تم تطبيق السعرات الإكلينيكية (${calories} ك.س) والماكروز المحسوبة مباشرة `);
 setShowClinicalSuite(false);
 }}
 onClose={() => setShowClinicalSuite(false)}
 />
 </Suspense>
 )}

 {/* Doctor Onboarding Interactive Guide Modal */}
 <CoachOnboardingModal
 isOpen={showCoachOnboarding}
 onClose={() => setShowCoachOnboarding(false)}
 plan={draft}
 />

 {/* WhatsApp Share Options Modal */}
 {showShareOptionsModal && (
 <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in zoom-in-95 duration-150">
 <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 app-overlay-shadow overflow-hidden flex flex-col max-h-[92vh]">
 {/* Header */}
 <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-peacock-mist/70 dark:bg-peacock-ink-deep/40">
 <div className="flex items-center gap-2.5">
 <div className="w-10 h-10 rounded-2xl text-white flex items-center justify-center font-bold">
 <Share2 className="w-5 h-5" />
 </div>
 <div>
 <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base">
 خيارات إرسال الخطة للمتدرب 
 </h3>
 <p className="text-[12px] text-peacock-indigo-deep/80 dark:text-peacock-teal-light font-medium">
 اختر الصيغة المناسبة لتفادي مشاكل الحافظة في الموبايلات القديمة
 </p>
 </div>
 </div>

 <button
 onClick={() => setShowShareOptionsModal(false)}
 className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Content List of Options */}
 <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
 
 {/* Option 1: Readable Plan Without Code */}
 <div className="p-4 rounded-2xl bg-peacock-mist/80 dark:bg-peacock-ink-deep/30 border border-peacock-sage dark:border-peacock-indigo-deep/60 space-y-2.5">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="w-7 h-7 rounded-xl dark: text-peacock-indigo-dark dark:text-peacock-teal-light flex items-center justify-center font-bold">
 <FileText className="w-4 h-4" />
 </div>
 <span className="font-black text-peacock-ink-deep dark:text-peacock-sage text-xs sm:text-sm">
 1. إرسال الخطة الشاملة المكتوبة (بدون كود)
 </span>
 </div>
 <span className="text-[12px] font-black px-2 py-0.5 rounded-full bg-peacock-sage/70 dark:bg-peacock-ink text-peacock-indigo-deep dark:text-peacock-teal-light">
 نص عربي فقط
 </span>
 </div>

 <p className="text-[12px] text-peacock-indigo-deep/90 dark:text-peacock-teal-light leading-relaxed">
 نص الخطة بالعربي بالتفصيل (الوجبات، البدائل، السعرات، الماكروز، هدف الماء، المكملات، والأدوية) <strong>بدون كود المزامنة المشفر</strong>. يسهل قراءته على الواتساب ولا يثقل حافظة الموبايلات القديمة.
 </p>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
 <button
 onClick={() => {
 handleShareReadablePlanWhatsApp();
 setShowShareOptionsModal(false);
 }}
 className="w-full py-2.5 px-3 rounded-xl bg-peacock-indigo text-white font-black text-xs hover:bg-peacock-indigo-dark transition-all flex items-center justify-center gap-1.5 cursor-pointer"
 >
 <Send className="w-3.5 h-3.5" />
 إرسال الخطة بالواتساب 
 </button>

 <button
 onClick={handleCopyReadablePlan}
 className="w-full py-2.5 px-3 rounded-xl bg-peacock-pale dark:bg-peacock-ink/60 text-peacock-indigo-deep dark:text-peacock-sage font-bold text-xs hover:bg-peacock-sage dark:hover:bg-peacock-indigo-deep transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
 >
 <Copy className="w-3.5 h-3.5" />
 نسخ الخطة المكتوبة 
 </button>
 </div>
 </div>

 {/* Option 2: Sync Code Only */}
 <div className="p-4 rounded-2xl bg-cyan-50/80 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/60 space-y-2.5">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="w-7 h-7 rounded-xl dark: text-cyan-700 dark:text-cyan-300 flex items-center justify-center font-bold">
 <Smartphone className="w-4 h-4" />
 </div>
 <span className="font-black text-cyan-950 dark:text-cyan-200 text-xs sm:text-sm">
 2. إرسال كود تفعيل الخطة للتطبيق فقط
 </span>
 </div>
 <span className="text-[12px] font-black px-2 py-0.5 rounded-full bg-cyan-200/70 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-300">
 كود فقط
 </span>
 </div>

 <p className="text-[12px] text-cyan-900/90 dark:text-cyan-300 leading-relaxed">
 يحتوي فقط على كود التفعيل الرقمي (#START_PLAN_DATA#) لتقوم المتدربة بنسخه ولصقه مباشرة في خانة <strong>" {brandCopy.addPlanCta}"</strong> داخل التطبيق، دون أي نصوص إضافية طويلة.
 </p>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
 <button
 onClick={() => {
 handleShareSyncCodeWhatsApp();
 setShowShareOptionsModal(false);
 }}
 className="w-full py-2.5 px-3 rounded-xl bg-cyan-600 text-white font-black text-xs hover:bg-cyan-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
 >
 <Send className="w-3.5 h-3.5" />
 إرسال الكود بالواتساب 
 </button>

 <button
 onClick={handleCopySyncCode}
 className="w-full py-2.5 px-3 rounded-xl bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 font-bold text-xs hover:bg-cyan-200 dark:hover:bg-cyan-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
 >
 <Copy className="w-3.5 h-3.5" />
 نسخ كود التفعيل 
 </button>
 </div>
 </div>

 {/* Option 3: Full Combined Message */}
 <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
 <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-bold">
 <span>3. الرسالة الشاملة المدمجة (نص + كود معاً):</span>
 <span className="text-[12px] text-slate-400 font-normal">للأجهزة الحديثة</span>
 </div>

 <p className="text-[12px] text-slate-500 dark:text-slate-400">
 رسالة واحدة تجمع الخطة المكتوبة وكود المزامنة في النهاية.
 </p>

 <div className="flex gap-2 pt-0.5">
 <button
 onClick={() => {
 handleShareFullPlanWhatsApp();
 setShowShareOptionsModal(false);
 }}
 className="flex-1 py-2 px-3 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo-deep text-white font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
 >
 <Send className="w-3.5 h-3.5" />
 إرسال مدمجة
 </button>

 <button
 onClick={handleCopyFullPlan}
 className="flex-1 py-2 px-3 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
 >
 <Copy className="w-3.5 h-3.5" />
 نسخ مدمجة
 </button>
 </div>
 </div>

 {/* Option 4: Official Medical PDF Plan & Prescription */}
 <div className="p-3.5 rounded-2xl bg-peacock-mist dark:bg-peacock-ink-deep/40 border border-peacock-sage dark:border-peacock-indigo-deep/70 space-y-2">
 <div className="flex items-center justify-between text-peacock-ink dark:text-peacock-sage font-black">
 <div className="flex items-center gap-1.5">
 <FileDown className="w-4 h-4 text-peacock-indigo" />
 <span>4. تصدير روشتة ونظام غذائي PDF رسمي:</span>
 </div>
 <span className="text-[12px] font-bold text-peacock-indigo dark:text-peacock-teal">A4 للطباعة</span>
 </div>

 <p className="text-[12px] text-peacock-indigo-deep/80 dark:text-peacock-teal-light leading-relaxed">
 توليد ملف PDF جاهز بمقاس A4 رسمي مع الختم وتوزيع الوجبات والماكروز لإرساله كملف أو طباعته ورقياً.
 </p>

 <button
 type="button"
 onClick={() => {
 setShowShareOptionsModal(false);
 setShowPDFExportModal(true);
 }}
 className="w-full py-2.5 px-3 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo text-white font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
 >
 <FileDown className="w-4 h-4" />
 <span>معاينة وتصدير الـ PDF الآن</span>
 </button>
 </div>

 </div>

 {/* Footer */}
 <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
 <button
 type="button"
 onClick={() => setShowShareOptionsModal(false)}
 className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors cursor-pointer"
 >
 إغلاق
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Medication Catalog Modal */}
 <MedicationCatalogModal
 isOpen={showMedicationCatalog}
 onClose={() => setShowMedicationCatalog(false)}
 onSelectMedication={(newItem) => {
 setDraft({
 ...draft,
 supplements: [...(draft.supplements || []), newItem],
 });
 onNotify(`تمت إضافة ${newItem.name} إلى خطة المتدرب بنجاح `);
 }}
 alreadySelectedNames={(draft.supplements || []).map((s) => s.name)}
 />

 {/* Plan PDF Export Modal — lazy (jspdf/html2canvas) */}
 {showPDFExportModal && (
   <Suspense fallback={null}>
     <PlanPDFExportModal
       plan={draft}
       isOpen={showPDFExportModal}
       onClose={() => setShowPDFExportModal(false)}
       onNotify={onNotify}
     />
   </Suspense>
 )}
 </div>
 );
};
