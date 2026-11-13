import { afterEach, describe, expect, it } from 'vitest';
import {
  getStorageScope,
  setStorageScope,
  setStorageScopeForUser,
  withStorageScope,
} from '../src/utils/storageScope';
import { legacyNs, ns, StorageKeys } from '../src/utils/storageKeys';

afterEach(() => setStorageScope('local'));

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

  it('rejects malformed account identifiers', () => {
    expect(() => setStorageScopeForUser('../other-account')).toThrow();
  });
});
