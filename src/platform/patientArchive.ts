import { getSupabase } from './supabase';

export interface PatientArchiveStatus {
  archivedAt: string | null;
  archivedBy: string | null;
}

/**
 * Archives or restores one patient record without deleting any patient data.
 * Supabase RLS remains the final clinic/assignment authorization boundary.
 */
export async function setPatientArchiveStatus(input: {
  patientUid: string;
  clinicId: string;
  archived: boolean;
}): Promise<PatientArchiveStatus> {
  if (!input.patientUid.trim() || !input.clinicId.trim()) {
    throw new Error('بيانات المريض أو العيادة غير صالحة.');
  }

  const supabase = getSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('يجب تسجيل الدخول قبل تغيير حالة الملف.');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, disabled, clinic_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw new Error('تعذّر التحقق من صلاحيات حسابك.');
  if (
    !profile ||
    profile.disabled ||
    !['admin', 'coach'].includes(profile.role) ||
    profile.clinic_id !== input.clinicId
  ) {
    throw new Error('أرشفة الملفات متاحة لطاقم العيادة المخوّل فقط.');
  }

  const patch = input.archived
    ? { archived_at: new Date().toISOString(), archived_by: user.id }
    : { archived_at: null, archived_by: null };

  const { data, error } = await supabase
    .from('patients')
    .update(patch)
    .eq('id', input.patientUid)
    .eq('clinic_id', input.clinicId)
    .select('archived_at, archived_by')
    .maybeSingle();

  if (error) throw new Error(`تعذّر تحديث حالة الملف: ${error.message}`);
  if (!data) throw new Error('لم تتغير حالة الملف؛ ربما لا تملك صلاحية الوصول إليه.');
  return {
    archivedAt: data.archived_at ?? null,
    archivedBy: data.archived_by ?? null,
  };
}
