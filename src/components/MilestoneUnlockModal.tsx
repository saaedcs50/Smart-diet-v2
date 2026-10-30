import React from 'react';
import { Share2 } from 'lucide-react';
import { MilestoneDefinition } from '../utils/milestones';
import { BottomSheetModal } from './BottomSheetModal';

interface MilestoneUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestone: MilestoneDefinition | null;
  /** يفتح بطاقة الإنجاز كصورة (VisualReportCard بمتغير milestone) */
  onShare: () => void;
}

/**
 * Batch 2.3 — احتفال فتح معلم جديد: نفس قشرة احتفال الدفعة ١.٣
 * (BottomSheetModal) وبنفس الروح: خفيف، مرة واحدة، بلا صوت.
 */
export const MilestoneUnlockModal: React.FC<MilestoneUnlockModalProps> = ({
  isOpen,
  onClose,
  milestone,
  onShare,
}) => {
  if (!milestone) return null;
  return (
    <BottomSheetModal isOpen={isOpen} onClose={onClose} title="إنجاز جديد اتفتح! 🏆">
      <div dir="rtl" className="space-y-4 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-3xl">
          {milestone.icon}
        </div>
        <p className="text-base font-black text-slate-800 dark:text-slate-100">{milestone.label}</p>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{milestone.description}</p>
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              onClose();
              onShare();
            }}
            className="w-full py-3 rounded-2xl bg-peacock-blue hover:bg-peacock-indigo text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            شارك إنجازك كصورة
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-sm cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </BottomSheetModal>
  );
};
