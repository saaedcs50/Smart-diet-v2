import { describe, it, expect } from 'vitest';
import { serializePreset, parsePresetImport, validatePresetData } from '../src/utils/presetIO';
import { SCENARIO_GOUT, SCENARIO_ATHLETES } from '../src/utils/caseScenarios';
import { BUILT_IN_PRESETS, PRESET_FLEXIBLE_LOW_CARB } from '../src/utils/planPresets';
import { SUPPORTED_CONDITIONS } from '../src/utils/medicalConditions';

describe('preset IO — export/import round-trip (Batch 3.1)', () => {
  it.each([
    ['scenario gout', SCENARIO_GOUT],
    ['scenario athletes', SCENARIO_ATHLETES],
    ['built-in preset', PRESET_FLEXIBLE_LOW_CARB],
  ] as const)('%s survives serialize → parse identical', (_label, preset) => {
    const result = parsePresetImport(serializePreset(preset));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.preset.id).toBe(preset.id);
      expect(result.preset.name).toBe(preset.name);
      expect(result.preset.planData.meals).toEqual(preset.planData.meals);
      expect(result.preset.planData.checklist).toEqual(preset.planData.checklist);
      expect(result.preset.scenario).toEqual(preset.scenario);
      if (preset.planData.medicalConditions) {
        const expectedConditions = preset.planData.medicalConditions.conditions.map((condition) => ({
          id: condition.id,
          label: SUPPORTED_CONDITIONS.find((item) => item.id === condition.id)?.label,
        }));
        expect(result.preset.planData.medicalConditions?.conditions).toEqual(expectedConditions);
        expect(result.preset.planData.medicalConditions?.allergies).toEqual([]);
        expect(result.preset.planData.medicalConditions?.showToClient).toBe(false);
      }
      expect(result.preset.planData).not.toHaveProperty('medicationPlan');
    }
  });

  it('round-trips every built-in clinical, fitness, fasting and maintenance template', () => {
    expect(BUILT_IN_PRESETS).toHaveLength(17);
    for (const preset of BUILT_IN_PRESETS) {
      const result = parsePresetImport(serializePreset(preset));
      expect(result.ok, preset.id).toBe(true);
      if (result.ok) {
        expect(result.preset.id).toBe(preset.id);
        expect(result.preset.planData.meals).toEqual(preset.planData.meals);
        expect(result.preset.planData.checklist).toEqual(preset.planData.checklist);
        expect(result.preset.planData).not.toHaveProperty('medicationPlan');
        if (preset.planData.medicalConditions) {
          expect(result.preset.planData.medicalConditions?.allergies).toEqual([]);
          expect(result.preset.planData.medicalConditions?.showToClient).toBe(false);
          expect(result.preset.planData.medicalConditions?.conditions.map((condition) => condition.id))
            .toEqual(preset.planData.medicalConditions.conditions.map((condition) => condition.id));
        }
      }
    }
  });

  it('rejects an unsupported export envelope version', () => {
    const envelope = JSON.parse(serializePreset(SCENARIO_GOUT));
    envelope.version = 99;
    expect(parsePresetImport(JSON.stringify(envelope))).toEqual({
      ok: false,
      error: 'إصدار ملف القالب غير مدعوم. حدّث الملف إلى الإصدار 1.',
    });
  });

  it('rejects an import larger than 512 KiB before parsing', () => {
    const oversized = ' '.repeat(512 * 1024 + 1);
    expect(parsePresetImport(oversized)).toEqual({
      ok: false,
      error: 'حجم ملف القالب يتجاوز الحد المسموح (512 كيلوبايت).',
    });
  });

  it('accepts a bare preset JSON without the export envelope', () => {
    const result = parsePresetImport(JSON.stringify(SCENARIO_GOUT));
    expect(result.ok).toBe(true);
  });

  it('export envelope carries kind + version markers', () => {
    const parsed = JSON.parse(serializePreset(SCENARIO_GOUT));
    expect(parsed.kind).toBe('smart-diet-preset');
    expect(parsed.version).toBe(1);
    expect(parsed.preset.id).toBe(SCENARIO_GOUT.id);
  });
});

describe('preset IO — corrupt/incomplete imports are rejected (Batch 3.1)', () => {
  it('rejects non-JSON text', () => {
    const r = parsePresetImport('this is not json');
    expect(r.ok).toBe(false);
  });

  it('rejects non-object JSON', () => {
    expect(parsePresetImport('[1,2,3]').ok).toBe(false);
    expect(parsePresetImport('42').ok).toBe(false);
  });

  it('rejects a foreign envelope kind', () => {
    const r = parsePresetImport(JSON.stringify({ kind: 'something-else', preset: SCENARIO_GOUT }));
    expect(r.ok).toBe(false);
  });

  it('rejects a preset without a name', () => {
    const broken = JSON.parse(JSON.stringify(SCENARIO_GOUT));
    delete broken.name;
    const r = validatePresetData(broken);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('اسم');
  });

  it('rejects a preset with an unknown category', () => {
    const broken = JSON.parse(JSON.stringify(SCENARIO_GOUT));
    broken.category = 'magic';
    expect(validatePresetData(broken).ok).toBe(false);
  });

  it('rejects a preset with empty/missing meals', () => {
    const broken = JSON.parse(JSON.stringify(SCENARIO_GOUT));
    broken.planData.meals = [];
    const r = validatePresetData(broken);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('وجبات');
  });

  it('rejects a meal without items content', () => {
    const broken = JSON.parse(JSON.stringify(SCENARIO_GOUT));
    broken.planData.meals[0].items = '   ';
    expect(validatePresetData(broken).ok).toBe(false);
  });

  it('rejects non-numeric macro targets', () => {
    const broken = JSON.parse(JSON.stringify(SCENARIO_GOUT));
    broken.targetCalories = 'many';
    expect(validatePresetData(broken).ok).toBe(false);
  });

  it('rejects a missing planData block entirely', () => {
    const broken = JSON.parse(JSON.stringify(SCENARIO_GOUT));
    delete broken.planData;
    expect(validatePresetData(broken).ok).toBe(false);
  });
});
