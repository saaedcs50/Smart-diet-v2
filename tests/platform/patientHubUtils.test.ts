import { describe, expect, it } from 'vitest';
import { addPatientHub, removePatientHub, MAX_OPEN_PATIENT_HUBS } from '../../src/platform/patientHubUtils';

describe('patient quick hub dock', () => {
  it('limits the number of simultaneously open hubs and keeps the newest', () => {
    expect(addPatientHub(['a', 'b', 'c'], 'd')).toEqual(['b', 'c', 'd']);
    expect(MAX_OPEN_PATIENT_HUBS).toBe(3);
  });

  it('does not duplicate an already open patient', () => {
    expect(addPatientHub(['a', 'b'], 'a')).toEqual(['a', 'b']);
  });

  it('ignores blank ids', () => {
    expect(addPatientHub(['a'], ' ')).toEqual(['a']);
  });

  it('removes only the closed patient hub', () => {
    expect(removePatientHub(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });
});
