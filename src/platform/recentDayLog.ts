export const NEW_DAILY_LOG_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Shows a transient "new" badge for a daily log created in the past 24 hours.
 * Invalid or future timestamps are never treated as new.
 */
export function isNewDailyLog(
  createdAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!createdAt) return false;
  const createdAtMs = Date.parse(createdAt);
  const nowMs = now.getTime();
  if (!Number.isFinite(createdAtMs) || !Number.isFinite(nowMs)) return false;
  const ageMs = nowMs - createdAtMs;
  return ageMs >= 0 && ageMs < NEW_DAILY_LOG_WINDOW_MS;
}
