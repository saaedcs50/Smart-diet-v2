/**
 * Runtime scope for device-local patient data.
 *
 * "local" preserves the existing single-clinic/anonymous app storage keys.
 * "guest" is an isolated bucket used after a device-bound patient signs out.
 * "user:<uid>" is a private bucket for one authenticated platform patient.
 *
 * withStorageScope is a synchronous read-only context switch used only for
 * displaying an unbound legacy snapshot before explicit ownership confirmation.
 */
export type StorageScope = 'local' | 'guest' | `user:${string}`;

const STORAGE_SCOPE_EVENT = 'sd-storage-scope-changed';
let currentScope: StorageScope = 'local';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.dispatchEvent === 'function';
}

function normalizeScope(scope: StorageScope): StorageScope {
  if (scope === 'local' || scope === 'guest') return scope;
  const uid = scope.slice('user:'.length);
  if (!uid || !/^[A-Za-z0-9_-]+$/.test(uid)) {
    throw new Error('معرّف مستخدم غير صالح لعزل التخزين المحلي');
  }
  return `user:${uid}`;
}

export function getStorageScope(): StorageScope {
  return currentScope;
}

export function setStorageScope(scope: StorageScope): void {
  const next = normalizeScope(scope);
  if (next === currentScope) return;
  currentScope = next;
  if (isBrowser()) {
    window.dispatchEvent(new Event(STORAGE_SCOPE_EVENT));
  }
}

export function setStorageScopeForUser(uid: string): void {
  setStorageScope(`user:${uid}`);
}

export function storageScopePrefix(scope: StorageScope = currentScope): string {
  const normalized = normalizeScope(scope);
  if (normalized === 'local') return '';
  if (normalized === 'guest') return 'guest_';
  return `user_${normalized.slice('user:'.length)}_`;
}

export function onStorageScopeChanged(listener: () => void): () => void {
  if (!isBrowser()) return () => undefined;
  window.addEventListener(STORAGE_SCOPE_EVENT, listener);
  return () => window.removeEventListener(STORAGE_SCOPE_EVENT, listener);
}

/**
 * Temporarily read another scope. It intentionally does not emit a change
 * event and always restores the caller's current scope, including on errors.
 */
export function withStorageScope<T>(scope: StorageScope, read: () => T): T {
  const previous = currentScope;
  currentScope = normalizeScope(scope);
  try {
    return read();
  } finally {
    currentScope = previous;
  }
}
