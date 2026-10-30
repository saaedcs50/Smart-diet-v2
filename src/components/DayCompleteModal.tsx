import React from 'react';
import { PartyPopper, Share2, Flame, Droplets, Trophy } from 'lucide-react';
import { DayLog, PlanConfig } from '../types';
import { BottomSheetModal } from './BottomSheetModal';

interface DayCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PlanConfig;
  day: DayLog;
  streak: number;
  /** يفتح مسار بطاقة التقرير المرئية القائم (VisualReportCard) */
  onShare: () => void;
}

/**
 * Batch 1.3 — لحظة إنجاز اليوم: احتفال خفيف مرة واحدة عند وصول النقاط إلى 100،
 * مع دعوة لمشاركة الإنجاز. بلا صوت، وقابل للإغلاق بزر واضح.
 */
export const DayCompleteModal: React.FC<DayCompleteModalProps> = ({
  isOpen,
  onClose,
  day,
  streak,
  onShare,
}) => {
  return (
    <BottomSheetModal isOpen={isOpen} onClose={onClose} title="يوم مكتمل! 🎉">
      <div dir="rtl" className="space-y-4 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-peacock-blue/10 dark:bg-peacock-blue/20 text-peacock-indigo dark:text-peacock-teal flex items-center justify-center">
          <PartyPopper className="w-8 h-8" />
        </div>

        <p className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100">
          أحسنت! أكملت يومك بنجاح ووصلت لنقاط كاملة
        </p>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 p-3">
            <Trophy className="w-4 h-4 mx-auto text-amber-500" />
            <div className="text-base font-black text-slate-800 dark:text-slate-100 mt-1">100</div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">نقاط اليوم</div>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 p-3">
            <Flame className="w-4 h-4 mx-auto text-orange-500" />
            <div className="text-base font-black text-slate-800 dark:text-slate-100 mt-1">{streak}</div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">يوم سلسلة</div>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 p-3">
            <Droplets className="w-4 h-4 mx-auto text-sky-500" />
            <div className="text-base font-black text-slate-800 dark:text-slate-100 mt-1">{day.water || 0}</div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">مل ماء</div>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              onShare();
              onClose();
            }}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-peacock-blue to-peacock-indigo hover:from-peacock-indigo hover:to-peacock-indigo text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Share2 className="w-4 h-4" />
            <span>شارك إنجازك</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs cursor-pointer transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </BottomSheetModal>
  );
};
