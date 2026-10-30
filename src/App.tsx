import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { ActiveTab, DayLog, PlanConfig, PhotoRecord } from './types';
import { 
  getTodayDateString, 
  loadDayLog, 
  loadPlanFromStorage, 
  saveDayLog, 
  savePlanToStorage,
  isSectionVisible
} from './utils/storage';
import { calculateDayScore, calculateStreak } from './utils/calculations';
import { getAllPhotosFromDB } from './utils/indexedDB';
import { 
  loadNotificationSettings, 
  saveNotificationSettings, 
  registerServiceWorker, 
  checkAndTriggerReminders, 
  syncMealRemindersWithPlan, 
  getMissedRemindersOnBoot,
  NotificationSettings 
} from './utils/notifications';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { TodayTab } from './components/TodayTab';
import { BodyTab } from './components/BodyTab';
import { PinModal } from './components/PinModal';
import { unlockCoachSession, logoutCoachSession, isCoachSessionUnlocked, setCoachCustomPin, markCoachSessionUnlocked } from './utils/coachAuth';
import {
  createCoachServerSession,
  saveCoachServerToken,
  deleteCoachServerSession,
} from './utils/coachServer';
import { StorageKeys } from './utils/storageKeys';
import {
  loadSeasonalActivation,
  saveSeasonalActivation,
  reconcileSeasonalActivation,
} from './utils/seasonalTemplate';
import { FeatureHelpProvider } from './components/FeatureHelpModal';
import { isPlatformEnabled } from './platform/platformMode';

// High-impact Code-Splitting via React.lazy for heavy components & modals
const ReportsTab = lazy(() => import('./components/ReportsTab').then(m => ({ default: m.ReportsTab })));
const CoachModal = lazy(() => import('./components/CoachModal').then(m => ({ default: m.CoachModal })));
const ImportModal = lazy(() => import('./components/ImportModal').then(m => ({ default: m.ImportModal })));
const ReportModal = lazy(() => import('./components/ReportModal').then(m => ({ default: m.ReportModal })));
const PhotoCompareModal = lazy(() => import('./components/PhotoCompareModal').then(m => ({ default: m.PhotoCompareModal })));
const InstallGuideModal = lazy(() => import('./components/InstallGuideModal').then(m => ({ default: m.InstallGuideModal })));
const VisualReportCard = lazy(() => import('./components/VisualReportCard').then(m => ({ default: m.VisualReportCard })));
const NotificationSettingsModal = lazy(() => import('./components/NotificationSettingsModal').then(m => ({ default: m.NotificationSettingsModal })));
const OnboardingModal = lazy(() => import('./components/OnboardingModal').then(m => ({ default: m.OnboardingModal })));
const PrototypeApp = lazy(() => import('./prototype/PrototypeApp').then(m => ({ default: m.PrototypeApp })));
const PlatformApp = lazy(() => import('./platform/PlatformApp'));

const ModalFallback: React.FC = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs">
    <div className="p-4 rounded-2xl bg-[var(--app-card)] border border-[var(--app-border)] app-overlay-shadow flex items-center gap-3">
      <div className="w-5 h-5 border-2 border-[var(--app-hero)] border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-bold text-[var(--app-text-primary)]">جاري التحميل...</span>
    </div>
  </div>
);

const TabFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center p-12 gap-3 text-[var(--app-text-secondary)]">
    <div className="w-7 h-7 border-3 border-[var(--app-hero)] border-t-transparent rounded-full animate-spin" />
    <span className="text-xs font-bold">جاري تحميل البيانات والرسوم البيانية...</span>
  </div>
);

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [currentDate, setCurrentDate] = useState<string>(getTodayDateString);
  const [plan, setPlan] = useState<PlanConfig>(loadPlanFromStorage);
  const [day, setDay] = useState<DayLog>(() => loadDayLog(getTodayDateString()));
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => {
    // Batch 3.3: مصالحة القالب الموسمي لحظة التحميل — تطبيق القيم الليلية أثناء
    // الموسم، واستعادة إعدادات الماء السابقة ومسح السجل تلقائيًا عند انتهائه
    const initial = loadNotificationSettings();
    const activation = loadSeasonalActivation();
    if (!activation) return initial;
    const result = reconcileSeasonalActivation(initial, activation, getTodayDateString());
    if (result.cleared) saveSeasonalActivation(null);
    if (result.changed) saveNotificationSettings(result.settings);
    return result.settings;
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(StorageKeys.darkMode());
    if (saved !== null) {
      return saved === 'true';
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [showImportModal, setShowImportModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showStoryCard, setShowStoryCard] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [comparePhotos, setComparePhotos] = useState<PhotoRecord[]>([]);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    return localStorage.getItem(StorageKeys.onboardingSeen()) !== 'true';
  });

  // Coach session security state
  const [coachSessionUnlocked, setCoachSessionUnlocked] = useState<boolean>(isCoachSessionUnlocked);

  // Sync route / path
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const handleUnlockCoachSession = async (enteredPin: string): Promise<boolean | string> => {
    const trimmed = String(enteredPin || '').trim();
    if (!trimmed) {
      return 'يرجى إدخال رمز PIN للدخول.';
    }

    // 1) الخادم أولًا (النموذج الموثق): نجاحه يحدّث الهاش المحلي للفتح الأوفلاين لاحقًا
    const server = await createCoachServerSession(trimmed);
    if (server.status === 'ok') {
      saveCoachServerToken(server.token);
      await setCoachCustomPin(trimmed);
      markCoachSessionUnlocked();
      setCoachSessionUnlocked(true);
      return true;
    }
    if (server.status === 'rejected' || server.status === 'locked') {
      // الخادم ردّ صراحة — لا التفاف عبر الفتح المحلي (يحمي تغيير الرمز من الاستضافة)
      return server.error;
    }

    // 2) لا خادم متاح (استضافة ثابتة/أوفلاين): الفتح المحلي بالهاش المخزَّن
    const res = await unlockCoachSession(trimmed);
    if (res.ok === true) {
      setCoachSessionUnlocked(true);
      return true;
    }
    return res.error;
  };

  const handleLogoutCoachSession = () => {
    void deleteCoachServerSession();
    logoutCoachSession();
    setCoachSessionUnlocked(false);
  };

  // Keep dark mode class in sync on <html>
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(StorageKeys.darkMode(), 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(StorageKeys.darkMode(), 'false');
    }
  }, [isDarkMode]);

  // Toast notification helper
  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Register PWA service worker on boot
  useEffect(() => {
    registerServiceWorker().catch(() => {});
  }, []);

  // Sync meal reminder times if plan changes
  useEffect(() => {
    if (plan.meals && notificationSettings.mealReminders?.meals) {
      const updated = syncMealRemindersWithPlan(notificationSettings, plan.meals);
      if (JSON.stringify(updated) !== JSON.stringify(notificationSettings)) {
        setNotificationSettings(updated);
        saveNotificationSettings(updated);
      }
    }
  }, [plan.meals]);

  // In-app check for notifications interval & catch missed notifications on boot
  useEffect(() => {
    const runChecks = () => {
      const currentDayLog = loadDayLog(getTodayDateString());
      checkAndTriggerReminders(notificationSettings, plan, currentDayLog);
    };

    runChecks();
    const missed = getMissedRemindersOnBoot(notificationSettings, plan);
    if (missed.length > 0) {
      // Catch up notification quietly handled
    }

    const interval = setInterval(runChecks, 60 * 1000);
    return () => clearInterval(interval);
  }, [notificationSettings, plan]);

  // Load day log when date changes
  useEffect(() => {
    const loaded = loadDayLog(currentDate);
    setDay(loaded);
  }, [currentDate]);

  // Guard tab selection if coach hid tabs
  useEffect(() => {
    if (activeTab === 'body' && !isSectionVisible(plan, 'bodyTab')) {
      setActiveTab('today');
    } else if (activeTab === 'reports' && !isSectionVisible(plan, 'reportsTab')) {
      setActiveTab('today');
    }
  }, [plan, activeTab]);

  const handleUpdateDay = (updated: DayLog) => {
    setDay(updated);
    saveDayLog(currentDate, updated);
  };

  const handleSavePlan = (newPlan: PlanConfig) => {
    setPlan(newPlan);
    savePlanToStorage(newPlan);
    showNotification('تم حفظ الخطة بنجاح');
  };

  const handleSaveNotifications = (newSettings: NotificationSettings) => {
    setNotificationSettings(newSettings);
    saveNotificationSettings(newSettings);
    showNotification('تم تحديث إعدادات التنبيهات');
  };

  const handleImportPlanData = (imported: Partial<PlanConfig>) => {
    const updatedPlan: PlanConfig = {
      ...plan,
      ...imported,
      meals: imported.meals || plan.meals,
      checklist: imported.checklist || plan.checklist,
      supplements: imported.supplements || plan.supplements,
      tips: imported.tips || plan.tips,
      scoreWeights: imported.scoreWeights || plan.scoreWeights,
    };
    handleSavePlan(updatedPlan);
  };

  const handleFullBackupRestored = () => {
    const freshPlan = loadPlanFromStorage();
    setPlan(freshPlan);
    const freshDay = loadDayLog(currentDate);
    setDay(freshDay);
    const freshNotifs = loadNotificationSettings();
    setNotificationSettings(freshNotifs);
    showNotification('تم استرجاع النسخة الاحتياطية وتحديث السجلات بنجاح ✅');
  };

  const handleToggleFreeze = () => {
    const nextState = !day.isFreeze;
    handleUpdateDay({ ...day, isFreeze: nextState });
    showNotification(nextState ? 'تم تفعيل يوم الراحة (Free Day) بنجاح 🏖️' : 'تم استئناف الالتزام بالخطة اليومية 💪');
  };

  const handleOpenComparePhotos = async () => {
    const photos = await getAllPhotosFromDB();
    if (photos.length < 2) {
      showNotification('يرجى التقاط أو رفع صورتين على الأقل للبدء في المقارنة 📸');
      return;
    }
    setComparePhotos(photos);
    setShowCompareModal(true);
  };

  const score = useMemo(() => calculateDayScore(plan, day), [plan, day]);
  const streak = useMemo(() => calculateStreak(currentDate, plan), [currentDate, plan, day]);

  const handleCloseOnboarding = () => {
    localStorage.setItem(StorageKeys.onboardingSeen(), 'true');
    setShowOnboarding(false);
  };

  // النموذج الثابت للمنصة — مسار عرض منفصل ببيانات وهمية، لا يمس وضع
  // العيادة الواحدة ولا يقرأ أي بيانات حقيقية.
  if (currentPath.startsWith('/prototype')) {
    return (
      <Suspense fallback={<TabFallback />}>
        <PrototypeApp />
      </Suspense>
    );
  }

  // واجهة المنصة الحقيقية — تعمل فقط مع VITE_PLATFORM_ENABLED=true.
  // بلا المتغير يسقط المسار إلى التطبيق العادي (لا وجود للمنصة أصلًا)،
  // ووضع العيادة الواحدة بالـ PIN يبقى الافتراضي بلا أي تغيير.
  if (currentPath.startsWith('/platform') && isPlatformEnabled()) {
    return (
      <Suspense fallback={<TabFallback />}>
        <PlatformApp />
      </Suspense>
    );
  }

  if (currentPath.startsWith('/coach')) {
    return (
      <FeatureHelpProvider>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors selection:bg-peacock-blue selection:text-white font-sans antialiased">
          {toastMessage && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 dark:bg-slate-100/95 text-white dark:text-slate-900 text-xs font-bold px-4 py-2.5 rounded-2xl app-overlay-shadow backdrop-blur-md animate-in slide-in-from-top duration-200 text-center max-w-[90%] border border-slate-700 dark:border-slate-300">
              {toastMessage}
            </div>
          )}

          <Suspense fallback={<ModalFallback />}>
            <CoachModal
              plan={plan}
              coachSessionUnlocked={coachSessionUnlocked}
              onSavePlan={handleSavePlan}
              onClose={() => navigateTo('/')}
              onNotify={showNotification}
              isPageMode={true}
              onNavigateClient={() => navigateTo('/')}
              onLogoutCoach={handleLogoutCoachSession}
              onUnlockSession={handleUnlockCoachSession}
            />
          </Suspense>
        </div>
      </FeatureHelpProvider>
    );
  }

  return (
    <FeatureHelpProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors selection:bg-peacock-blue selection:text-white font-sans antialiased pb-20">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 dark:bg-slate-100/95 text-white dark:text-slate-900 text-xs font-bold px-4 py-2.5 rounded-2xl app-overlay-shadow backdrop-blur-md animate-in slide-in-from-top duration-200 text-center max-w-[90%] border border-slate-700 dark:border-slate-300">
            {toastMessage}
          </div>
        )}

        {/* Main Top Header */}
        <Navbar
          plan={plan}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          onOpenCoachPin={() => navigateTo('/coach')}
          onOpenInstallGuide={() => setShowInstallGuide(true)}
          onOpenNotifications={() => setShowNotificationsModal(true)}
          onOpenImportModal={() => setShowImportModal(true)}
          onOpenOnboarding={() => setShowOnboarding(true)}
          notificationsEnabled={notificationSettings.enabled}
          streak={streak}
        />

        {/* Main Content Area */}
        <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 pb-24">
          {activeTab === 'today' && (
            <TodayTab
              plan={plan}
              day={day}
              currentDate={currentDate}
              score={score}
              streak={streak}
              onUpdateDay={handleUpdateDay}
              onUpdatePlan={(updater) => {
                const updated = typeof updater === 'function' ? updater(plan) : updater;
                handleSavePlan(updated);
              }}
              onNotify={showNotification}
              onOpenReportModal={() => setShowReportModal(true)}
              onOpenStoryCard={() => setShowStoryCard(true)}
              onOpenImportModal={() => setShowImportModal(true)}
              onOpenNotifications={() => setShowNotificationsModal(true)}
              onToggleFreeze={handleToggleFreeze}
              onDateChange={setCurrentDate}
            />
          )}

          {activeTab === 'body' && (
            <BodyTab
              plan={plan}
              day={day}
              currentDate={currentDate}
              onUpdateDay={handleUpdateDay}
              onUpdatePlan={(updater) => {
                const updated = typeof updater === 'function' ? updater(plan) : updater;
                handleSavePlan(updated);
              }}
              onOpenComparePhotos={handleOpenComparePhotos}
              onNotify={showNotification}
            />
          )}

          {activeTab === 'reports' && (
            <Suspense fallback={<TabFallback />}>
              <ReportsTab
                plan={plan}
                currentDate={currentDate}
                isDarkMode={isDarkMode}
                onNotify={showNotification}
              />
            </Suspense>
          )}
        </main>

        {/* Bottom Tabs Navigation */}
        <BottomNav plan={plan} activeTab={activeTab} onChangeTab={setActiveTab} />

        {/* Modals with Suspense */}
        {showImportModal && (
          <Suspense fallback={<ModalFallback />}>
            <ImportModal
              onImportPlan={handleImportPlanData}
              onClose={() => setShowImportModal(false)}
              onNotify={showNotification}
              onFullBackupRestored={handleFullBackupRestored}
            />
          </Suspense>
        )}

        {showReportModal && (
          <Suspense fallback={<ModalFallback />}>
            <ReportModal
              plan={plan}
              day={day}
              currentDate={currentDate}
              onClose={() => setShowReportModal(false)}
              onNotify={showNotification}
            />
          </Suspense>
        )}

        {showStoryCard && (
          <Suspense fallback={<ModalFallback />}>
            <VisualReportCard
              plan={plan}
              day={day}
              currentDate={currentDate}
              onClose={() => setShowStoryCard(false)}
              onNotify={showNotification}
            />
          </Suspense>
        )}

        {showCompareModal && (
          <Suspense fallback={<ModalFallback />}>
            <PhotoCompareModal
              photos={comparePhotos}
              onClose={() => setShowCompareModal(false)}
            />
          </Suspense>
        )}

        {showInstallGuide && (
          <Suspense fallback={<ModalFallback />}>
            <InstallGuideModal onClose={() => setShowInstallGuide(false)} />
          </Suspense>
        )}

        {showNotificationsModal && (
          <Suspense fallback={<ModalFallback />}>
            <NotificationSettingsModal
              isOpen={showNotificationsModal}
              onClose={() => setShowNotificationsModal(false)}
              plan={plan}
              settings={notificationSettings}
              onSave={handleSaveNotifications}
            />
          </Suspense>
        )}

        {/* Onboarding Flow Modal */}
        {showOnboarding && (
          <Suspense fallback={<ModalFallback />}>
            <OnboardingModal
              isOpen={showOnboarding}
              onClose={handleCloseOnboarding}
              plan={plan}
            />
          </Suspense>
        )}
      </div>
    </FeatureHelpProvider>
  );
}
