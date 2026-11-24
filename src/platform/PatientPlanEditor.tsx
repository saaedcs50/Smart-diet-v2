import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type {
  MedicationItem,
  MedicationSlot,
  PlanConfig,
} from '../types';
import { getPatientPlan, savePatientPlan } from './database';
import {
  clonePatientPlan,
  createEmptyPatientPlan,
  validatePatientPlan,
} from './patientPlanEditor';

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
const labelClass = 'mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300';
const primaryButtonClass = 'rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButtonClass = 'rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';
const dangerButtonClass = 'rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30';

const medicationSlots: Array<{ value: MedicationSlot; label: string }> = [
  { value: 'before_breakfast', label: 'قبل الإفطار' },
  { value: 'with_breakfast', label: 'مع الإفطار' },
  { value: 'after_breakfast', label: 'بعد الإفطار' },
  { value: 'before_lunch', label: 'قبل الغداء' },
  { value: 'with_lunch', label: 'مع الغداء' },
  { value: 'after_lunch', label: 'بعد الغداء' },
  { value: 'before_dinner', label: 'قبل العشاء' },
  { value: 'with_dinner', label: 'مع العشاء' },
  { value: 'after_dinner', label: 'بعد العشاء' },
  { value: 'before_sleep', label: 'قبل النوم' },
  { value: 'morning', label: 'صباحًا' },
  { value: 'evening', label: 'مساءً' },
  { value: 'prn', label: 'عند اللزوم' },
];

