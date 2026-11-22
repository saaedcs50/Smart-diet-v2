import { getSupabase } from './supabase';
import { normalizeStaffTaskTitle } from './staffTaskUtils';

export type StaffTaskPriority = 'low' | 'normal' | 'high';
export type StaffTaskStatus = 'open' | 'in_progress' | 'completed';

export interface StaffTask {
  id: string;
  clinic_id: string;
  user_id: string;
  title: string;
  due_on: string | null;
  priority: StaffTaskPriority;
  status: StaffTaskStatus;
  created_at: string;
  updated_at: string;
}

const TASK_COLUMNS = [
  'id',
  'clinic_id',
  'user_id',
  'title',
  'due_on',
  'priority',
  'status',
  'created_at',
  'updated_at',
].join(',');

export async function listStaffTasks(clinicId: string, userId: string): Promise<StaffTask[]> {
  if (!clinicId.trim() || !userId.trim()) throw new Error('بيانات العيادة أو المستخدم غير صالحة.');
  const { data, error } = await getSupabase()
    .from('clinic_tasks')
    .select(TASK_COLUMNS)
    .eq('clinic_id', clinicId)
    .eq('user_id', userId)
    .order('due_on', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(`تعذّر تحميل المهام: ${error.message}`);
  return (data ?? []) as unknown as StaffTask[];
}

export async function createStaffTask(input: {
  clinicId: string;
  userId: string;
  title: string;
  dueOn: string | null;
  priority: StaffTaskPriority;
}): Promise<StaffTask> {
  const title = normalizeStaffTaskTitle(input.title);
  const { data, error } = await getSupabase()
    .from('clinic_tasks')
    .insert({
      clinic_id: input.clinicId,
      user_id: input.userId,
      title,
      due_on: input.dueOn || null,
      priority: input.priority,
    })
    .select(TASK_COLUMNS)
    .single();

  if (error) throw new Error(`تعذّر حفظ المهمة: ${error.message}`);
  if (!data) throw new Error('لم تُرجع قاعدة البيانات المهمة المحفوظة.');
  return data as unknown as StaffTask;
}

export async function updateStaffTaskStatus(
  taskId: string,
  status: StaffTaskStatus,
): Promise<void> {
  const { error } = await getSupabase()
    .from('clinic_tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', taskId);

  if (error) throw new Error(`تعذّر تحديث المهمة: ${error.message}`);
}
