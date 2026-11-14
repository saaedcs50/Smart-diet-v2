import React from 'react';
import { 
 Calendar, 
 ChevronLeft, 
 ChevronRight, 
 Moon, 
 Sun, 
 Settings, 
 Download,
 Flame, 
 CheckCircle2, 
 Bell, 
 FileDown,
 HelpCircle,
 Archive
} from 'lucide-react';
import { PlanConfig } from '../types';
import { BRAND } from '../config/brand';
import { BrandLogo } from './BrandLogo';
import { AccessibilityMenu } from './AccessibilityMenu';

interface NavbarProps {
 plan: PlanConfig;
 currentDate: string;
 onDateChange: (newDate: string) => void;
 isDarkMode: boolean;
 onToggleDarkMode: () => void;
 onOpenCoachPin: () => void;
 onOpenInstallGuide: () => void;
 onOpenNotifications: () => void;
 onOpenImportModal: () => void;
 onOpenOnboarding?: () => void;
 notificationsEnabled: boolean;
 streak: number;
}

export const Navbar: React.FC<NavbarProps> = ({
 plan,
 currentDate,
 onDateChange,
 isDarkMode,
 onToggleDarkMode,
 onOpenCoachPin,
 onOpenInstallGuide,
 onOpenNotifications,
 onOpenImportModal,
 onOpenOnboarding,
 notificationsEnabled,
 streak,
}) => {
 const handleShiftDate = (days: number) => {
 const d = new Date(currentDate);
 d.setDate(d.getDate() + days);
 const year = d.getFullYear();
 const month = String(d.getMonth() + 1).padStart(2, '0');
 const day = String(d.getDate()).padStart(2, '0');
 onDateChange(`${year}-${month}-${day}`);
 };

 const handleGoToday = () => {
 const d = new Date();
 const year = d.getFullYear();
 const month = String(d.getMonth() + 1).padStart(2, '0');
 const day = String(d.getDate()).padStart(2, '0');
 onDateChange(`${year}-${month}-${day}`);
 };

 const todayStr = (() => {
 const d = new Date();
 return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
 })();

 const isToday = currentDate === todayStr;

 // Format Arabic friendly date
 const formattedArabicDate = (() => {
 try {
 const parts = currentDate.split('-').map(Number);
 const d = new Date(parts[0], parts[1] - 1, parts[2]);
 return d.toLocaleDateString('ar-EG', {
 weekday: 'long',
 day: 'numeric',
 month: 'long',
 });
 } catch (e) {
 return currentDate;
 }
 })();

 return (
 <header className="sticky top-0 z-40 bg-white/95 dark:bg-[color-mix(in_srgb,var(--app-card)_95%,transparent)] backdrop-blur-md border-b border-[color-mix(in_srgb,var(--app-border)_60%,transparent)] dark:border-[color-mix(in_srgb,var(--app-border)_60%,transparent)] transition-colors">
 <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 space-y-2.5">
 {/* Top row: Brand & Primary Actions */}
 <div className="flex items-center justify-between gap-3">
 {/* User info & Brand Logo */}
 <div className="flex items-center gap-3 min-w-0">
 <BrandLogo size={40} className="shrink-0" />
 <div className="min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <h1 className="font-bold text-[var(--app-text-primary)] text-base leading-tight truncate">
 {plan.clientName || 'المتدرب'}
 </h1>
 {streak >= 1 && (
 <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[12px] font-bold rounded-full bg-[#F2C66D]/20 text-[#E0922D] dark:text-[#F2C66D] border border-[#E0922D]/30 shrink-0">
 <Flame className="w-3.5 h-3.5 fill-[#E0922D] text-[#E0922D]" />
 <span>{streak} {streak === 1 ? 'يوم' : streak === 2 ? 'يومان' : 'أيام'}</span>
 </span>
 )}
 </div>
 <p className="text-xs text-[var(--app-text-secondary)] flex items-center gap-1.5 mt-0.5">
 <span className="font-semibold text-[var(--app-secondary)]">{BRAND.shortName}</span>
 <span className="text-[var(--app-border)]">•</span>
 <span className="font-medium">إشراف {BRAND.doctorName}</span>
 </p>
 </div>
 </div>

 {/* Action Tools with comfortable touch targets */}
 <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
 {onOpenOnboarding && (
 <button
 onClick={onOpenOnboarding}
 title="دليل استخدام التطبيق"
 className="px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--app-card-muted)] hover:opacity-90 text-[var(--app-secondary)] dark:bg-[var(--app-card-muted)] dark:text-[var(--app-text-primary)] border border-[var(--app-border)] transition-all flex items-center gap-1.5 cursor-pointer"
 >
 <HelpCircle className="w-4 h-4 text-[var(--app-secondary)]" />
 <span className="hidden sm:inline">دليل الاستخدام</span>
 </button>
 )}

 <button
 onClick={onOpenImportModal}
 title="النسخ الاحتياطي واستيراد الخطة"
 className="px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold bg-[var(--app-hero)] hover:bg-[var(--app-hero-hover)] text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
 >
 <Archive className="w-4 h-4" />
 <span className="hidden sm:inline">نسخ واستيراد</span>
 </button>

 {/* Account-scoped accessibility preferences */}
 <AccessibilityMenu />

 {/* Notifications */}
 <button
 onClick={onOpenNotifications}
 title="التنبيهات والمواعيد"
 className={`relative p-2.5 rounded-xl border transition-all cursor-pointer ${
 notificationsEnabled
 ? 'bg-[var(--app-card-muted)] text-[var(--app-hero)] border-[var(--app-hero)]/40 dark:border-[var(--app-hero)]/40 hover:bg-[var(--app-border)]/40'
 : 'bg-[var(--app-bg)] dark:bg-[var(--app-bg)] text-[var(--app-text-secondary)] border-[var(--app-border)] hover:bg-[var(--app-card-muted)]'
 }`}
 >
 <Bell className="w-4 h-4" />
 {notificationsEnabled && (
 <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--app-hero)] ring-2 ring-white dark:ring-[var(--app-card)]" />
 )}
 </button>

 {/* Dark Mode */}
 <button
 onClick={onToggleDarkMode}
 title="الوضع الداكن / الفاتح"
 className="p-2.5 rounded-xl bg-[var(--app-bg)] dark:bg-[var(--app-bg)] text-[var(--app-secondary)] dark:text-[var(--app-text-primary)] hover:bg-[var(--app-card-muted)] border border-[var(--app-border)] transition-colors cursor-pointer"
 >
 {isDarkMode ? <Sun className="w-4 h-4 text-[#F2C66D]" /> : <Moon className="w-4 h-4" />}
 </button>

 {/* Discreet Settings Entrance to /coach */}
 <button
 onClick={onOpenCoachPin}
 title="الإعدادات"
 className="p-2.5 rounded-xl bg-[var(--app-bg)] dark:bg-[var(--app-bg)] text-[var(--app-secondary)] dark:text-[var(--app-text-primary)] hover:bg-[var(--app-card-muted)] border border-[var(--app-border)] transition-colors cursor-pointer"
 >
 <Settings className="w-4 h-4" />
 </button>

 {/* Install App */}
 <button
 onClick={onOpenInstallGuide}
 title="تثبيت التطبيق"
 className="hidden sm:flex p-2.5 rounded-xl bg-[var(--app-bg)] dark:bg-[var(--app-bg)] text-[var(--app-secondary)] dark:text-[var(--app-text-primary)] hover:bg-[var(--app-card-muted)] border border-[var(--app-border)] transition-colors cursor-pointer"
 >
 <Download className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Row 2: Spacious Date Navigator */}
 <div className="pt-2 border-t border-[color-mix(in_srgb,var(--app-border)_40%,transparent)] flex items-center justify-between gap-3">
 {/* Day switcher arrows & native picker */}
 <div className="flex items-center gap-1 bg-[var(--app-card-muted)] dark:bg-[var(--app-bg)] p-1 rounded-xl border border-[var(--app-border)]">
 <button
 onClick={() => handleShiftDate(-1)}
 className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[var(--app-card-muted)] text-[var(--app-text-primary)] transition-all cursor-pointer"
 title="اليوم السابق"
 >
 <ChevronRight className="w-4 h-4" />
 </button>

 <div className="relative px-2 flex items-center">
 <input
 type="date"
 value={currentDate}
 onChange={(e) => e.target.value && onDateChange(e.target.value)}
 className="bg-transparent text-[var(--app-text-primary)] text-xs font-bold outline-none cursor-pointer text-center"
 />
 </div>

 <button
 onClick={() => handleShiftDate(1)}
 className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[var(--app-card-muted)] text-[var(--app-text-primary)] transition-all cursor-pointer"
 title="اليوم التالي"
 >
 <ChevronLeft className="w-4 h-4" />
 </button>
 </div>

 {/* Date Label & Today Button */}
 <div className="flex items-center gap-2">
 <span className="hidden sm:inline text-xs font-medium text-[var(--app-text-secondary)]">
 {formattedArabicDate}
 </span>

 {!isToday ? (
 <button
 onClick={handleGoToday}
 className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--app-secondary)] hover:opacity-90 text-white transition-all flex items-center gap-1.5 cursor-pointer"
 >
 <Calendar className="w-3.5 h-3.5" />
 <span>العودة لليوم</span>
 </button>
 ) : (
 <span className="px-3 py-1 rounded-xl text-xs font-semibold text-[var(--app-secondary)] dark:text-[var(--app-text-primary)] bg-[var(--app-card-muted)] border border-[var(--app-border)] flex items-center gap-1.5">
 <CheckCircle2 className="w-3.5 h-3.5 text-[var(--app-hero)]" />
 <span>اليوم الحالي</span>
 </span>
 )}
 </div>
 </div>
 </div>
 </header>
 );
};

