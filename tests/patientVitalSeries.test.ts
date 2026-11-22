import { describe, expect, it } from 'vitest';
import type { DayLog } from '../src/types';
import {
  buildPatientVitalSeries,
  type PatientVitalEntry,
} from '../src/platform/patientVitalSeries';

function entry(
  date: string,
  healthMetrics?: DayLog['healthMetrics'],
): PatientVitalEntry {
  return {
    date,
    log: { healthMetrics },
  };
}

describe('buildPatientVitalSeries', () => {
  it('returns empty series for an empty record set', () => {
    expect(buildPatientVitalSeries([])).toEqual({
      bodyFatPercent: [],
      bloodGlucoseMgDl: [],
      systolicBloodPressureMmHg: [],
      diastolicBloodPressureMmHg: [],
    });
  });

  it('sorts real measurements chronologically and ignores missing or invalid values', () => {
    const series = buildPatientVitalSeries([
      entry('2026-11-03', {
        bodyFatPercent: 29.5,
        bloodGlucoseMgDl: 94,
        systolicBloodPressureMmHg: 118,
        diastolicBloodPressureMmHg: 78,
      }),
      entry('2026-11-01', {
        bodyFatPercent: 31,
        bloodGlucoseMgDl: 101,
        systolicBloodPressureMmHg: 124,
        diastolicBloodPressureMmHg: 82,
      }),
      entry('2026-11-02', {
        bodyFatPercent: 101,
        bloodGlucoseMgDl: 0,
        systolicBloodPressureMmHg: Number.POSITIVE_INFINITY,
        diastolicBloodPressureMmHg: -1,
      }),
      entry('2026-13-40', {
        bodyFatPercent: 25,
        bloodGlucoseMgDl: 90,
      }),
      entry('not-a-date', {
        bodyFatPercent: 25,
      }),
      entry('2026-11-04'),
    ]);

    expect(series.bodyFatPercent).toEqual([
      { date: '2026-11-01', value: 31 },
      { date: '2026-11-03', value: 29.5 },
    ]);
    expect(series.bloodGlucoseMgDl).toEqual([
      { date: '2026-11-01', value: 101 },
      { date: '2026-11-03', value: 94 },
    ]);
    expect(series.systolicBloodPressureMmHg).toEqual([
      { date: '2026-11-01', value: 124 },
      { date: '2026-11-03', value: 118 },
    ]);
    expect(series.diastolicBloodPressureMmHg).toEqual([
      { date: '2026-11-01', value: 82 },
      { date: '2026-11-03', value: 78 },
    ]);
  });

  it('merges duplicate-date observations and keeps only the latest 30 points', () => {
    const duplicateSeries = buildPatientVitalSeries([
      entry('2026-01-01', { bodyFatPercent: 30, bloodGlucoseMgDl: 95 }),
      entry('2026-01-01', { bloodGlucoseMgDl: 99 }),
    ]);
    expect(duplicateSeries.bodyFatPercent).toEqual([
      { date: '2026-01-01', value: 30 },
    ]);
    expect(duplicateSeries.bloodGlucoseMgDl).toEqual([
      { date: '2026-01-01', value: 99 },
    ]);

    const longSeries = buildPatientVitalSeries(
      Array.from({ length: 35 }, (_, index) => {
        const date = new Date(Date.UTC(2026, 0, index + 1))
          .toISOString()
          .slice(0, 10);
        return entry(date, { bodyFatPercent: 25 + index / 10 });
      }),
    );

    expect(longSeries.bodyFatPercent).toHaveLength(30);
    expect(longSeries.bodyFatPercent[0].date).toBe('2026-01-06');
    expect(longSeries.bodyFatPercent[29].date).toBe('2026-02-09');
  });
});
