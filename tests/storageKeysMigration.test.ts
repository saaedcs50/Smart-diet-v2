import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  copyLegacyPatientDataToUser,
  hasLegacyPatientData,
  legacyNs,
  nsForScope,
  StorageKeys,
} from '../src/utils/storageKeys';
import { setStorageScope, setStorageScopeForUser } from '../src/utils/storageScope';

function memoryStorage(): Storage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => { values.delete(key); },
    setItem: (key: string, value: string) => { values.set(key, String(value)); },
  } as Storage & { values: Map<string, string> };
}

describe('legacy patient data copy to UID namespace', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setStorageScope('local');
  });

  it('copies the approved patient data keys but not coach secrets or photos', () => {
    const store = memoryStorage();
    vi.stubGlobal('localStorage', store);
    setStorageScope('local');

    store.setItem(legacyNs('plan'), '{"clientName":"Legacy patient"}');
    store.setItem(legacyNs('day_2026-11-12'), '{"water":500}');
    store.setItem(legacyNs('shopping_list_2026-11-09'), '{"items":[]}');
    store.setItem(legacyNs('coach_pin_hash'), 'secret-hash');
    store.setItem(legacyNs('coach_pin_salt'), 'secret-salt');
    store.setItem(legacyNs('coach_session_token'), 'secret-token');
    store.setItem(legacyNs('dark_mode'), 'true');

    expect(hasLegacyPatientData()).toBe(true);
    const result = copyLegacyPatientDataToUser('patient-a');
    expect(result.copiedKeys).toBe(3);

    setStorageScopeForUser('patient-a');
    expect(localStorage.getItem(StorageKeys.plan())).toBe('{"clientName":"Legacy patient"}');
    expect(localStorage.getItem(StorageKeys.dayPrefix() + '2026-11-12')).toBe('{"water":500}');
    expect(localStorage.getItem(StorageKeys.shoppingListWeek('2026-11-09'))).toBe('{"items":[]}');
    expect(localStorage.getItem(StorageKeys.coachPinHash())).toBeNull();
    expect(localStorage.getItem(StorageKeys.coachPinSalt())).toBeNull();
    expect(localStorage.getItem(StorageKeys.coachSessionToken())).toBeNull();
    expect(localStorage.getItem(StorageKeys.darkMode())).toBeNull();
  });

  it('does not overwrite newer UID data and never copies another account namespace', () => {
    const store = memoryStorage();
    vi.stubGlobal('localStorage', store);

    store.setItem(legacyNs('plan'), '{"clientName":"legacy"}');
    store.setItem(nsForScope('user:patient-b', 'day_2026-11-12'), '{"water":900}');
    store.setItem(nsForScope('user:patient-a', 'plan'), '{"clientName":"newer"}');

    const result = copyLegacyPatientDataToUser('patient-a');
    expect(result.skippedExisting).toBe(1);
    expect(store.getItem(nsForScope('user:patient-a', 'plan'))).toBe('{"clientName":"newer"}');
    expect(store.getItem(nsForScope('user:patient-a', 'day_2026-11-12'))).toBeNull();
    expect(store.getItem(nsForScope('user:patient-b', 'day_2026-11-12'))).toBe('{"water":900}');
  });

  it('keeps the source legacy dataset intact after copying', () => {
    const store = memoryStorage();
    vi.stubGlobal('localStorage', store);
    store.setItem(legacyNs('plan'), '{"clientName":"do not delete"}');

    copyLegacyPatientDataToUser('patient-a');

    expect(store.getItem(legacyNs('plan'))).toBe('{"clientName":"do not delete"}');
  });

  it('does not copy data when there is no legacy data', () => {
    const store = memoryStorage();
    vi.stubGlobal('localStorage', store);
    expect(hasLegacyPatientData()).toBe(false);
    expect(copyLegacyPatientDataToUser('patient-a').copiedKeys).toBe(0);
  });
});
