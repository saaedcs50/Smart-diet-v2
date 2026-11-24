import { getSupabase } from './supabase';
import type { IntakeAnswers } from '../utils/intake';
import type { PlanConfig } from '../types';
import { planFromDatabase } from './database';
import { validatePatientIntakeAnswers } from './patientIntakeUtils';

export const PATIENT_INTAKE_CONSENT_VERSION = 'patient-intake-v1-2026-11-22';

export interface PatientIntakeRecord {
  id: string;
  clinic_id: string;
  patient_id: string;
  submitted_by: string;
  answers: IntakeAnswers;
  consent_version: string;
  consented_at: string;
  status: 'submitted' | 'reviewed';
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface PatientIntakeDraftRecord {
  intake_id: string;
  patient_id?: string;
  draft_plan: PlanConfig;
  status: 'draft' | 'approved';
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  base_plan_updated_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
}

export interface PatientIntakeDraftCreateResult {
  draft: PatientIntakeDraftRecord;
  created: boolean;
}

const INTAKE_DRAFT_COLUMNS = [
  'intake_id',
  'draft_plan',
  'status',
  'created_by',
  'updated_by',
  'created_at',
  'updated_at',
  'base_plan_updated_at',
  'approved_at',
  'approved_by',
].join(',');

const INTAKE_COLUMNS = [
  'id',
  'clinic_id',
  'patient_id',
  'submitted_by',
  'answers',
  'consent_version',
  'consented_at',
  'status',
  'submitted_at',
  'reviewed_at',
  'reviewed_by',
].join(',');

export async function listPatientIntakes(patientUid: string): Promise<PatientIntakeRecord[]> {
  if (!patientUid.trim()) throw new Error('معرّف المريض غير صالح.');
  const { data, error } = await getSupabase()
    .from('patient_intakes')
    .select(INTAKE_COLUMNS)
    .eq('patient_id', patientUid)
    .order('submitted_at', { ascending: false })
    .limit(5);

  if (error) throw new Error(`تعذّر تحميل الاستبيان: ${error.message}`);
  return (data ?? []) as unknown as PatientIntakeRecord[];
}

export async function listPatientIntakeDrafts(
  intakeIds: string[],
): Promise<PatientIntakeDraftRecord[]> {
  const ids = [...new Set(intakeIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return [];

  const { data, error } = await getSupabase()
    .from('patient_intake_drafts')
    .select(INTAKE_DRAFT_COLUMNS)
    .in('intake_id', ids);

  if (error) throw new Error(`تعذّر تحميل مسودات الاستبيان: ${error.message}`);
  return (data ?? []) as unknown as PatientIntakeDraftRecord[];
}

/**
 * Create at most one draft per intake. Repeated clicks return the existing
 * draft instead of overwriting a clinician's work or an approved version.
 */
export async function createPatientIntakeDraft(input: {
  intakeId: string;
  draftPlan: PlanConfig;
  basePlanUpdatedAt: string | null;
}): Promise<PatientIntakeDraftCreateResult> {
  const intakeId = input.intakeId.trim();
  if (!intakeId) throw new Error('معرّف الاستبيان غير صالح.');

  let serialized: string;
  try {
    serialized = JSON.stringify(input.draftPlan);
  } catch {
    throw new Error('تعذّر تجهيز مسودة الخطة.');
  }
  if (!input.draftPlan || typeof input.draftPlan !== 'object' || serialized.length === 0) {
    throw new Error('بيانات مسودة الخطة غير صالحة.');
  }
  if (new TextEncoder().encode(serialized).byteLength > 262144) {
    throw new Error('حجم مسودة الخطة أكبر من الحد المسموح.');
  }

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw new Error('تعذّر التحقق من حساب الطبيب.');
  if (!user) throw new Error('يجب تسجيل الدخول بحساب العيادة أولًا.');

  const { data: existing, error: existingError } = await supabase
    .from('patient_intake_drafts')
    .select(INTAKE_DRAFT_COLUMNS)
    .eq('intake_id', intakeId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`تعذّر التحقق من وجود مسودة سابقة: ${existingError.message}`);
  }
  if (existing) return { draft: existing as unknown as PatientIntakeDraftRecord, created: false };

  const { data, error } = await supabase
    .from('patient_intake_drafts')
    .insert({ intake_id: intakeId, draft_plan: input.draftPlan, base_plan_updated_at: input.basePlanUpdatedAt })
    .select(INTAKE_DRAFT_COLUMNS)
    .single();

  if (!error && data) return { draft: data as unknown as PatientIntakeDraftRecord, created: true };

  // An admin and the assigned coach may click at the same time. The unique
  // intake_id constraint keeps one draft; return that winner without overwriting it.
  if (error?.code === '23505') {
    const { data: winner, error: winnerError } = await supabase
      .from('patient_intake_drafts')
      .select(INTAKE_DRAFT_COLUMNS)
      .eq('intake_id', intakeId)
      .maybeSingle();
    if (!winnerError && winner) return { draft: winner as unknown as PatientIntakeDraftRecord, created: false };
  }

  throw new Error(`تعذّر إنشاء مسودة الخطة: ${error?.message ?? 'لم تُرجع قاعدة البيانات سجلًا محفوظًا.'}`);
}

export async function updatePatientIntakeDraft(input: {
  intakeId: string;
  draftPlan: PlanConfig;
}): Promise<PatientIntakeDraftRecord> {
  const intakeId = input.intakeId.trim();
  if (!intakeId) throw new Error('معرّف الاستبيان غير صالح.');

  let serialized: string;
  try {
    serialized = JSON.stringify(input.draftPlan);
  } catch {
    throw new Error('تعذّر تجهيز مسودة الخطة.');
  }
  if (!input.draftPlan || typeof input.draftPlan !== 'object' || serialized.length === 0) {
    throw new Error('بيانات مسودة الخطة غير صالحة.');
  }
  if (new TextEncoder().encode(serialized).byteLength > 262144) {
    throw new Error('حجم مسودة الخطة أكبر من الحد المسموح.');
  }

  const supabase = getSupabase();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('يجب تسجيل الدخول بحساب العيادة أولًا.');

  const { data, error } = await supabase
    .from('patient_intake_drafts')
    .update({
      draft_plan: input.draftPlan,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq('intake_id', intakeId)
    .eq('status', 'draft')
    .select(INTAKE_DRAFT_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(`تعذّر حفظ مسودة الخطة: ${error.message}`);
  if (!data) throw new Error('لم تُحفظ المسودة؛ ربما اعتُمدت بالفعل أو لا تملك صلاحية تعديلها.');
  return data as unknown as PatientIntakeDraftRecord;
}

export interface PatientIntakeDraftApproval {
  plan: PlanConfig;
  approvedAt: string;
  approvedBy: string;
  patientId: string;
}

export async function approvePatientIntakeDraft(
  intakeId: string,
  expectedPatientUid?: string,
): Promise<PatientIntakeDraftApproval> {
  const normalizedId = intakeId.trim();
  if (!normalizedId) throw new Error('معرّف الاستبيان غير صالح.');

  const supabase = getSupabase();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('يجب تسجيل الدخول بحساب العيادة أولًا.');

  if (expectedPatientUid) {
    const { data: intake, error: intakeError } = await supabase
      .from('patient_intakes')
      .select('patient_id')
      .eq('id', normalizedId)
      .maybeSingle();
    if (intakeError || !intake || intake.patient_id !== expectedPatientUid) {
      throw new Error('تغيّر ملف المريض المرتبط بالاستبيان أو لم يعد متاحًا؛ أعد تحميل الملف قبل الاعتماد.');
    }
  }

  const { data, error } = await supabase.rpc(
    'approve_patient_intake_draft',
    { p_intake_id: normalizedId },
  );
  if (error) {
    const message = error.message ?? '';
    if (message.includes('ACTIVE_PLAN_CHANGED_REBUILD_DRAFT')) {
      throw new Error('تغيرت الخطة السارية بعد إنشاء المسودة. أنشئ مسودة جديدة من الخطة الحالية قبل الاعتماد.');
    }
    if (message.includes('INTAKE_REVIEW_REQUIRED') || message.includes('راجع استبيان المريض')) {
      throw new Error('سجّل مراجعة الاستبيان أولًا قبل اعتماد الخطة.');
    }
    if (message.includes('DRAFT_ALREADY_APPROVED_OR_LOCKED') || message.includes('سبق اعتمادها')) {
      throw new Error('هذه المسودة اعتُمدت بالفعل ولا يمكن اعتمادها مرة أخرى.');
    }
    if (message.includes('MEDICATION_FREQUENCY_REQUIRED') || message.includes('MEDICATION_TIMINGS_INCOMPLETE')) {
      throw new Error('أكمل عدد مرات تناول كل دواء وجميع مواعيده قبل الاعتماد.');
    }
    if (message.includes('MEDICATION_NAME_AND_DOSE_REQUIRED') || message.includes('أكمل اسم كل دواء')) {
      throw new Error('أكمل اسم كل دواء والجرعة كما وردت في الوصفة قبل الاعتماد.');
    }
    if (message.includes('MEDICATION_TIMING_SLOT_INVALID')) {
      throw new Error('اختر موعدًا صالحًا لكل جرعة دواء من قائمة المواعيد.');
    }
    throw new Error(`تعذّر اعتماد الخطة: ${message || 'رفضت قاعدة البيانات الطلب.'}`);
  }

  const payload = data as {
    plan?: unknown;
    draft_plan?: unknown;
    approvedAt?: unknown;
    approved_at?: unknown;
    approvedBy?: unknown;
    approved_by?: unknown;
    patient_id?: unknown;
  } | null;
  const plan = planFromDatabase(payload?.draft_plan ?? payload?.plan);
  const approvedAt = payload?.approved_at ?? payload?.approvedAt;
  const approvedBy = payload?.approved_by ?? payload?.approvedBy;
  const approvedPatientId = payload?.patient_id ?? payload?.patientId;
  if (
    !plan ||
    typeof approvedAt !== 'string' ||
    typeof approvedBy !== 'string' ||
    typeof approvedPatientId !== 'string' ||
    (expectedPatientUid && approvedPatientId !== expectedPatientUid)
  ) {
    throw new Error('لم تُرجع قاعدة البيانات بيانات اعتماد صالحة لهذا المريض؛ لم يتم تحديث واجهة المريض.');
  }
  return { plan, approvedAt, approvedBy, patientId: approvedPatientId };
}

export async function submitPatientIntake(input: {
  clinicId: string;
  patientUid: string;
  answers: IntakeAnswers;
}): Promise<PatientIntakeRecord> {
  if (!input.clinicId.trim() || !input.patientUid.trim()) {
    throw new Error('بيانات العيادة أو المريض غير صالحة.');
  }
  const validationError = validatePatientIntakeAnswers(input.answers);
  if (validationError) throw new Error(validationError);

  const { data, error } = await getSupabase()
    .from('patient_intakes')
    .insert({
      clinic_id: input.clinicId,
      patient_id: input.patientUid,
      answers: input.answers,
      consent_version: PATIENT_INTAKE_CONSENT_VERSION,
    })
    .select(INTAKE_COLUMNS)
    .single();

  if (error) throw new Error(`تعذّر إرسال الاستبيان: ${error.message}`);
  if (!data) throw new Error('لم تُحفظ إجابات الاستبيان.');
  return data as unknown as PatientIntakeRecord;
}

export async function markPatientIntakeReviewed(intakeId: string): Promise<PatientIntakeRecord> {
  if (!intakeId.trim()) throw new Error('معرّف الاستبيان غير صالح.');
  const {
    data: { user },
    error: userError,
  } = await getSupabase().auth.getUser();
  if (userError) throw new Error('تعذّر التحقق من حساب المراجع.');
  if (!user) throw new Error('يجب تسجيل الدخول أولًا.');

  const { data, error } = await getSupabase()
    .from('patient_intakes')
    .update({
      status: 'reviewed',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq('id', intakeId)
    .eq('status', 'submitted')
    .select(INTAKE_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(`تعذّرت إتمام المراجعة: ${error.message}`);
  if (!data) throw new Error('لم يُحدّث الاستبيان؛ ربما تمت مراجعته بالفعل أو لا تملك صلاحية الوصول إليه.');
  return data as unknown as PatientIntakeRecord;
}
