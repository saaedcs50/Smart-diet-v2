import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  countStaffTasksByStatus,
  isStaffTaskOverdue,
  type StaffTaskStatus,
} from './staffTaskUtils';
import {
  createStaffTask,
  listStaffTasks,
  updateStaffTaskStatus,
  type StaffTask,
  type StaffTaskPriority,
  type StaffTaskRole,
} from './staffTasks';

type TaskFilter = 'all' | 'open' | 'in_progress' | 'completed';

function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatTaskDate(value: string): string {
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

const priorityLabels: Record<StaffTaskPriority, string> = {
  low: 'منخفضة',
  normal: 'عادية',
  high: 'عاجلة',
};

const statusLabels: Record<StaffTaskStatus, string> = {
  open: 'مفتوحة',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتملة',
};

export interface StaffTaskStaffOption {
  uid: string;
  label: string;
}

export function StaffTasksSection({
  clinicId,
  userId,
  role,
  staff = [],
}: {
  clinicId: string;
  userId: string;
  role: StaffTaskRole;
  staff?: StaffTaskStaffOption[];
}) {
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [title, setTitle] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [priority, setPriority] = useState<StaffTaskPriority>('normal');
  const [assignedTo, setAssignedTo] = useState(userId);
  const staffLabels = useMemo(() => new Map(staff.map((person) => [person.uid, person.label])), [staff]);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await listStaffTasks(clinicId, userId, role);
      setTasks(rows);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر تحميل المهام.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void listStaffTasks(clinicId, userId, role)
      .then((rows) => {
        if (!active) return;
        setTasks(rows);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'تعذّر تحميل المهام.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clinicId, userId, role]);

  const counts = useMemo(() => countStaffTasksByStatus(tasks), [tasks]);
  const visibleTasks = useMemo(
    () => filter === 'all' ? tasks : tasks.filter((task) => task.status === filter),
    [filter, tasks],
  );
  const today = localDateKey();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await createStaffTask({
        clinicId,
        userId,
        assignedTo: role === 'admin' ? assignedTo : userId,
        title,
        dueOn: dueOn || null,
        priority,
      });
      setTitle('');
      setDueOn('');
      setPriority('normal');
      setAssignedTo(userId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر حفظ المهمة.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (task: StaffTask, status: StaffTaskStatus) => {
    if (savingTaskId) return;
    setSavingTaskId(task.id);
    setError(null);
    try {
      await updateStaffTaskStatus(task.id, status);
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status } : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر تحديث المهمة.');
    } finally {
      setSavingTaskId(null);
    }
  };

  const filters: Array<{ value: TaskFilter; label: string; count: number }> = [
    { value: 'all', label: 'الكل', count: tasks.length },
    { value: 'open', label: 'مفتوحة', count: counts.open },
    { value: 'in_progress', label: 'قيد التنفيذ', count: counts.in_progress },
    { value: 'completed', label: 'مكتملة', count: counts.completed },
  ];

  return (
    <section dir="rtl" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">{role === 'admin' ? 'مهام العيادة' : 'مهامي'}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {role === 'admin'
              ? 'ترى مهامك ومهام الأطباء، ويمكنك إسناد مهمة إلى عضو نشط في فريقك.'
              : 'تعرض هذه القائمة المهام المسندة إليك فقط.'}
          </p>
        </div>
        <div className="flex gap-2 text-[11px] font-bold">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{counts.open} مفتوحة</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">{counts.completed} مكتملة</span>
        </div>
      </div>

      <form onSubmit={submit} className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <label className="sr-only" htmlFor="staff-task-title">عنوان المهمة</label>
        <input
          id="staff-task-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={140}
          required
          placeholder="اكتب مهمة جديدة…"
          className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <label className="sr-only" htmlFor="staff-task-due">موعد المهمة</label>
        <input
          id="staff-task-due"
          type="date"
          value={dueOn}
          onChange={(event) => setDueOn(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        />
        {role === 'admin' && (
          <>
            <label className="sr-only" htmlFor="staff-task-assignee">إسناد المهمة إلى</label>
            <select
              id="staff-task-assignee"
              value={assignedTo}
              onChange={(event) => setAssignedTo(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value={userId}>إسناد إليّ</option>
              {staff.filter((person) => person.uid !== userId).map((person) => (
                <option key={person.uid} value={person.uid}>{person.label}</option>
              ))}
            </select>
          </>
        )}
        <label className="sr-only" htmlFor="staff-task-priority">أولوية المهمة</label>
        <select
          id="staff-task-priority"
          value={priority}
          onChange={(event) => setPriority(event.target.value as StaffTaskPriority)}
          className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
          <option value="low">أولوية منخفضة</option>
          <option value="normal">أولوية عادية</option>
          <option value="high">أولوية عاجلة</option>
        </select>
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="rounded-xl bg-sky-700 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'جارٍ الحفظ…' : 'إضافة مهمة'}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="تصفية المهام">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            aria-pressed={filter === item.value}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${filter === item.value ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
          >
            {item.label} ({item.count})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">جارٍ تحميل مهامك…</p>
      ) : visibleTasks.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-5 text-center dark:border-slate-700">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {filter === 'completed' ? 'لا توجد مهام مكتملة بعد' : filter === 'all' ? 'قائمتك فارغة' : 'لا توجد مهام في هذه الحالة'}
          </p>
          <p className="mt-1 text-xs text-slate-500">أضف مهمة عمل أو غيّر عامل التصفية.</p>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {visibleTasks.map((task) => {
            const overdue = isStaffTaskOverdue(task.due_on, task.status, today);
            return (
              <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="min-w-0 flex-1">
                  <p className={`break-words text-sm font-bold ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100'}`}>
                    {task.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span>الأولوية: {priorityLabels[task.priority]}</span>
                    {role === 'admin' && (
                      <span>
                        المسند إليه: {task.user_id === userId ? 'أنت' : staffLabels.get(task.user_id) ?? 'عضو الفريق'}
                      </span>
                    )}
                    {task.due_on && (
                      <span className={overdue ? 'font-bold text-rose-600 dark:text-rose-300' : ''}>
                        {overdue ? 'متأخرة · ' : 'الاستحقاق · '}{formatTaskDate(task.due_on)}
                      </span>
                    )}
                  </div>
                </div>
                <label className="sr-only" htmlFor={`staff-task-status-${task.id}`}>حالة {task.title}</label>
                <select
                  id={`staff-task-status-${task.id}`}
                  value={task.status}
                  disabled={savingTaskId === task.id}
                  onChange={(event) => void changeStatus(task, event.target.value as StaffTaskStatus)}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  <option value="open">{statusLabels.open}</option>
                  <option value="in_progress">{statusLabels.in_progress}</option>
                  <option value="completed">{statusLabels.completed}</option>
                </select>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
