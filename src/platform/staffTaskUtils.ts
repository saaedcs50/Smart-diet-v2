export type StaffTaskStatus = 'open' | 'in_progress' | 'completed';

export function normalizeStaffTaskTitle(value: string): string {
  const title = value.trim().replace(/\s+/g, ' ');
  if (!title) throw new Error('اكتب عنوان المهمة أولًا.');
  if (title.length > 140) throw new Error('عنوان المهمة يجب ألا يزيد عن 140 حرفًا.');
  return title;
}

export function isStaffTaskOverdue(
  dueOn: string | null,
  status: StaffTaskStatus,
  today: string,
): boolean {
  return dueOn !== null && dueOn < today && status !== 'completed';
}

export function countStaffTasksByStatus<T extends { status: StaffTaskStatus }>(tasks: T[]) {
  return tasks.reduce(
    (counts, task) => {
      counts[task.status] += 1;
      return counts;
    },
    { open: 0, in_progress: 0, completed: 0 },
  );
}
