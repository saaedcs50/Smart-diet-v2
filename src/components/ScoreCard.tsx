import React from 'react';
import { Flame, Snowflake, Trophy, Circle, AlertCircle, Share2, Image as ImageIcon } from 'lucide-react';
import { ScoreBreakdown, countFreezeDaysInMonth } from '../utils/calculations';
import { PlanConfig } from '../types';
import { BRAND } from '../config/brand';
import { HelpButton } from './FeatureHelpModal';

interface ScoreCardProps {
 score: ScoreBreakdown;
 streak: number;
 isFreeze: boolean;
 currentDate: string;
 plan: PlanConfig;
 onToggleFreeze: () => void;
 onOpenReportModal: () => void;
 onOpenStoryCard: () => void;
}

export const ScoreCard: React.FC<ScoreCardProps> = ({
 score,
 streak,
 isFreeze,
 currentDate,
 plan,
 onToggleFreeze,
 onOpenReportModal,
 onOpenStoryCard,
}) => {
 const freezeLimit = plan.freezeDaysPerMonth ?? 2;
 const usedFreezes = countFreezeDaysInMonth(currentDate);
 const remainingFreezes = Math.max(0, freezeLimit - usedFreezes);

 // Feedback based on score
 let feedbackText = 'سجل التزامك بالوجبات والعادات المقررة اليوم.';
 let feedbackColor = 'text-[var(--app-text-secondary)]';
 let badgeEmoji = '';

 if (isFreeze) {
 feedbackText = 'يوم راحة مسجل (Free Day).';
 feedbackColor = 'text-[#0284C7] dark:text-[#38BDF8]';
 badgeEmoji = '';
 } else if (score.total >= 90) {
 feedbackText = 'التزام كامل بالخطة اليومية.';
 feedbackColor = 'text-[#4D52B4] dark:text-[#70D6C5]';
 badgeEmoji = '';
 } else if (score.total >= 75) {
 feedbackText = 'مستوى الالتزام مرتفع.';
 feedbackColor = 'text-[#4D52B4] dark:text-[#70D6C5]';
 badgeEmoji = '';
 } else if (score.total >= 50) {
 feedbackText = 'مستوى التزام جيد.';
 feedbackColor = 'text-[#E0922D] dark:text-[#F2C66D]';
 badgeEmoji = '';
 } else if (score.total > 0) {
 feedbackText = 'جاري استكمال تسجيل الوجبات والماء.';
 feedbackColor = 'text-[var(--app-hero)] dark:text-[var(--app-hero-hover)]';
 badgeEmoji = '';
 }

 return (
 <div className="bg-[var(--app-card)] border border-[var(--app-border)]/80 rounded-3xl p-5 sm:p-6 transition-colors space-y-5">
 {/* Top Banner with Score and Streak */}
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
 {/* Circular Score display & Feedback */}
 <div className="flex items-center gap-4">
 <div className="relative w-18 h-18 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
 <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
 <path
 className="text-[var(--app-card-muted)]"
 strokeWidth="3.5"
 stroke="currentColor"
 fill="none"
 d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
 />
 <path
 className={`transition-all duration-150 ${
 isFreeze
? 'text-[#0284C7]'
: score.total >= 75
? 'text-[#4D52B4]'
: score.total >= 50
? 'text-[#E0922D]'
: 'text-[var(--app-hero)]'
 }`}
 strokeDasharray={`${score.total}, 100`}
 strokeWidth="3.5"
 strokeLinecap="round"
 stroke="currentColor"
 fill="none"
 d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
 />
 </svg>
 <div className="absolute flex flex-col items-center">
 <span className="text-lg sm:text-xl font-black text-[var(--app-text-primary)] leading-none">
 {score.total}%
 </span>
 <span className="text-[12px] text-[var(--app-text-secondary)] font-bold mt-0.5">الالتزام</span>
 </div>
 </div>

 <div>
 <div className="flex items-center gap-1.5">
<h2 className="font-bold text-[var(--app-text-primary)] text-sm sm:text-base">
 معدل الالتزام اليومي
 </h2>
 <HelpButton featureId="scoreCard" size="sm" />
 </div>
 <p className={`text-xs sm:text-sm font-semibold mt-0.5 ${feedbackColor}`}>
 {feedbackText}
 </p>
 </div>
 </div>

 {/* Streak & Freeze Controls */}
 <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
 {streak >= 1 && (
 <div className="px-3 py-1.5 rounded-2xl bg-[#E0922D]/10 dark:bg-[#E0922D]/20 border border-[#E0922D]/30 dark:border-[#E0922D]/40 text-[#E0922D] dark:text-[#F2C66D] text-xs font-bold flex items-center gap-1.5">
 <Flame className="w-4 h-4 fill-[#E0922D] text-[#E0922D] dark:fill-[#F2C66D] dark:text-[#F2C66D]" />
 <span>{streak} {streak === 1? 'يوم': streak === 2? 'يومان': 'أيام'} متتالية</span>
 </div>
 )}

 <button
 onClick={onToggleFreeze}
 className={`px-3 py-1.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
 isFreeze
? 'bg-[#0284C7] text-white'
: 'bg-[var(--app-card-muted)] text-[var(--app-text-primary)] hover:bg-[var(--app-card-muted)] border border-[var(--app-border)]/70'
 }`}
 >
 <Snowflake className="w-3.5 h-3.5" />
 <span>{isFreeze? 'إلغاء يوم الراحة': `يوم راحة (${remainingFreezes} متبقي)`}</span>
 </button>
 </div>
 </div>

 {/* Breakdown mini-progress */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 border-t border-[var(--app-border)]/50">
 <div className="bg-[var(--app-card-muted)] p-3 rounded-2xl text-center border border-[var(--app-border)]/40">
 <span className="text-[12px] text-[var(--app-text-secondary)] font-medium block mb-1"> وجبات الخطة</span>
 <span className="text-xs sm:text-sm font-bold text-[var(--app-text-primary)]">
 {score.meals} / {plan.scoreWeights.meals}
 </span>
 </div>

 <div className="bg-[var(--app-card-muted)] p-3 rounded-2xl text-center border border-[var(--app-border)]/40">
 <span className="text-[12px] text-[var(--app-text-secondary)] font-medium block mb-1"> شرب الماء</span>
 <span className="text-xs sm:text-sm font-bold text-[var(--app-text-primary)]">
 {score.water} / {plan.scoreWeights.water}
 </span>
 </div>

 <div className="bg-[var(--app-card-muted)] p-3 rounded-2xl text-center border border-[var(--app-border)]/40">
 <span className="text-[12px] text-[var(--app-text-secondary)] font-medium block mb-1"> العادات والمكملات</span>
 <span className="text-xs sm:text-sm font-bold text-[var(--app-text-primary)]">
 {score.checklist} / {plan.scoreWeights.checklist}
 </span>
 </div>

 <div className="bg-[var(--app-card-muted)] p-3 rounded-2xl text-center border border-[var(--app-border)]/40">
 <span className="text-[12px] text-[var(--app-text-secondary)] font-medium block mb-1"> النوم والنشاط</span>
 <span className="text-xs sm:text-sm font-bold text-[var(--app-text-primary)]">
 {score.sleep} / {plan.scoreWeights.sleep}
 </span>
 </div>
 </div>

 {/* Share Actions */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
 <button
 onClick={onOpenReportModal}
 className="w-full py-3 min-h-[44px] px-4 rounded-2xl bg-[var(--app-hero)] hover:bg-[#C2135B] text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
 >
 <Share2 className="w-4 h-4" />
 <span>إرسال تقرير اليوم لـ {BRAND.doctorName} (واتساب) </span>
 </button>

 <button
 onClick={onOpenStoryCard}
 className="w-full py-3 px-4 rounded-2xl bg-[var(--app-card-muted)] hover:bg-[var(--app-card-muted)] text-[var(--app-text-primary)] font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 border border-[var(--app-border)]/70 cursor-pointer"
 >
 <ImageIcon className="w-4 h-4 text-[var(--app-hero)] dark:text-[var(--app-hero-hover)]" />
 <span>تصدير بطاقة تقرير (صورة) </span>
 </button>
 </div>
 </div>
 );
};

