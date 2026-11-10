import type { PaymentRecord } from './firestore';
import type { ClinicSummary } from './owner';

export interface OwnerPaymentRequest {
  key: string;
  clinicId: string;
  clinicName: string;
  payment: PaymentRecord;
  paymentIndex: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface MonthlyApprovedPayments {
  key: string;
  label: string;
  amount: number;
}

export interface OwnerDashboardSummary {
  totalClinics: number;
  activeSubscriptions: number;
  graceSubscriptions: number;
  expiredOrUnsubscribed: number;
  suspendedClinics: number;
  expiringWithin30Days: number;
  pendingPaymentCount: number;
  approvedPaymentsLastSixMonths: number;
  monthlyApprovedPayments: MonthlyApprovedPayments[];
  pendingPayments: OwnerPaymentRequest[];
}

/** Parse database ISO timestamps defensively. Invalid or missing values return null. */
export function parseDashboardDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Number of calendar-day boundaries until expiry, rounded up for a live countdown. */
export function daysRemaining(
  expiresAt: unknown,
  now: Date = new Date(),
): number | null {
  const expiry = parseDashboardDate(expiresAt);
  if (!expiry) return null;
  return Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function paymentStatus(payment: PaymentRecord): OwnerPaymentRequest['status'] {
  if (payment.reviewedAt == null) return 'pending';
  return payment.note?.trim().startsWith('مرفوض:') ? 'rejected' : 'approved';
}

/**
 * Build platform-level indicators from the owner-visible clinic/subscription data.
 * Approved payment totals include only payment records reviewed and not marked rejected.
 */
export function summarizeOwnerDashboard(
  clinics: ClinicSummary[],
  now: Date = new Date(),
): OwnerDashboardSummary {
  const monthBuckets = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return {
      key: monthKey(month),
      label: new Intl.DateTimeFormat('ar-EG', { month: 'short' }).format(month),
      amount: 0,
    };
  });
  const monthMap = new Map(monthBuckets.map((bucket) => [bucket.key, bucket]));
  const pendingPayments: OwnerPaymentRequest[] = [];
  let approvedPaymentsLastSixMonths = 0;
  let activeSubscriptions = 0;
  let graceSubscriptions = 0;
  let expiredOrUnsubscribed = 0;
  let suspendedClinics = 0;
  let expiringWithin30Days = 0;

  for (const clinic of clinics) {
    if (clinic.status === 'suspended') suspendedClinics += 1;

    const subscription = clinic.subscription;
    if (clinic.status !== 'suspended') {
      if (subscription?.status === 'active') {
        activeSubscriptions += 1;
        if (subscription.plan !== 'permanent' && subscription.expiresAt) {
          const remaining = daysRemaining(subscription.expiresAt, now);
          if (remaining != null && remaining >= 0 && remaining <= 30) {
            expiringWithin30Days += 1;
          }
        }
      } else if (subscription?.status === 'grace') {
        graceSubscriptions += 1;
      } else {
        expiredOrUnsubscribed += 1;
      }
    }

    (subscription?.payments ?? []).forEach((payment, paymentIndex) => {
      const status = paymentStatus(payment);
      if (status === 'pending') {
        pendingPayments.push({
          key: `${clinic.id}:${paymentIndex}`,
          clinicId: clinic.id,
          clinicName: clinic.name,
          payment,
          paymentIndex,
          status,
        });
        return;
      }
      if (status !== 'approved') return;

      const reviewedAt = parseDashboardDate(payment.reviewedAt);
      const amount = Number(payment.amount);
      if (!reviewedAt || !Number.isFinite(amount) || amount < 0) return;
      const bucket = monthMap.get(monthKey(reviewedAt));
      if (bucket) {
        bucket.amount += amount;
        approvedPaymentsLastSixMonths += amount;
      }
    });
  }

  pendingPayments.sort((a, b) => {
    const aTime = parseDashboardDate(a.payment.submittedAt)?.getTime() ?? 0;
    const bTime = parseDashboardDate(b.payment.submittedAt)?.getTime() ?? 0;
    return bTime - aTime;
  });

  return {
    totalClinics: clinics.length,
    activeSubscriptions,
    graceSubscriptions,
    expiredOrUnsubscribed,
    suspendedClinics,
    expiringWithin30Days,
    pendingPaymentCount: pendingPayments.length,
    approvedPaymentsLastSixMonths,
    monthlyApprovedPayments: monthBuckets,
    pendingPayments,
  };
}
