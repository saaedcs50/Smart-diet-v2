import { getSupabase } from './supabase';

export interface PatientJournalComment {
  id: string;
  clinic_id: string;
  patient_id: string;
  log_date: string;
  content: string;
  created_by: string;
  created_at: string;
}

const COMMENT_COLUMNS = [
  'id',
  'clinic_id',
  'patient_id',
  'log_date',
  'content',
  'created_by',
  'created_at',
].join(',');

export function normalizePatientJournalComment(value: string): string {
  const content = String(value ?? '').trim();
  if (!content) throw new Error('اكتب الملاحظة قبل حفظها.');
  if (content.length > 1200) throw new Error('الملاحظة يجب ألا تزيد عن 1200 حرف.');
  return content;
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function listPatientJournalComments(
  patientUid: string,
): Promise<PatientJournalComment[]> {
  if (!patientUid.trim()) throw new Error('معرّف المريض غير صالح.');
  const { data, error } = await getSupabase()
    .from('patient_log_comments')
    .select(COMMENT_COLUMNS)
    .eq('patient_id', patientUid)
    .order('log_date', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) throw new Error(`تعذّر تحميل ملاحظات العيادة: ${error.message}`);
  return (data ?? []) as unknown as PatientJournalComment[];
}

export async function createPatientJournalComment(input: {
  clinicId: string;
  patientUid: string;
  logDate: string;
  content: string;
}): Promise<PatientJournalComment> {
  if (!input.clinicId.trim() || !input.patientUid.trim()) {
    throw new Error('بيانات المريض أو العيادة غير صالحة.');
  }
  if (!isDateKey(input.logDate)) throw new Error('تاريخ السجل غير صالح.');
  const content = normalizePatientJournalComment(input.content);
  const supabase = getSupabase();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('يجب تسجيل الدخول قبل إضافة ملاحظة.');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, disabled')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) throw new Error('تعذّر التحقق من صلاحيات حسابك.');
  if (!profile || profile.disabled || !['admin', 'coach'].includes(profile.role)) {
    throw new Error('إضافة ملاحظات المتابعة متاحة لطاقم العيادة فقط.');
  }

  const { data, error } = await supabase
    .from('patient_log_comments')
    .insert({
      clinic_id: input.clinicId,
      patient_id: input.patientUid,
      log_date: input.logDate,
      content,
    })
    .select(COMMENT_COLUMNS)
    .single();

  if (error) throw new Error(`تعذّر حفظ ملاحظة المتابعة: ${error.message}`);
  if (!data) throw new Error('لم تُحفظ الملاحظة.');
  return data as unknown as PatientJournalComment;
}
