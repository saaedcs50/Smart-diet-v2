import React, { useEffect, useState } from 'react';
import { Accessibility, Check, X } from 'lucide-react';
import { StorageKeys } from '../utils/storageKeys';
import { onStorageScopeChanged } from '../utils/storageScope';

function readPreference(key: () => string): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(key()) === 'true';
  } catch {
    return false;
  }
}

function savePreference(key: () => string, value: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key(), String(value));
  } catch {
    // Keep the accessibility controls usable even when storage is unavailable.
  }
}

/** Account-scoped accessibility controls: larger type and stronger contrast. */
export const AccessibilityMenu: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [largeText, setLargeText] = useState(() =>
    readPreference(StorageKeys.accessibilityLargeText),
  );
  const [highContrast, setHighContrast] = useState(() =>
    readPreference(StorageKeys.accessibilityHighContrast),
  );

  useEffect(() => {
    const syncForCurrentAccount = () => {
      setLargeText(readPreference(StorageKeys.accessibilityLargeText));
      setHighContrast(readPreference(StorageKeys.accessibilityHighContrast));
    };
    return onStorageScopeChanged(syncForCurrentAccount);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('a11y-large-text', largeText);
    savePreference(StorageKeys.accessibilityLargeText, largeText);
  }, [largeText]);

  useEffect(() => {
    document.documentElement.classList.toggle('a11y-high-contrast', highContrast);
    savePreference(StorageKeys.accessibilityHighContrast, highContrast);
  }, [highContrast]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="إعدادات إمكانية الوصول"
        aria-expanded={open}
        aria-controls="accessibility-preferences"
        title="إمكانية الوصول"
        className="p-2.5 min-w-10 min-h-10 rounded-xl bg-[var(--app-bg)] text-[var(--app-secondary)] dark:text-[var(--app-text-primary)] hover:bg-[var(--app-card-muted)] border border-[var(--app-border)] transition-colors cursor-pointer"
      >
        <Accessibility className="w-4 h-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          id="accessibility-preferences"
          dir="rtl"
          role="group"
          aria-label="تفضيلات إمكانية الوصول"
          className="absolute left-0 top-full mt-2 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 text-[var(--app-text-primary)] app-overlay-shadow"
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-black">إمكانية الوصول</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="إغلاق إعدادات إمكانية الوصول"
              className="rounded-lg p-1.5 text-[var(--app-text-secondary)] hover:bg-[var(--app-card-muted)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-[var(--app-card-muted)]">
            <input
              type="checkbox"
              checked={largeText}
              onChange={(event) => setLargeText(event.target.checked)}
              className="h-4 w-4 accent-[var(--app-hero)]"
            />
            <span className="flex-1 text-sm font-bold">تكبير حجم النص</span>
            {largeText && <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
          </label>

          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-[var(--app-card-muted)]">
            <input
              type="checkbox"
              checked={highContrast}
              onChange={(event) => setHighContrast(event.target.checked)}
              className="h-4 w-4 accent-[var(--app-hero)]"
            />
            <span className="flex-1 text-sm font-bold">تباين أعلى للنصوص والحدود</span>
            {highContrast && <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
          </label>

          <p className="mt-2 border-t border-[var(--app-border)] pt-2 text-xs text-[var(--app-text-secondary)]">
            تُحفظ هذه التفضيلات على هذا الحساب والجهاز، ولا تغيّر بيانات الخطة الغذائية.
          </p>
        </div>
      )}
    </div>
  );
};
