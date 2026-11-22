import { getSupabase } from './supabase';
import type { IntakeAnswers } from '../utils/intake';

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

export async function submitPatientIntake(input: {
  clinicId: string;
  patientUid: string;
  answers: IntakeAnswers;
}): Promise<PatientIntakeRecord> {
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
