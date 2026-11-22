import { getSupabase } from './supabase';
import {
  normalizePatientReflectionDraft,
  type PatientReflectionDraft,
} from './patientReflectionUtils';

export interface PatientReflectionRecord {
  id: string;
  clinic_id: string;
  patient_id: string;
  entry_date: string;
  content: string;
  mood: number | null;
  symptoms: string;
  visibility: 'private' | 'shared';
  created_by: string;
  created_at: string;
  updated_at: string;
}

const REFLECTION_COLUMNS = [
  'id',
  'clinic_id',
  'patient_id',
  'entry_date',
  'content',
  'mood',
  'symptoms',
  'visibility',
  'created_by',
  'created_at',
  'updated_at',
].join(',');

async function requireOwnPatientSession(patientUid: string): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error('يجب تسجيل الدخول أولًا.');
  if (user.id !== patientUid) throw new Error('اليوميات متاحة لصاحب الحساب فقط.');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, disabled')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) throw new Error('تعذّر التحقق من حساب المريض.');
  if (!profile || profile.disabled || profile.role !== 'patient') {
    throw new Error('إنشاء اليوميات متاح لحساب المريض فقط.');
  }
}

export async function listPatientReflections(
  patientUid: string,
  isStaffView: boolean,
): Promise<PatientReflectionRecord[]> {
  if (!patientUid.trim()) throw new Error('معرّف المريض غير صالح.');
  let query = getSupabase()
    .from('patient_reflections')
    .select(REFLECTION_COLUMNS)
    .eq('patient_id', patientUid);
  if (isStaffView) query = query.eq('visibility', 'shared');

  const { data, error } = await query
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new Error(`تعذّر تحميل اليوميات: ${error.message}`);
  return (data ?? []) as unknown as PatientReflectionRecord[];
}

export async function createPatientReflection(input: {
  clinicId: string;
  patientUid: string;
  draft: PatientReflectionDraft;
}): Promise<PatientReflectionRecord> {
  if (!input.clinicId.trim() || !input.patientUid.trim()) {
    throw new Error('بيانات العيادة أو المريض غير صالحة.');
  }
  const draft = normalizePatientReflectionDraft(input.draft);
  await requireOwnPatientSession(input.patientUid);
  const { data, error } = await getSupabase()
    .from('patient_reflections')
    .insert({
      clinic_id: input.clinicId,
      patient_id: input.patientUid,
      entry_date: draft.entryDate,
      content: draft.content,
      mood: draft.mood,
      symptoms: draft.symptoms,
      visibility: draft.visibility,
    })
    .select(REFLECTION_COLUMNS)
    .single();

  if (error) throw new Error(`تعذّر حفظ اليوميات: ${error.message}`);
  if (!data) throw new Error('لم تُحفظ اليوميات.');
  return data as unknown as PatientReflectionRecord;
}

export async function deletePatientReflection(input: {
  patientUid: string;
  reflectionId: string;
}): Promise<void> {
  if (!input.patientUid.trim() || !input.reflectionId.trim()) {
    throw new Error('بيانات اليوميات غير صالحة.');
  }
  await requireOwnPatientSession(input.patientUid);
  const { data, error } = await getSupabase()
    .from('patient_reflections')
    .delete()
    .eq('id', input.reflectionId)
    .eq('patient_id', input.patientUid)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(`تعذّر حذف اليوميات: ${error.message}`);
  if (!data) throw new Error('لم تُحذف اليوميات؛ ربما لم تعد موجودة.');
}
