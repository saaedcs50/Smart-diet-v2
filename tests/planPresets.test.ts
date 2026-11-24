import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PLAN } from '../src/utils/storage';
import {
  createPresetFromPlan,
  deleteCustomPreset,
  getAllPresets,
  getCustomPresetsStorageKey,
  loadCustomPresets,
  PLAN_TEMPLATES,
  saveCustomPreset,
} from '../src/utils/planPresets';
import { validatePresetData } from '../src/utils/presetIO';

function installMemoryStorage() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, String(value)); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
  };
  vi.stubGlobal('localStorage', storage);
  return values;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('clinic plan preset library', () => {
  it('includes the five required health and athlete scenarios', () => {
    const ids = PLAN_TEMPLATES.map((preset) => preset.id);
    expect(ids).toEqual(expect.arrayContaining([
      'scenario_t2dm',
      'scenario_hypertension',
      'scenario_pcos',
      'scenario_ibs',
      'scenario_athletes',
      'scenario_gout',
      'scenario_pregnancy',
    ]));
  });

  it('validates every built-in preset before showing it in the library', () => {
    const invalid = PLAN_TEMPLATES
      .map((preset) => ({ id: preset.id, result: validatePresetData(preset) }))
      .filter((item) => !item.result.ok);
    expect(invalid).toEqual([]);
  });

  it('keeps custom template libraries isolated between clinics', () => {
    installMemoryStorage();
    const preset = createPresetFromPlan(DEFAULT_PLAN, 'قالب العيادة أ');

    expect(saveCustomPreset(preset, 'clinic:clinic-a')).toBe(true);
    expect(loadCustomPresets('clinic:clinic-a').map((item) => item.id)).toEqual([preset.id]);
    expect(loadCustomPresets('clinic:clinic-b')).toEqual([]);
    expect(getAllPresets('clinic:clinic-b').some((item) => item.id === preset.id)).toBe(false);
    expect(getCustomPresetsStorageKey('clinic:clinic-a')).not.toBe(
      getCustomPresetsStorageKey('clinic:clinic-b'),
    );
  });

  it('can remove a custom preset only from the selected clinic library', () => {
    installMemoryStorage();
    const preset = createPresetFromPlan(DEFAULT_PLAN, 'قالب قابل للحذف');
    saveCustomPreset(preset, 'clinic:clinic-a');

    expect(deleteCustomPreset(preset.id, 'clinic:clinic-a')).toBe(true);
    expect(loadCustomPresets('clinic:clinic-a')).toEqual([]);
  });

  it('does not export an individual patient diagnosis, allergy list or medication list', () => {
    const patientPlan = {
      ...DEFAULT_PLAN,
      clientName: 'اسم مريض خاص',
      medicalConditions: {
        conditions: [{ id: 't2dm', label: 'سكري من النوع الثاني' }],
        allergies: ['حساسية شخصية'],
        showToClient: true,
        customConditionNotes: 'ملاحظة سريرية خاصة',
      },
      medicationPlan: {
        showToClient: true,
        items: [{
          id: 'private-med-1',
          name: 'دواء خاص',
          dose: 'جرعة شخصية',
          timesPerDay: 1,
          timings: [{ id: 'private-time-1', slot: 'morning' as const, label: 'صباحًا' }],
          active: true,
        }],
      },
    };

    const preset = createPresetFromPlan(patientPlan, 'قالب قابل للمشاركة');
    expect(preset.planData).not.toHaveProperty('medicalConditions');
    expect(preset.planData).not.toHaveProperty('medicationPlan');
    expect(JSON.stringify(preset)).not.toContain('اسم مريض خاص');
    expect(JSON.stringify(preset)).not.toContain('حساسية شخصية');
    expect(JSON.stringify(preset)).not.toContain('دواء خاص');
  });
});
