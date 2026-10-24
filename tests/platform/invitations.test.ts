// اختبارات خالصة لمساعدات الدعوات (بلا Firebase ولا شبكة).
import { describe, it, expect } from 'vitest';
import {
  invitationIdForEmail,
  parseInvitation,
  validateInvitationForUser,
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
