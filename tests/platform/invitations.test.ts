// اختبارات خالصة لمساعدات الدعوات بلا شبكة.
import { describe, it, expect } from 'vitest';
import {
  invitationIdForEmail,
  parseInvitation,
  validateInvitationForUser,
  canReopenInvitationForStaff,
  summarizeInvitations,
  type Invitation,
} from '../../src/platform/invitations';

const base: Invitation = {
  email: 'patient-x@example.com',
  role: 'patient',
  clinicId: 'clinic-a',
  createdBy: 'admin-a',
  status: 'pending',
};

describe('invitationIdForEmail', () => {
  it('يقص الأطراف ويحوّل إلى حروف صغيرة', () => {
    expect(invitationIdForEmail('  Patient-X@Example.COM ')).toBe(
      'patient-x@example.com',
    );
  });
});

describe('parseInvitation', () => {
  it('يقبل دعوة سليمة', () => {
    expect(parseInvitation({ ...base })).toEqual(base);
  });

  it('يرفض دورًا غير معروف', () => {
    expect(parseInvitation({ ...base, role: 'superuser' })).toBeNull();
  });

  it('يرفض حالة غير pending/consumed', () => {
    expect(parseInvitation({ ...base, status: 'expired' })).toBeNull();
  });

  it('يحفظ وقت الإنشاء من صيغة Supabase snake_case', () => {
    expect(parseInvitation({ ...base, created_at: '2026-11-14T06:00:00Z' })).toEqual({
      ...base,
      createdAt: '2026-11-14T06:00:00Z',
    });
  });

  it('يرفض بريدًا فارغًا أو عيادة فارغة', () => {
    expect(parseInvitation({ ...base, email: '  ' })).toBeNull();
    expect(parseInvitation({ ...base, clinicId: '' })).toBeNull();
  });
});

describe('validateInvitationForUser', () => {
  it('يقبل المطابقة الكاملة (والبريد بمقارنة مطبّعة)', () => {
    expect(
      validateInvitationForUser(base, {
        email: '  PATIENT-X@Example.com ',
        role: 'patient',
        clinicId: 'clinic-a',
      }),
    ).toBe(true);
  });

  it('يرفض الدعوة المستهلكة', () => {
    expect(
      validateInvitationForUser(
        { ...base, status: 'consumed' },
        { email: base.email, role: 'patient', clinicId: 'clinic-a' },
      ),
    ).toBe(false);
  });

  it('يرفض اختلاف البريد أو الدور أو العيادة', () => {
    expect(
      validateInvitationForUser(base, {
        email: 'other@example.com',
        role: 'patient',
        clinicId: 'clinic-a',
      }),
    ).toBe(false);
    expect(
      validateInvitationForUser(base, {
        email: base.email,
        role: 'coach',
        clinicId: 'clinic-a',
      }),
    ).toBe(false);
    expect(
      validateInvitationForUser(base, {
        email: base.email,
        role: 'patient',
        clinicId: 'clinic-b',
      }),
    ).toBe(false);
  });
});


describe('summarizeInvitations', () => {
  it('counts pending and consumed invitations and selects the newest pending one', () => {
    const result = summarizeInvitations([
      { ...base, email: 'older@example.com', createdAt: '2026-11-10T09:00:00Z' },
      { ...base, email: 'used@example.com', status: 'consumed', createdAt: '2026-11-21T09:00:00Z' },
      { ...base, email: 'newer@example.com', createdAt: '2026-11-22T09:00:00Z' },
    ]);
    expect(result.pendingCount).toBe(2);
    expect(result.consumedCount).toBe(1);
    expect(result.latestPending?.email).toBe('newer@example.com');
  });

  it('keeps missing and invalid creation timestamps out of latest-date ordering', () => {
    const result = summarizeInvitations([
      { ...base, email: 'no-date@example.com' },
      { ...base, email: 'invalid-date@example.com', createdAt: 'not-a-date' },
      { ...base, email: 'dated@example.com', createdAt: '2026-11-20T09:00:00Z' },
    ]);
    expect(result.latestPending?.email).toBe('dated@example.com');
  });

  it('returns zero counts for an empty invitation set', () => {
    expect(summarizeInvitations([])).toEqual({
      pendingCount: 0,
      consumedCount: 0,
      latestPending: null,
    });
  });
});
