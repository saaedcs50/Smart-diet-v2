import React, { useState } from 'react';
import { Droplets, Plus, RotateCcw, Sparkles, Check, GlassWater } from 'lucide-react';
import { DayLog, PlanConfig } from '../types';
import { calculateEffectiveWaterGoal } from '../utils/calculations';
import { HelpButton } from './FeatureHelpModal';

interface WaterTrackerProps {
  plan: PlanConfig;
  day: DayLog;
  onUpdateDay: (updated: DayLog) => void;
}

export const WaterTracker: React.FC<WaterTrackerProps> = ({ plan, day, onUpdateDay }) => {
  const [customMl, setCustomMl] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const goal = calculateEffectiveWaterGoal(plan, day);
  const current = day.water || 0;
  const percentage = Math.min(100, Math.round((current / goal) * 100));

  // Visual cups representation (each cup = 250ml)
  const cupSize = 250;
  const totalCups = Math.max(6, Math.min(14, Math.ceil(goal / cupSize)));
  const filledCups = Math.min(totalCups, Math.floor(current / cupSize));

  const handleAddWater = (amount: number) => {
    onUpdateDay({
      ...day,
      water: Math.max(0, current + amount),
      waterLogs: (day.waterLogs || 0) + (amount > 0 ? 1 : 0),
    });
  };

  const handleCupClick = (cupIndex: number) => {
    // If clicking cup index 2 (the 3rd cup), target amount is (cupIndex + 1) * cupSize
    const targetAmount = (cupIndex + 1) * cupSize;
    if (current >= targetAmount) {
      // User tapped an already filled cup -> toggle it off by 1 cup
      handleAddWater(-cupSize);
    } else {
      // Fill up to this cup
      onUpdateDay({
        ...day,
        water: targetAmount,
        waterLogs: (day.waterLogs || 0) + 1,
      });
    }
  };

  const handleReset = () => {
    onUpdateDay({
      ...day,
      water: 0,
      waterLogs: 0,
    });
    setConfirmReset(false);
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customMl, 10);
    if (!isNaN(val) && val > 0) {
      handleAddWater(val);
      setCustomMl('');
      setShowCustom(false);
    }
  };

  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-sm transition-all space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
            <Droplets className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                متابع شرب الماء الذكي
              </h3>
              <HelpButton featureId="waterTracker" size="sm" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              الهدف: {goal} مل ({Math.round(goal / 250)} كوب تقريباً)
            </p>
          </div>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowCustom(!showCustom)}
            className="text-xs font-bold px-2.5 py-1.5 rounded-xl text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors cursor-pointer"
          >
            {showCustom ? 'إلغاء' : '+ كمية مخصصة'}
          </button>
          {current > 0 && !confirmReset && (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="إعادة ضبط العداد"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {confirmReset && (
            <div className="flex items-center gap-1 animate-in fade-in">
              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-1 rounded-xl bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
              >
                تأكيد
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-1.5 py-1 rounded-xl text-slate-500 text-[11px] cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modern Wave Fluid Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs font-black">
          <span className="text-slate-800 dark:text-slate-200">
            {current} مل <span className="font-normal text-slate-400">/ {goal} مل</span>
          </span>
          <span className="text-sky-600 dark:text-sky-400">
            {percentage}% {percentage >= 100 && '(اكتمل الهدف)'}
          </span>
        </div>

        <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200/60 dark:border-slate-700/60">
          <div
            className="h-full bg-gradient-to-r from-sky-400 to-sky-500 rounded-full transition-all duration-300 shadow-xs"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Noom-style Interactive Cups Grid (Tap to toggle cup) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 dark:text-slate-400 px-0.5">
          <span>سجل الأكواب بنقرة سريعة (كوب = 250 مل):</span>
          <span>{filledCups} / {totalCups} أكواب</span>
        </div>

        <div className="flex items-center justify-between gap-1 sm:gap-1.5 py-2 px-3 rounded-2xl bg-sky-50/40 dark:bg-sky-950/20 border border-sky-100/80 dark:border-sky-900/40 overflow-x-auto">
          {Array.from({ length: totalCups }).map((_, idx) => {
            const isFilled = idx < filledCups;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleCupClick(idx)}
                className={`relative p-2 rounded-xl transition-all duration-200 cursor-pointer flex flex-col items-center gap-1 group ${
                  isFilled
                    ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/25 scale-105'
                    : 'bg-white dark:bg-slate-800 text-slate-300 dark:text-slate-600 hover:text-sky-400 hover:border-sky-300 border border-slate-200/80 dark:border-slate-700'
                }`}
                title={`كوب رقم ${idx + 1} (250 مل)`}
              >
                <Droplets className={`w-4 h-4 transition-transform ${isFilled ? 'fill-white' : 'group-hover:scale-110'}`} />
                <span className="text-[10px] font-bold leading-none">
                  {idx + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* One-tap Quick Add Buttons (Noom / Lifesum Style) */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <button
          type="button"
          onClick={() => handleAddWater(250)}
          className="py-2.5 px-2 rounded-2xl bg-sky-50 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-900/40 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/80 font-bold text-xs transition-all flex flex-col items-center gap-0.5 cursor-pointer shadow-xs hover:scale-[1.02]"
        >
          <span className="text-xs font-black">+250 مل</span>
          <span className="text-[11px] text-sky-600/70 dark:text-sky-300/70 font-medium">كوب ماء</span>
        </button>

        <button
          type="button"
          onClick={() => handleAddWater(500)}
          className="py-2.5 px-2 rounded-2xl bg-gradient-to-b from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-black text-xs transition-all flex flex-col items-center gap-0.5 cursor-pointer shadow-md shadow-sky-500/20 hover:scale-[1.02]"
        >
          <span className="text-xs font-black">+500 مل</span>
          <span className="text-[11px] text-sky-100 font-medium">عبوة ماء كاملة</span>
        </button>

        <button
          type="button"
          onClick={() => handleAddWater(1000)}
          className="py-2.5 px-2 rounded-2xl bg-sky-50 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-900/40 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/80 font-bold text-xs transition-all flex flex-col items-center gap-0.5 cursor-pointer shadow-xs hover:scale-[1.02]"
        >
          <span className="text-xs font-black">+1000 مل</span>
          <span className="text-[11px] text-sky-600/70 dark:text-sky-300/70 font-medium">لتر ماء</span>
        </button>
      </div>

      {/* Custom Input Form */}
      {showCustom && (
        <form onSubmit={handleAddCustom} className="flex gap-2 pt-1 animate-in fade-in">
          <input
            type="number"
            value={customMl}
            onChange={(e) => setCustomMl(e.target.value)}
            placeholder="أدخل الكمية بالمللتر..."
            autoFocus
            className="flex-1 text-xs font-bold p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            type="submit"
            className="px-5 py-3 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-black text-xs transition-colors cursor-pointer shadow-xs"
          >
            إضافة
          </button>
        </form>
      )}
    </div>
  );
};
