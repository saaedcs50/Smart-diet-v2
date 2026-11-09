import { describe, expect, it } from 'vitest';
import {
  bindLocalDataToPatient,
  getLocalDataBindingStatus,
} from '../../src/platform/localDataOwnership';

function memoryStore(): Storage & { values: Map<string, string> } {
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

describe('local data ownership lock', () => {
  it('requires explicit binding for the first patient and then matches that patient', () => {
    const store = memoryStore();
    expect(getLocalDataBindingStatus('patient-a', store)).toBe('unbound');

    bindLocalDataToPatient('patient-a', store, new Date('2026-11-09T00:00:00.000Z'));

    expect(getLocalDataBindingStatus('patient-a', store)).toBe('matched');
    expect(getLocalDataBindingStatus('patient-b', store)).toBe('mismatch');
  });

  it('does not allow a second account to rebind existing local data', () => {
    const store = memoryStore();
    bindLocalDataToPatient('patient-a', store);

    expect(() => bindLocalDataToPatient('patient-b', store)).toThrow('حساب آخر');
    expect(getLocalDataBindingStatus('patient-a', store)).toBe('matched');
    expect(getLocalDataBindingStatus('patient-b', store)).toBe('mismatch');
  });

  it('fails closed when the ownership marker is malformed', () => {
    const store = memoryStore();
    store.setItem('sd_smartdiet_platform_local_data_owner', '{bad json');

    expect(getLocalDataBindingStatus('patient-a', store)).toBe('mismatch');
  });

  it('rejects an empty patient identity', () => {
    const store = memoryStore();
    expect(() => bindLocalDataToPatient('', store)).toThrow('فارغ');
  });
});
