import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { ConditionItem } from '../types';
import type { IntakeAnswers } from '../utils/intake';
import { SUPPORTED_CONDITIONS } from '../utils/medicalConditions';
import {
  splitPatientIntakeList,
  validatePatientIntakeAnswers,
} from './patientIntakeUtils';
import {
  listPatientIntakes,
  markPatientIntakeReviewed,
  submitPatientIntake,
  type PatientIntakeRecord,
} from './patientIntakes';

function formatSubmittedAt(value: string): string {
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function IntakeStatus({ record }: { record: PatientIntakeRecord }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${record.status === 'reviewed'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
      : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'}`}>
      {record.status === 'reviewed' ? 'تمت المراجعة' : 'بانتظار مراجعة الطبيب'}
    </span>
  );
}

function IntakeAnswersSummary({ answers }: { answers: IntakeAnswers }) {
  const conditions = answers.conditions.map((item) => item.label);
  return (
    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
      {answers.heightCm != null && <div><dt className="text-[11px] text-slate-500">الطول</dt><dd className="text-sm font-bold">{answers.heightCm} سم</dd></div>}
      {answers.startWeight != null && <div><dt className="text-[11px] text-slate-500">الوزن الحالي عند الإرسال</dt><dd className="text-sm font-bold">{answers.startWeight} كجم</dd></div>}
      {answers.targetWeight != null && <div><dt className="text-[11px] text-slate-500">الوزن المستهدف</dt><dd className="text-sm font-bold">{answers.targetWeight} كجم</dd></div>}
      {answers.targetWaist != null && <div><dt className="text-[11px] text-slate-500">محيط الوسط المستهدف</dt><dd className="text-sm font-bold">{answers.targetWaist} سم</dd></div>}
      {conditions.length > 0 && <div className="sm:col-span-2"><dt className="text-[11px] text-slate-500">حالات أفاد المريض بتشخيصها</dt><dd className="text-sm font-bold">{conditions.join('، ')}</dd></div>}
      {answers.allergies.length > 0 && <div className="sm:col-span-2"><dt className="text-[11px] text-slate-500">الحساسية أو محظورات الطعام</dt><dd className="text-sm font-bold">{answers.allergies.join('، ')}</dd></div>}
      {answers.medicationsText.trim() && <div className="sm:col-span-2"><dt className="text-[11px] text-slate-500">الأدوية الحالية كما أدخلها المريض</dt><dd className="whitespace-pre-wrap text-sm">{answers.medicationsText}</dd></div>}
      {answers.sleepHours != null && <div><dt className="text-[11px] text-slate-500">متوسط النوم</dt><dd className="text-sm font-bold">{answers.sleepHours} ساعة</dd></div>}
      {answers.activityLevel && <div><dt className="text-[11px] text-slate-500">مستوى النشاط</dt><dd className="text-sm font-bold">{answers.activityLevel === 'low' ? 'منخفض' : answers.activityLevel === 'moderate' ? 'متوسط' : 'عالٍ'}</dd></div>}
      {answers.fastingType && answers.fastingType !== 'none' && <div><dt className="text-[11px] text-slate-500">نمط الصيام</dt><dd className="text-sm font-bold">{answers.fastingType === 'intermittent' ? 'متقطع' : answers.fastingType === 'islamic' ? 'إسلامي' : 'مسيحي'}</dd></div>}
      {answers.goal?.trim() && <div className="sm:col-span-2"><dt className="text-[11px] text-slate-500">الهدف الذي ذكره المريض</dt><dd className="text-sm">{answers.goal}</dd></div>}
      {answers.notes?.trim() && <div className="sm:col-span-2"><dt className="text-[11px] text-slate-500">ملاحظات للمختص</dt><dd className="whitespace-pre-wrap text-sm">{answers.notes}</dd></div>}
    </dl>
  );
}

function PatientIntakeForm({
  patientUid,
  clinicId,
  clientName,
  onSubmitted,
}: {
  patientUid: string;
  clinicId: string;
  clientName: string;
  onSubmitted: (record: PatientIntakeRecord) => void;
}) {
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [targetWaist, setTargetWaist] = useState('');
  const [selectedConditions, setSelectedConditions] = useState<ConditionItem[]>([]);
  const [allergyText, setAllergyText] = useState('');
  const [medicationsText, setMedicationsText] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [activityLevel, setActivityLevel] = useState<IntakeAnswers['activityLevel']>('');
  const [fastingType, setFastingType] = useState<IntakeAnswers['fastingType']>('none');
  const [goal, setGoal] = useState('');
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCondition = (id: string, label: string) => {
    setSelectedConditions((current) => current.some((item) => item.id === id)
      ? current.filter((item) => item.id !== id)
      : [...current, { id, label, severity: 'moderate' }]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const toNumber = (value: string) => value.trim() ? Number(value) : null;
    const answers: IntakeAnswers = {
      clientName: clientName.trim(),
      heightCm: toNumber(height),
      startWeight: toNumber(weight),
      targetWeight: toNumber(targetWeight),
      targetWaist: toNumber(targetWaist),
      conditions: selectedConditions,
      allergies: splitPatientIntakeList(allergyText),
      medicationsText: medicationsText.trim(),
      sleepHours: toNumber(sleepHours),
      activityLevel,
      fastingType,
      goal: goal.trim(),
      notes: notes.trim(),
    };
    const validationError = validatePatientIntakeAnswers(answers);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!consent) {
      setError('يجب الموافقة على مشاركة الإجابات مع فريق العيادة قبل الإرسال.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const record = await submitPatientIntake({ clinicId, patientUid, answers });
      onSubmitted(record);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر إرسال الاستبيان.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
  const labelClass = 'mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300';

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-4 flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="patient-intake-height">الطول (سم)</label>
          <input id="patient-intake-height" type="number" min="60" max="250" step="0.1" value={height} onChange={(event) => setHeight(event.target.value)} className={inputClass} placeholder="170" />
        </div>
        <div>
          <label className={labelClass} htmlFor="patient-intake-weight">الوزن الحالي (كجم)</label>
          <input id="patient-intake-weight" type="number" min="20" max="400" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} className={inputClass} placeholder="85" />
        </div>
        <div>
          <label className={labelClass} htmlFor="patient-intake-target-weight">الوزن المستهدف (كجم)</label>
          <input id="patient-intake-target-weight" type="number" min="20" max="400" step="0.1" value={targetWeight} onChange={(event) => setTargetWeight(event.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="patient-intake-waist">محيط الوسط المستهدف (سم)</label>
          <input id="patient-intake-waist" type="number" min="25" max="250" step="0.1" value={targetWaist} onChange={(event) => setTargetWaist(event.target.value)} className={inputClass} />
        </div>
      </div>

      <fieldset className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <legend className="px-1 text-xs font-bold text-slate-700 dark:text-slate-300">حالات أفادك الطبيب بتشخيصها</legend>
        <p className="mb-3 text-[11px] text-slate-500">هذا اختيار لما تم تشخيصه مسبقًا، وليس أداة لتشخيص الأمراض.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {SUPPORTED_CONDITIONS.map((condition) => (
            <label key={condition.id} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={selectedConditions.some((item) => item.id === condition.id)}
                onChange={() => toggleCondition(condition.id, condition.label)}
                className="mt-0.5"
              />
              <span>{condition.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="patient-intake-allergies">حساسية أو أطعمة تتجنبها</label>
          <input id="patient-intake-allergies" value={allergyText} onChange={(event) => setAllergyText(event.target.value)} maxLength={1000} className={inputClass} placeholder="جلوتين، لاكتوز" />
        </div>
        <div>
          <label className={labelClass} htmlFor="patient-intake-sleep">متوسط ساعات النوم يوميًا</label>
          <input id="patient-intake-sleep" type="number" min="0" max="24" step="0.5" value={sleepHours} onChange={(event) => setSleepHours(event.target.value)} className={inputClass} placeholder="7" />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="patient-intake-medications">الأدوية الحالية (دواء واحد في كل سطر، مع الجرعة إن عُرفت)</label>
        <textarea id="patient-intake-medications" value={medicationsText} onChange={(event) => setMedicationsText(event.target.value)} rows={4} maxLength={2000} className={inputClass} placeholder={'اسم الدواء - الجرعة\nاسم دواء آخر'} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="patient-intake-activity">مستوى النشاط اليومي</label>
          <select id="patient-intake-activity" value={activityLevel} onChange={(event) => setActivityLevel(event.target.value as IntakeAnswers['activityLevel'])} className={inputClass}>
            <option value="">اختر…</option>
            <option value="low">منخفض (عمل مكتبي)</option>
            <option value="moderate">متوسط (حركة يومية)</option>
            <option value="high">عالٍ (رياضة منتظمة)</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="patient-intake-fasting">نمط الصيام (إن وُجد)</label>
          <select id="patient-intake-fasting" value={fastingType} onChange={(event) => setFastingType(event.target.value as IntakeAnswers['fastingType'])} className={inputClass}>
            <option value="none">بدون صيام</option>
            <option value="intermittent">صيام متقطع</option>
            <option value="islamic">صيام إسلامي</option>
            <option value="christian">صيام مسيحي</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="patient-intake-goal">هدفك الأساسي</label>
        <input id="patient-intake-goal" value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={500} className={inputClass} placeholder="مثال: تحسين العادات الغذائية" />
      </div>

      <div>
        <label className={labelClass} htmlFor="patient-intake-notes">ملاحظات إضافية للطبيب</label>
        <textarea id="patient-intake-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={4} className={inputClass} />
      </div>

      <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1" />
        <span>أوافق على مشاركة هذه الإجابات الصحية والغذائية مع فريق عيادتي لمراجعتها ومتابعة حالتي. أعلم أنها لن تتحول تلقائيًا إلى خطة علاج أو توصية، وأن الطبيب سيراجعها قبل أي تعديل في خطتي.</span>
      </label>

      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
      <button type="submit" disabled={saving || !consent} className="rounded-xl bg-sky-700 px-4 py-3 text-sm font-black text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50">
        {saving ? 'جارٍ إرسال الاستبيان…' : 'إرسال الاستبيان إلى العيادة'}
      </button>
    </form>
  );
}

export function PatientIntakeSection({
  patientUid,
  clinicId,
  clientName,
  isStaffView,
}: {
  patientUid: string;
  clinicId: string;
  clientName: string;
  isStaffView: boolean;
}) {
  const [records, setRecords] = useState<PatientIntakeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listPatientIntakes(patientUid)
      .then((rows) => {
        if (!active) return;
        setRecords(rows);
        setError(null);
        if (!isStaffView && rows.length === 0) setShowForm(true);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'تعذّر تحميل الاستبيانات.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [patientUid, isStaffView]);

  const handleSubmitted = (record: PatientIntakeRecord) => {
    setRecords((current) => [record, ...current].slice(0, 5));
    setShowForm(false);
  };

  const review = async (record: PatientIntakeRecord) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await markPatientIntakeReviewed(record.id);
      setRecords((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّرت مراجعة الاستبيان.');
    } finally {
      setSaving(false);
    }
  };

  const latest = records[0] ?? null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
            {isStaffView ? 'استبيان الحالة الغذائية والصحية' : 'استبياني الصحي والغذائي'}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {isStaffView
              ? 'الإجابات كما أرسلها المريض؛ المراجعة لا تغيّر الخطة النشطة.'
              : 'أرسل بياناتك إلى فريق العيادة. يمكنك إرسال تحديث جديد عند تغيّر معلوماتك.'}
          </p>
        </div>
        {!isStaffView && latest && (
          <button type="button" onClick={() => setShowForm((open) => !open)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">
            {showForm ? 'إخفاء النموذج' : 'إرسال تحديث'}
          </button>
        )}
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-slate-500">جارٍ تحميل الاستبيان…</p>
      ) : error && records.length === 0 ? (
        <p role="alert" className="mt-3 text-sm font-bold text-rose-600">{error}</p>
      ) : (
        <>
          {!isStaffView && latest && !showForm && (
            <div className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-500">آخر إرسال: {formatSubmittedAt(latest.submitted_at)}</span>
                <IntakeStatus record={latest} />
              </div>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                {latest.status === 'reviewed'
                  ? 'راجع فريق العيادة إجاباتك.'
                  : 'وصل الاستبيان إلى العيادة وينتظر مراجعة الطبيب.'}
              </p>
            </div>
          )}

          {isStaffView && records.length === 0 && (
            <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700">
              لم يرسل المريض استبيانًا بعد.
            </div>
          )}

          {isStaffView && records.map((record) => (
            <article key={record.id} className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-500">تاريخ الإرسال: {formatSubmittedAt(record.submitted_at)}</span>
                <IntakeStatus record={record} />
              </div>
              <IntakeAnswersSummary answers={record.answers} />
              {record.status === 'submitted' && (
                <button
                  type="button"
                  onClick={() => void review(record)}
                  disabled={saving}
                  className="mt-3 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {saving ? 'جارٍ تسجيل المراجعة…' : 'تسجيل: تمت المراجعة'}
                </button>
              )}
            </article>
          ))}

          {!isStaffView && showForm && (
            <PatientIntakeForm
              patientUid={patientUid}
              clinicId={clinicId}
              clientName={clientName}
              onSubmitted={handleSubmitted}
            />
          )}

          {error && <p role="alert" className="mt-3 text-xs font-bold text-rose-600">{error}</p>}
        </>
      )}
    </section>
  );
}
