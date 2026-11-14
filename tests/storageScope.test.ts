import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getStorageScope,
  onStorageScopeChanged,
  setStorageScope,
  setStorageScopeForUser,
  withStorageScope,
} from '../src/utils/storageScope';
import { legacyNs, ns, StorageKeys } from '../src/utils/storageKeys';

afterEach(() => {
  vi.unstubAllGlobals();
  setStorageScope('local');
});

describe('account-scoped local storage namespace', () => {
  it('keeps the legacy local namespace unchanged', () => {
    setStorageScope('local');
    expect(ns('plan')).toBe(legacyNs('plan'));
    expect(StorageKeys.plan()).toBe(legacyNs('plan'));
    expect(StorageKeys.photoDbName()).toBe(legacyNs('photos_db'));
  });

  it('isolates each authenticated user and guest storage', () => {
    setStorageScopeForUser('patient-a');
    const patientAPlan = StorageKeys.plan();
    const patientAPhotos = StorageKeys.photoDbName();

    setStorageScopeForUser('patient-b');
    expect(StorageKeys.plan()).not.toBe(patientAPlan);
    expect(StorageKeys.photoDbName()).not.toBe(patientAPhotos);

    setStorageScope('guest');
    expect(StorageKeys.plan()).not.toBe(patientAPlan);
    expect(StorageKeys.plan()).not.toBe(legacyNs('plan'));
  });

  it('restores the active scope after a temporary legacy read', () => {
    setStorageScopeForUser('patient-a');
    const userKey = StorageKeys.plan();
    const result = withStorageScope('local', () => StorageKeys.plan());

    expect(result).toBe(legacyNs('plan'));
    expect(getStorageScope()).toBe('user:patient-a');
    expect(StorageKeys.plan()).toBe(userKey);
  });


  it('notifies mounted views when the active account scope changes', async () => {
    const browser = new EventTarget();
    vi.stubGlobal('window', browser);
    const listener = vi.fn();
    const unsubscribe = onStorageScopeChanged(listener);

    setStorageScopeForUser('patient-a');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setStorageScopeForUser('patient-b');
    expect(listener).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('rejects malformed account identifiers', () => {
    expect(() => setStorageScopeForUser('../other-account')).toThrow();
  });
});