function makeId(prefix: string): string {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${id}`;
}

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseList(value: string): string[] {
  return [...new Set(value.split(/[\\n,،;؛]/).map((entry) => entry.trim()).filter(Boolean))].slice(0, 20);
}

function NumberField({
  label,
  value,
  unit,
  onChange,
  placeholder,
  min,
  max,
  required = false,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
  onChange: (value: number | null) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label} ({unit})</span>
      <input
        className={inputClass}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step="0.1"
        required={required}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(event) => onChange(parseOptionalNumber(event.target.value))}
      />
    </label>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-3">
        <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">{title}</h4>
        {description && <p className="mt-1 text-[11px] leading-5 text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function mealAlternativesText(alternatives: string[]): string {
  return alternatives.join('\n');
}

function medicationSlotLabel(slot: MedicationSlot): string {
  return medicationSlots.find((item) => item.value === slot)?.label ?? slot;
}

export function PatientPlanEditor({
  patientUid,
  editorUid,
  patientName,
  initialPlan,
  onSaved,
}: {
  patientUid: string;
  editorUid: string;
  patientName: string;
  initialPlan: PlanConfig | null;
  onSaved: (plan: PlanConfig) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PlanConfig>(() =>
    initialPlan ? clonePatientPlan(initialPlan) : createEmptyPatientPlan(patientName),
  );
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(initialPlan ? clonePatientPlan(initialPlan) : createEmptyPatientPlan(patientName));
    setValidationErrors([]);
    setSaveError(null);
    setNotice(null);
    setEditing(false);
  }, [patientUid, patientName, initialPlan]);

  const updateDraft = (patch: Partial<PlanConfig>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setValidationErrors([]);
    setSaveError(null);
  };

  const updateMeal = (index: number, patch: Partial<PlanConfig['meals'][number]>) => {
    setDraft((current) => ({
      ...current,
      meals: current.meals.map((meal, currentIndex) => currentIndex === index ? { ...meal, ...patch } : meal),
    }));
    setValidationErrors([]);
  };

  const updateChecklist = (index: number, label: string) => {
    setDraft((current) => ({
      ...current,
      checklist: current.checklist.map((item, currentIndex) => currentIndex === index ? { ...item, label } : item),
    }));
    setValidationErrors([]);
  };

  const updateSupplement = (index: number, patch: Partial<PlanConfig['supplements'][number]>) => {
    setDraft((current) => ({
      ...current,
      supplements: current.supplements.map((item, currentIndex) => currentIndex === index ? { ...item, ...patch } : item),
    }));
    setValidationErrors([]);
  };

  const updateMedication = (index: number, patch: Partial<MedicationItem>) => {
    setDraft((current) => {
      const medicationPlan = current.medicationPlan ?? { showToClient: true, items: [], lastUpdatedBy: 'coach' as const };
      return {
        ...current,
        medicationPlan: {
          ...medicationPlan,
          lastUpdatedBy: 'coach',
          lastUpdatedAt: new Date().toISOString(),
          items: medicationPlan.items.map((item, currentIndex) => currentIndex === index ? { ...item, ...patch } : item),
        },
      };
    });
    setValidationErrors([]);
  };

  const addMeal = () => {
    if (draft.meals.length >= 40) return;
    updateDraft({
      meals: [...draft.meals, {
        id: makeId('meal'),
        name: '',
        items: '',
        alternatives: [],
        time: '',
      }],
    });
  };

  const addChecklistItem = () => {
    if (draft.checklist.length >= 60) return;
    updateDraft({
      checklist: [...draft.checklist, { id: makeId('check'), label: '' }],
    });
  };

  const addSupplement = () => {
    if (draft.supplements.length >= 40) return;
    updateDraft({
      supplements: [...draft.supplements, { id: makeId('supplement'), name: '' }],
    });
  };

  const addMedication = () => {
    const medications = draft.medicationPlan?.items ?? [];
    if (medications.length >= 40) return;
    const itemId = makeId('medication');
    const item: MedicationItem = {
      id: itemId,
      name: '',
      dose: '',
      timesPerDay: 1,
      timings: [{ id: makeId('timing'), slot: 'morning', label: 'صباحًا' }],
      active: true,
    };
    updateDraft({
      medicationPlan: {
        ...(draft.medicationPlan ?? { showToClient: true }),
        items: [...medications, item],
        lastUpdatedBy: 'coach',
        lastUpdatedAt: new Date().toISOString(),
      },
    });
  };

  const removeMeal = (id: string) => updateDraft({ meals: draft.meals.filter((meal) => meal.id !== id) });
  const removeChecklistItem = (id: string) => updateDraft({ checklist: draft.checklist.filter((item) => item.id !== id) });
  const removeSupplement = (id: string) => updateDraft({ supplements: draft.supplements.filter((item) => item.id !== id) });
  const removeMedication = (id: string) => {
    const medicationPlan = draft.medicationPlan ?? { showToClient: true, items: [], lastUpdatedBy: 'coach' as const };
    updateDraft({
      medicationPlan: {
        ...medicationPlan,
        items: medicationPlan.items.filter((item) => item.id !== id),
        lastUpdatedBy: 'coach',
        lastUpdatedAt: new Date().toISOString(),
      },
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const nextDraft: PlanConfig = { ...draft, clientName: patientName.trim() };
    const errors = validatePatientPlan(nextDraft);
    setValidationErrors(errors);
    setSaveError(null);
    setNotice(null);
    if (errors.length > 0) return;

    setSaving(true);
    try {
      await savePatientPlan(patientUid, nextDraft, editorUid);
      let refreshed: PlanConfig = nextDraft;
      try {
        refreshed = await getPatientPlan(patientUid) ?? nextDraft;
      } catch {
        // The write has already returned a row; retain the saved draft if a
        // follow-up refresh is interrupted by a transient network failure.
      }
      onSaved(refreshed);
      setEditing(false);
      setNotice('تم حفظ الخطة السحابية وتحديث ملخص المريض.');
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'تعذّر حفظ الخطة السحابية.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-slate-100">محرر الخطة الغذائية السحابية</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
            التعديلات تُحفظ في ملف هذا المريض داخل عيادتك. لا تُحسب الأهداف أو توصف الأدوية تلقائيًا.
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(initialPlan ? clonePatientPlan(initialPlan) : createEmptyPatientPlan(patientName));
              setValidationErrors([]);
              setSaveError(null);
              setNotice(null);
              setEditing(true);
            }}
            className={primaryButtonClass}
          >
            {initialPlan ? 'تعديل الخطة' : 'إنشاء الخطة'}
          </button>
        )}
      </div>

      {notice && !editing && <p role="status" className="mt-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">{notice}</p>}

      {editing && (
        <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>اسم المريض</span>
              <input className={inputClass} value={patientName} readOnly />
            </label>
            <NumberField
              label="الطول"
              unit="سم"
              value={draft.heightCm}
              onChange={(value) => updateDraft({ heightCm: value })}
              min={60}
              max={250}
              placeholder="مثال: 170"
            />
            <NumberField
              label="وزن البداية"
              unit="كجم"
              value={draft.startWeight}
              onChange={(value) => updateDraft({ startWeight: value })}
              min={20}
              max={400}
              placeholder="مثال: 85"
            />
            <NumberField
              label="الوزن المستهدف"
              unit="كجم"
              value={draft.targetWeight}
              onChange={(value) => updateDraft({ targetWeight: value })}
              min={20}
              max={400}
              placeholder="مثال: 75"
            />
            <NumberField
              label="محيط الخصر المستهدف"
              unit="سم"
              value={draft.targetWaist}
              onChange={(value) => updateDraft({ targetWaist: value })}
              min={25}
              max={250}
            />
            <NumberField
              label="هدف الماء اليومي"
              unit="مل"
              value={draft.dailyWaterGoalMl}
              onChange={(value) => updateDraft({ dailyWaterGoalMl: value ?? 0 })}
              min={250}
              max={10000}
              required
              placeholder="مثال: 2000"
            />
          </div>

          <Section title="الأهداف الغذائية اليومية" description="أدخل الأهداف التي يحددها الطبيب؛ لا يحسب المحرر احتياج المريض تلقائيًا.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <NumberField label="السعرات" unit="kcal" value={draft.targetCalories} onChange={(value) => updateDraft({ targetCalories: value })} min={500} max={10000} />
              <NumberField label="البروتين" unit="جم" value={draft.targetProtein} onChange={(value) => updateDraft({ targetProtein: value })} min={0} max={1000} />
              <NumberField label="الكربوهيدرات" unit="جم" value={draft.targetCarbs} onChange={(value) => updateDraft({ targetCarbs: value })} min={0} max={1500} />
              <NumberField label="الدهون" unit="جم" value={draft.targetFats} onChange={(value) => updateDraft({ targetFats: value })} min={0} max={1000} />
            </div>
          </Section>

          <Section title={`الوجبات (${draft.meals.length})`} description="اكتب المكونات والكميات بوحداتها بوضوح، ويمكن إضافة أكثر من بديل ووقت للوجبة.">
            <div className="space-y-3">
              {draft.meals.map((meal, index) => (
                <div key={meal.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">وجبة {index + 1}</span>
                    <button type="button" onClick={() => removeMeal(meal.id)} className={dangerButtonClass}>حذف الوجبة</button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className={labelClass}>اسم الوجبة</span>
                      <input className={inputClass} maxLength={100} value={meal.name} onChange={(event) => updateMeal(index, { name: event.target.value })} placeholder="الإفطار" />
                    </label>
                    <label className="block">
                      <span className={labelClass}>الوقت (24 ساعة)</span>
                      <input className={inputClass} type="time" value={meal.time ?? ''} onChange={(event) => updateMeal(index, { time: event.target.value })} />
                    </label>
                  </div>
                  <label className="mt-3 block">
                    <span className={labelClass}>المكونات والكميات والوحدات</span>
                    <textarea className={inputClass} maxLength={2500} rows={3} value={meal.items} onChange={(event) => updateMeal(index, { items: event.target.value })} placeholder="مثال: 2 بيضة (100 جم)، خبز بلدي 60 جم، خيار 100 جم" />
                  </label>
                  <label className="mt-3 block">
                    <span className={labelClass}>البدائل (كل بديل في سطر)</span>
                    <textarea className={inputClass} rows={2} maxLength={2000} value={mealAlternativesText(meal.alternatives)} onChange={(event) => updateMeal(index, { alternatives: parseList(event.target.value) })} placeholder="بديل أول مع الكمية\nبديل ثانٍ مع الكمية" />
                  </label>
                </div>
              ))}
              <button type="button" onClick={addMeal} disabled={draft.meals.length >= 40} className={secondaryButtonClass}>+ إضافة وجبة</button>
            </div>
          </Section>

          <Section title={`بنود المتابعة (${draft.checklist.length})`}>
            <div className="space-y-2">
              {draft.checklist.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2">
                  <input className={inputClass} maxLength={160} value={item.label} onChange={(event) => updateChecklist(index, event.target.value)} placeholder={`بند متابعة ${index + 1}`} />
                  <button type="button" onClick={() => removeChecklistItem(item.id)} className={dangerButtonClass}>حذف</button>
                </div>
              ))}
              <button type="button" onClick={addChecklistItem} disabled={draft.checklist.length >= 60} className={secondaryButtonClass}>+ إضافة بند متابعة</button>
            </div>
          </Section>

          <Section title={`الأدوية (${draft.medicationPlan?.items.length ?? 0})`} description="أدخل بيانات الدواء كما وردت من الوصفة؛ المحرر لا يقترح جرعات أو يغيّر دواء.">
            <div className="space-y-3">
              {(draft.medicationPlan?.items ?? []).map((medication, index) => (
                <div key={medication.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">دواء {index + 1}</span>
                    <button type="button" onClick={() => removeMedication(medication.id)} className={dangerButtonClass}>حذف</button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className={labelClass}>اسم الدواء</span>
                      <input className={inputClass} maxLength={120} value={medication.name} onChange={(event) => updateMedication(index, { name: event.target.value })} />
                    </label>
                    <label className="block">
                      <span className={labelClass}>الجرعة كما في الوصفة</span>
                      <input className={inputClass} maxLength={120} value={medication.dose} onChange={(event) => updateMedication(index, { dose: event.target.value })} placeholder="كما وردت في الوصفة" />
                    </label>
                    <label className="block">
                      <span className={labelClass}>مرات التناول يوميًا</span>
                      <input className={inputClass} type="number" min={1} max={6} step={1} value={medication.timesPerDay} onChange={(event) => updateMedication(index, { timesPerDay: Number(event.target.value) })} />
                    </label>
                    <label className="block">
                      <span className={labelClass}>موعد التناول</span>
                      <select
                        className={inputClass}
                        value={medication.timings[0]?.slot ?? 'morning'}
                        onChange={(event) => updateMedication(index, {
                          timings: [{
                            id: medication.timings[0]?.id ?? makeId('timing'),
                            slot: event.target.value as MedicationSlot,
                            label: medicationSlotLabel(event.target.value as MedicationSlot),
                          }],
                        })}
                      >
                        {medicationSlots.map((slot) => <option key={slot.value} value={slot.value}>{slot.label}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <input type="checkbox" checked={medication.active} onChange={(event) => updateMedication(index, { active: event.target.checked })} />
                    دواء نشط ضمن الخطة
                  </label>
                </div>
              ))}
              <button type="button" onClick={addMedication} disabled={(draft.medicationPlan?.items.length ?? 0) >= 40} className={secondaryButtonClass}>+ إضافة دواء</button>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={draft.medicationPlan?.showToClient ?? true}
                  onChange={(event) => updateDraft({
                    medicationPlan: {
                      ...(draft.medicationPlan ?? { items: [] }),
                      showToClient: event.target.checked,
                      lastUpdatedBy: 'coach',
                      lastUpdatedAt: new Date().toISOString(),
                    },
                  })}
                />
                إظهار قائمة الأدوية للمريض
              </label>
            </div>
          </Section>

          <Section title={`المكملات (${draft.supplements.length})`}>
            <div className="space-y-2">
              {draft.supplements.map((supplement, index) => (
                <div key={supplement.id} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto] dark:bg-slate-900">
                  <label className="block">
                    <span className={labelClass}>اسم المكمل</span>
                    <input className={inputClass} maxLength={120} value={supplement.name} onChange={(event) => updateSupplement(index, { name: event.target.value })} />
                  </label>
                  <label className="block">
                    <span className={labelClass}>الوقت أو الملاحظة</span>
                    <input className={inputClass} maxLength={500} value={supplement.time ?? supplement.notes ?? ''} onChange={(event) => updateSupplement(index, { time: event.target.value })} />
                  </label>
                  <div className="flex items-end">
                    <button type="button" onClick={() => removeSupplement(supplement.id)} className={dangerButtonClass}>حذف</button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addSupplement} disabled={draft.supplements.length >= 40} className={secondaryButtonClass}>+ إضافة مكمل</button>
            </div>
          </Section>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
            <button type="submit" disabled={saving} className={primaryButtonClass}>
              {saving ? 'جارٍ حفظ الخطة…' : 'حفظ الخطة السحابية'}
            </button>
            <button type="button" disabled={saving} onClick={() => {
              setDraft(initialPlan ? clonePatientPlan(initialPlan) : createEmptyPatientPlan(patientName));
              setEditing(false);
              setValidationErrors([]);
              setSaveError(null);
            }} className={secondaryButtonClass}>
              إلغاء التعديلات
            </button>
          </div>
          {validationErrors.length > 0 && (
            <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
              <p className="text-xs font-black text-amber-900 dark:text-amber-100">راجع الحقول التالية؛ لم يتم حفظ أي تغيير:</p>
              <ul className="mt-2 list-disc space-y-1 pr-5 text-xs text-amber-800 dark:text-amber-200">
                {validationErrors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            </div>
          )}
          {saveError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">{saveError}</p>}
        </form>
      )}
    </section>
  );
}
