import { getSupabase } from './supabase';
import type {
  AppointmentChannel,
  AppointmentStatus,
  AppointmentVisitType,
} from './appointmentUtils';

export interface AppointmentRecord {
  id: string;
  clinic_id: string;
  patient_id: string;
  provider_id: string;
  created_by: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  visit_type: AppointmentVisitType;
  channel: AppointmentChannel;
  created_at: string;
  updated_at: string;
}

export interface CreateAppointmentInput {
  clinic_id: string;
  patient_id: string;
  provider_id: string;
  created_by: string;
  starts_at: string;
  ends_at: string;
  visit_type: AppointmentVisitType;
  channel: AppointmentChannel;
}

export type AppointmentUpdate = Partial<Pick<
  AppointmentRecord,
  'provider_id' | 'starts_at' | 'ends_at' | 'status' | 'visit_type' | 'channel'
>>;

const APPOINTMENT_COLUMNS = [
  'id',
  'clinic_id',
  'patient_id',
  'provider_id',
  'created_by',
  'starts_at',
  'ends_at',
  'status',
  'visit_type',
  'channel',
  'created_at',
  'updated_at',
].join(',');

export async function listAppointments(
  fromInclusive: string,
  toExclusive: string,
): Promise<AppointmentRecord[]> {
  if (new Date(fromInclusive).getTime() >= new Date(toExclusive).getTime()) {
    throw new Error('نطاق التاريخ المطلوب غير صالح.');
  }
  const { data, error } = await getSupabase()
    .from('appointments')
    .select(APPOINTMENT_COLUMNS)
    .gte('starts_at', fromInclusive)
    .lt('starts_at', toExclusive)
    .order('starts_at', { ascending: true });

  if (error) throw new Error(`تعذّر تحميل المواعيد: ${error.message}`);
  return (data ?? []) as unknown as AppointmentRecord[];
}

export async function createAppointment(
  input: CreateAppointmentInput,
): Promise<AppointmentRecord> {
  const { data, error } = await getSupabase()
    .from('appointments')
    .insert(input)
    .select(APPOINTMENT_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('لم تُحفظ بيانات الموعد.');
  return data as unknown as AppointmentRecord;
}

export async function updateAppointment(
  id: string,
  changes: AppointmentUpdate,
): Promise<AppointmentRecord> {
  if (!id) throw new Error('معرّف الموعد غير صالح.');
  const { data, error } = await getSupabase()
    .from('appointments')
    .update(changes)
    .eq('id', id)
    .select(APPOINTMENT_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('لم يُحدّث الموعد. قد لا تملك صلاحية الوصول إليه أو أنه لم يعد موجودًا.');
  return data as unknown as AppointmentRecord;
}
