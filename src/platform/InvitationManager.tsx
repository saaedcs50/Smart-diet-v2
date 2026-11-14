import React, { useEffect, useState } from 'react';
import { RefreshCw, MailPlus } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import {
  canReopenInvitationForStaff,
  listClinicInvitations,
  reopenInvitation,
  type Invitation,
} from './invitations';

interface InvitationManagerProps {
  clinicId: string;
  uid: string;
  isAdmin: boolean;
}

/** Shows only invitations visible to this staff role; database RLS is authoritative. */
export const InvitationManager: React.FC<InvitationManagerProps> = ({
  clinicId,
  uid,
  isAdmin,
}) => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async (active: () => boolean = () => true) => {
    setError(null);
    try {
      const items = await listClinicInvitations(
        clinicId,
        isAdmin ? undefined : { createdBy: uid, role: 'patient' },
      );
      if (active()) setInvitations(items);
    } catch (caught) {
      if (active()) {
        setError(caught instanceof Error ? caught.message : 'تعذّر تحميل الدعوات.');
      }
    } finally {
      if (active()) setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void load(() => mounted);
    return () => {
      mounted = false;
    };
    // load has no changing captured values other than these stable props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId, uid, isAdmin]);

  const handleReopen = async (invitation: Invitation) => {
    const actor = {
      uid,
      role: isAdmin ? 'admin' as const : 'coach' as const,
      clinicId,
    };
    if (!canReopenInvitationForStaff(invitation, actor)) return;
    const accepted = window.confirm(
      `إعادة فتح الدعوة لـ ${invitation.email}؟ سيُسمح باستخدام نفس البريد للتسجيل مرة أخرى. لن يُرسل بريد تلقائيًا.`,
    );
    if (!accepted) return;

    setBusyEmail(invitation.email);
    setError(null);
    setMessage(null);
    try {
      await reopenInvitation(invitation.email);
      setInvitations((current) => current.map((item) =>
        item.email === invitation.email ? { ...item, status: 'pending' } : item
      ));
      setMessage(`تمت إعادة فتح الدعوة لـ ${invitation.email}. أبلغ المدعو يدويًا.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّرت إعادة فتح الدعوة.');
    } finally {
      setBusyEmail(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-slate-100">الدعوات المرسلة</h3>
          <p className="mt-1 text-xs text-slate-500">
            {isAdmin ? 'دعوات العيادة التي تسمح بها صلاحياتك.' : 'دعوات المرضى التي أنشأتها أنت فقط.'}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          disabled={loading}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          تحديث
        </button>
      </div>

      {message && <p role="status" className="mt-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">{message}</p>}
      {error && <p role="alert" className="mt-3 text-xs font-bold text-red-600">{error}</p>}
      {loading && <p className="mt-3 text-sm text-slate-500">جاري تحميل الدعوات…</p>}
      {!loading && !error && invitations.length === 0 && (
        <div className="mt-3">
          <EmptyState
            icon={MailPlus}
            title="لا توجد دعوات مسجلة حتى الآن"
            description="ستظهر هنا الدعوات التي أُنشئت ضمن نطاق صلاحيات حسابك."
          />
        </div>
      )}

      {invitations.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {invitations.map((invitation) => {
            const canReopen = canReopenInvitationForStaff(invitation, {
              uid,
              role: isAdmin ? 'admin' : 'coach',
              clinicId,
            });
            const createdAt = invitation.createdAt ? new Date(invitation.createdAt) : null;
            const createdAtLabel = createdAt && Number.isFinite(createdAt.getTime())
              ? createdAt.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })
              : null;
            return (
              <li key={invitation.email} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="break-all text-sm font-bold text-slate-800 dark:text-slate-100">{invitation.email}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {invitation.role === 'patient' ? 'مريض' : invitation.role === 'coach' ? 'طبيب' : 'مدير عيادة'}
                    {createdAtLabel ? ` · أُنشئت ${createdAtLabel}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={invitation.status === 'pending'
                    ? 'rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
                    : 'rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                  }>
                    {invitation.status === 'pending' ? 'بانتظار التسجيل' : 'مستهلكة'}
                  </span>
                  {canReopen && (
                    <button
                      type="button"
                      className="rounded-lg border border-indigo-200 px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
                      onClick={() => void handleReopen(invitation)}
                      disabled={busyEmail !== null}
                    >
                      {busyEmail === invitation.email ? 'جارٍ الفتح…' : 'إعادة فتح الدعوة'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
