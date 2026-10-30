import React, { useState, useEffect } from 'react';
import { brandCopy } from '../config/brand';
import { BrandLogo } from './BrandLogo';
import { BottomSheetModal } from './BottomSheetModal';
import { COACH_LOCAL_ONLY, getLockoutRemainingSeconds, hasCoachPin, setupCoachPin } from '../utils/coachAuth';
import { createCoachServerSession, saveCoachServerToken } from '../utils/coachServer';
import { Lock, Timer, Loader2, KeyRound } from 'lucide-react';

interface PinModalProps {
  onSuccess: (pin: string) => void | boolean | Promise<void | boolean | string>;
  onClose: () => void;
}

export const PinModal: React.FC<PinModalProps> = ({ onSuccess, onClose }) => {
  const [enteredPin, setEnteredPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  // إعداد أول مرة: لا يوجد رمز مُعدّ على هذا الجهاز بعد
  const [needsSetup] = useState<boolean>(() => !hasCoachPin());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(() => getLockoutRemainingSeconds());

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      const remaining = getLockoutRemainingSeconds();
      setLockoutSeconds(remaining);
      if (remaining <= 0) {
        setError(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;
    const trimmed = enteredPin.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      if (needsSetup) {
        // لو هناك خادم لهذه النسخة، الرمز المُنشأ يجب أن يطابق رمز الخادم (COACH_PIN)
        const server = await createCoachServerSession(trimmed);
        if (server.status === 'rejected') {
          setError('هذا الرمز لا يطابق رمز الخادم المُعدّ لهذه النسخة. استخدم الرمز الذي زوّدك به مسؤول النسخة.');
          setEnteredPin('');
          setConfirmPin('');
          return;
        }
        if (server.status === 'locked') {
          setError(server.error);
          return;
        }
        if (server.status === 'ok') {
          saveCoachServerToken(server.token);
        }
        // تعذّر الوصول للخادم أثناء الإعداد الأول: لا يُنشأ رمز محلي إلا في
        // وضع الاستضافة الثابتة (VITE_COACH_LOCAL_ONLY=true) — وإلا لا يُحفظ شيء
        if (server.status === 'unreachable' && !COACH_LOCAL_ONLY) {
          setError('تعذّر التحقق من خادم العيادة — لم يُحفظ أي رمز محلي. تحقق من الاتصال وإعداد الخادم ثم حاول مرة أخرى.');
          setEnteredPin('');
          setConfirmPin('');
          return;
        }
        const setup = await setupCoachPin(trimmed, confirmPin.trim());
        if (setup.ok === false) {
          setError(setup.error);
          return;
        }
      }
      const result = await onSuccess(trimmed);
      if (result === false) {
        setError(brandCopy.pinWrong);
        setEnteredPin('');
      } else if (typeof result === 'string' && result) {
        setError(result);
        setEnteredPin('');
      }
      const remaining = getLockoutRemainingSeconds();
      if (remaining > 0) {
        setLockoutSeconds(remaining);
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : brandCopy.pinWrong);
      setEnteredPin('');
    } finally {
      setSubmitting(false);
    }
  };

  const isLocked = lockoutSeconds > 0;
  const mins = Math.floor(lockoutSeconds / 60);
  const secs = lockoutSeconds % 60;
  const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return (
    <BottomSheetModal
      isOpen={true}
      onClose={onClose}
      maxWidth="max-w-sm"
      icon={<BrandLogo size={32} rounded="rounded-xl" />}
      title={brandCopy.coachPanelNamed}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1 text-right dir-rtl">
        <p className="text-xs text-[var(--app-text-secondary)] text-center font-medium">
          {needsSetup
            ? 'أول استخدام على هذا الجهاز: أنشئ رمز PIN خاصًا بك (5 أرقام على الأقل) لحماية لوحة الأخصائي'
            : 'أدخل الرمز السري (PIN) للدخول وتعديل الخطة الغذائية والأهداف'}
        </p>

        {isLocked ? (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5 font-bold text-sm">
              <Timer className="w-5 h-5 animate-pulse" />
              <span>تم إيقاف المحاولات مؤقتًا</span>
            </div>
            <p className="text-xs font-medium leading-relaxed">
              يرجى الانتظار لحماية البيانات: <span className="font-mono font-bold text-sm tracking-wider text-amber-700 dark:text-amber-300">{timeFormatted}</span>
            </p>
          </div>
        ) : (
          <div>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={enteredPin}
              onChange={(e) => {
                setEnteredPin(e.target.value);
                setError(null);
              }}
              className="w-full text-center text-lg tracking-[0.35em] font-bold min-h-[48px] p-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] text-[var(--app-text-primary)] focus:outline-hidden focus:ring-2 focus:ring-[var(--app-hero)]"
              placeholder="•••••"
              autoFocus
            />
            {needsSetup && (
              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={confirmPin}
                onChange={(e) => {
                  setConfirmPin(e.target.value);
                  setError(null);
                }}
                className="w-full text-center text-lg tracking-[0.35em] font-bold min-h-[48px] p-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] text-[var(--app-text-primary)] focus:outline-hidden focus:ring-2 focus:ring-[var(--app-hero)] mt-3"
                placeholder="تأكيد الرمز"
              />
            )}
            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400 text-center font-bold leading-relaxed mt-2">
                {error}
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !enteredPin.trim() || (needsSetup && !confirmPin.trim()) || isLocked}
          className="w-full min-h-[44px] rounded-2xl bg-[var(--app-hero)] hover:bg-[var(--app-hero-hover)] disabled:opacity-50 text-white text-sm font-black cursor-pointer transition-all flex items-center justify-center gap-2"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isLocked ? (
            <>
              <Lock className="w-4 h-4" />
              <span>مغلق مؤقتًا ({timeFormatted})</span>
            </>
          ) : needsSetup ? (
            <>
              <KeyRound className="w-4 h-4" />
              <span>إنشاء الرمز والدخول</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              <span>دخول</span>
            </>
          )}
        </button>
      </form>
    </BottomSheetModal>
  );
};

