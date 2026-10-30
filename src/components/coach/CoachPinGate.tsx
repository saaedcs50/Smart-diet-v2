import React, { useState, useEffect } from 'react';
import { BRAND, brandCopy } from '../../config/brand';
import { BrandLogo } from '../BrandLogo';
import {
  getLockoutRemainingSeconds,
  hasCoachPin,
  setupCoachPin,
  COACH_LOCAL_ONLY,
} from '../../utils/coachAuth';
import { createCoachServerSession, saveCoachServerToken } from '../../utils/coachServer';
import { Timer, Lock, Loader2, KeyRound } from 'lucide-react';

interface CoachPinGateProps {
  onUnlockSession: (pin: string) => Promise<boolean | string> | boolean | string;
  onNavigateClient?: () => void;
  onClose: () => void;
}

// بوابة PIN للوحة المدرب — تُعرض بدل المحتوى حتى يُدخل الرمز الصحيح.
// كل الحالة هنا محلية (لا تشارك مع تبويبات اللوحة) لسهولة الفصل.
export const CoachPinGate: React.FC<CoachPinGateProps> = ({
  onUnlockSession,
  onNavigateClient,
  onClose,
}) => {
  const [pagePinInput, setPagePinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pagePinError, setPagePinError] = useState<string | null>(null);
  const [isPagePinSubmitting, setIsPagePinSubmitting] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(() => getLockoutRemainingSeconds());
  // وضع الإعداد: لا يوجد رمز محلي بعد — نعرض إنشاء رمز بدل الدخول
  const [isSetupMode, setIsSetupMode] = useState<boolean>(() => !hasCoachPin());

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      const remaining = getLockoutRemainingSeconds();
      setLockoutSeconds(remaining);
      if (remaining <= 0) {
        setPagePinError(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  const handlePagePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;
    const trimmed = pagePinInput.trim();
    if (!trimmed) {
      setPagePinError('يرجى إدخال رمز PIN للدخول.');
      return;
    }
    if (isPagePinSubmitting) return;

    setIsPagePinSubmitting(true);
    setPagePinError(null);
    try {
      const result = await onUnlockSession(trimmed);
      if (result === true) {
        setPagePinError(null);
        setPagePinInput('');
      } else if (typeof result === 'string' && result) {
        setPagePinError(result);
      } else {
        setPagePinError('رمز PIN غير صحيح. يرجى المحاولة مرة أخرى.');
      }
      const remaining = getLockoutRemainingSeconds();
      if (remaining > 0) {
        setLockoutSeconds(remaining);
      }
    } catch (err) {
      setPagePinError(err instanceof Error && err.message ? err.message : 'حدث خطأ أثناء التحقق من الرمز.');
    } finally {
      setIsPagePinSubmitting(false);
    }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;
    const pin = pagePinInput.trim();
    const confirm = confirmPinInput.trim();
    if (!pin || !confirm) {
      setPagePinError('يرجى إدخال الرمز وتأكيده.');
      return;
    }
    if (isPagePinSubmitting) return;

    setIsPagePinSubmitting(true);
    setPagePinError(null);
    try {
      // الخادم أولًا: لو متاح، الرمز المحلي يجب أن يطابق رمز الخادم
      const server = await createCoachServerSession(pin);
      if (server.status === 'rejected') {
        setPagePinError('هذا الرمز لا يطابق رمز الخادم المُعدّ لهذه النسخة. استخدم الرمز الذي زوّدك به مسؤول النسخة.');
        setPagePinInput('');
        setConfirmPinInput('');
        return;
      }
      if (server.status === 'locked') {
        setPagePinError(server.error);
        return;
      }
      if (server.status === 'ok') {
        saveCoachServerToken(server.token);
      }
      // لا خادم متاح: الإنشاء المحلي مسموح فقط في وضع الاستضافة الثابتة
      if (server.status === 'unreachable' && !COACH_LOCAL_ONLY) {
        setPagePinError('تعذّر التحقق من خادم العيادة — لم يُنشأ أي رمز محلي. تحقق من الاتصال وإعداد الخادم ثم حاول مرة أخرى.');
        setPagePinInput('');
        setConfirmPinInput('');
        return;
      }
      const setup = await setupCoachPin(pin, confirm);
      if (setup.ok === false) {
        setPagePinError(setup.error);
        return;
      }
      // تم الإنشاء — نكمل الدخول عبر المسار المعتاد
      setIsSetupMode(false);
      setConfirmPinInput('');
      const result = await onUnlockSession(pin);
      if (result === true) {
        setPagePinError(null);
        setPagePinInput('');
      } else if (typeof result === 'string' && result) {
        setPagePinError(result);
      } else {
        setPagePinError('رمز PIN غير صحيح. يرجى المحاولة مرة أخرى.');
      }
    } catch (err) {
      setPagePinError(err instanceof Error && err.message ? err.message : 'حدث خطأ أثناء إنشاء الرمز.');
    } finally {
      setIsPagePinSubmitting(false);
    }
  };

  const isLocked = lockoutSeconds > 0;
  const mins = Math.floor(lockoutSeconds / 60);
  const secs = lockoutSeconds % 60;
  const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 text-right dir-rtl">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 app-overlay-shadow p-6 sm:p-5 space-y-4">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <BrandLogo size={64} rounded="rounded-3xl" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
            {brandCopy.coachPanel} ({BRAND.appName})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
            {isSetupMode
              ? `أول استخدام على هذا الجهاز: أنشئ رمز PIN خاصًا بك (5 أرقام على الأقل)`
              : `إشراف ${BRAND.doctorName}: يرجى إدخال رمز PIN السري للدخول`}
          </p>
        </div>

        <form onSubmit={isSetupMode ? handleSetupSubmit : handlePagePinSubmit} className="space-y-4">
          {isLocked ? (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-center space-y-2">
              <div className="flex items-center justify-center gap-1.5 font-bold text-sm">
                <Timer className="w-5 h-5 animate-pulse" />
                <span>تم إيقاف المحاولات مؤقتًا</span>
              </div>
              <p className="text-xs font-medium leading-relaxed">
                لحماية البيانات، يرجى الانتظار: <span className="font-mono font-bold text-sm tracking-wider text-amber-700 dark:text-amber-300">{timeFormatted}</span>
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-2">
                رمز PIN السري:
              </label>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                autoFocus
                value={pagePinInput}
                onChange={(e) => {
                  setPagePinInput(e.target.value);
                  setPagePinError(null);
                }}
                placeholder="•••••"
                className="w-full text-center tracking-widest text-lg font-black min-h-[48px] p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[var(--app-hero)]"
              />
              {isSetupMode && (
                <>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-2 mt-3">
                    تأكيد رمز PIN:
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    value={confirmPinInput}
                    onChange={(e) => {
                      setConfirmPinInput(e.target.value);
                      setPagePinError(null);
                    }}
                    placeholder="•••••"
                    className="w-full text-center tracking-widest text-lg font-black min-h-[48px] p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[var(--app-hero)]"
                  />
                </>
              )}
              {pagePinError && (
                <p className="text-xs font-bold text-rose-500 mt-2 text-center leading-relaxed">
                  {pagePinError}
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isPagePinSubmitting || !pagePinInput.trim() || (isSetupMode && !confirmPinInput.trim()) || isLocked}
            className="w-full min-h-[48px] py-3 rounded-2xl bg-[var(--app-hero)] hover:bg-[var(--app-hero-hover)] disabled:opacity-50 text-white font-black text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {isPagePinSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isLocked ? (
              <>
                <Lock className="w-4 h-4" />
                <span>مغلق مؤقتًا ({timeFormatted})</span>
              </>
            ) : isSetupMode ? (
              <>
                <KeyRound className="w-4 h-4" />
                <span>إنشاء الرمز والدخول</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>دخول لوحة التحكم </span>
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <button
            onClick={onNavigateClient || onClose}
            className="text-xs font-bold text-slate-500 hover:text-[var(--app-hero)] dark:text-slate-400 dark:hover:text-[var(--app-hero)] transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            <span>الانتقال إلى شاشة العميل </span>
          </button>
        </div>
      </div>
    </div>
  );
};
