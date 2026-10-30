import React from 'react';
import { Share2, Copy, X, Check, Flame, MessageCircle } from 'lucide-react';
import { DayLog, PlanConfig } from '../types';
import { generateDailyReportText, calculateDayScore, calculateStreak } from '../utils/calculations';
import { BRAND } from '../config/brand';
import { openWhatsAppShare } from '../utils/whatsapp';

interface ReportModalProps {
 plan: PlanConfig;
 day: DayLog;
 currentDate: string;
 onClose: () => void;
 onNotify: (msg: string) => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
 plan,
 day,
 currentDate,
 onClose,
 onNotify,
}) => {
 const reportText = generateDailyReportText(plan, day, currentDate);
 const score = calculateDayScore(plan, day).total;
 const streak = calculateStreak(currentDate, plan);

 const handleWhatsApp = () => {
 openWhatsAppShare(reportText);
 };

 const handleNativeShare = () => {
 if (navigator.share) {
 navigator
.share({
 title: `تقرير ${plan.clientName} - ${currentDate}`,
 text: reportText,
 })
.then(() => onNotify('تمت المشاركة بنجاح'))
.catch(() => handleWhatsApp());
 } else {
 handleWhatsApp();
 }
 };

 const handleCopy = () => {
 navigator.clipboard.writeText(reportText).then(() => {
 onNotify('تم نسخ التقرير! يمكنك لصقه في أي محادثة ');
 });
 };

 return (
 <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
 <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-5 border border-slate-200 dark:border-slate-800 app-overlay-shadow max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-150">
 {/* Header */}
 <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-xl dark: text-peacock-indigo flex items-center justify-center font-bold">
 <Share2 className="w-4 h-4" />
 </div>
 <div>
 <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
 تقرير المتابعة اليومي
 </h3>
 <p className="text-[12px] text-slate-400">جاهز للإرسال لـ {BRAND.doctorName} عبر واتساب</p>
 </div>
 </div>
 <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Motivational Banner */}
 <div className="p-3 rounded-2xl bg-peacock-mist/80 dark:bg-peacock-ink-deep/30 border border-peacock-sage dark:border-peacock-indigo-deep/80 mb-3 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="text-2xl">
 {score >= 85? '': score >= 60? '': ''}
 </span>
 <div>
 <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
 {score >= 85? 'أداء ممتاز وملتزم!': score >= 60? 'يوم جيد، استمر!': 'بداية خطوة جديدة، غداً أفضل!'}
 </span>
 <span className="text-[12px] text-slate-500 dark:text-slate-400">
 نسبة الالتزام اليوم: {score}%
 </span>
 </div>
 </div>
 {streak >= 3 && (
 <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center gap-1">
 <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
 {streak} يوم
 </span>
 )}
 </div>

 {/* Formatted Report Preview */}
 <pre className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl text-xs font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-pre-wrap leading-relaxed">
 {reportText}
 </pre>

 {/* Action Buttons */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 pt-2">
 <button
 onClick={handleWhatsApp}
 className="py-3 px-3 rounded-2xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
 >
 <MessageCircle className="w-4 h-4 fill-white" />
 إرسال واتساب
 </button>

 <button
 onClick={handleNativeShare}
 className="py-3 px-3 rounded-2xl bg-peacock-indigo hover:bg-peacock-indigo-dark text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
 >
 <Share2 className="w-4 h-4" />
 مشاركة النظام
 </button>

 <button
 onClick={handleCopy}
 className="py-3 px-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
 >
 <Copy className="w-4 h-4" />
 نسخ التقرير
 </button>
 </div>
 </div>
 </div>
 );
};
