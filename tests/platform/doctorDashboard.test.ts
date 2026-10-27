// اختبارات خالصة لملخص الدكاترة في لوحة الطاقم المتقدمة (بلا شبكة).
import { describe, it, expect } from 'vitest';
import { summarizeDoctors } from '../../src/platform/firestore';

const coaches = [
  { uid: 'coach-a', displayName: 'د. أحمد', email: 'a@example.com' },
  { uid: 'coach-b', displayName: null, email: 'b@example.com' },
  { uid: 'coach-c', displayName: null, email: null },
];

describe('summarizeDoctors', () => {
  it('يحسب عدد عملاء كل طبيب من invitedBy فقط', () => {
    const { perDoctor, unassignedCount } = summarizeDoctors(coaches, [
      { uid: 'p1', invitedBy: 'coach-a' },
      { uid: 'p2', invitedBy: 'coach-a' },
      { uid: 'p3', invitedBy: 'coach-b' },
    ]);
    expect(perDoctor.map((d) => [d.uid, d.count])).toEqual([
      ['coach-a', 2],
      ['coach-b', 1],
      ['coach-c', 0],
    ]);
    expect(unassignedCount).toBe(0);
  });

  it('يعدّ المدعو من أدمن بلا طبيب معيّن', () => {
    const { perDoctor, unassignedCount } = summarizeDoctors(coaches, [
      { uid: 'p1', invitedBy: 'admin-x' },
      { uid: 'p2', invitedBy: 'coach-a' },
    ]);
    expect(perDoctor.find((d) => d.uid === 'coach-a')?.count).toBe(1);
    expect(unassignedCount).toBe(1);
  });

  it('يعدّ المريض بلا invitedBy بلا طبيب معيّن', () => {
    const { unassignedCount } = summarizeDoctors(coaches, [
      { uid: 'p1' },
      { uid: 'p2', invitedBy: undefined },
    ]);
    expect(unassignedCount).toBe(2);
  });

  it('يعيد قوائم فارغة وصفرًا لمدخلات فارغة', () => {
    expect(summarizeDoctors([], [])).toEqual({
      perDoctor: [],
      unassignedCount: 0,
    });
    const { perDoctor, unassignedCount } = summarizeDoctors(coaches, []);
    expect(perDoctor.every((d) => d.count === 0)).toBe(true);
    expect(unassignedCount).toBe(0);
  });

  it('يستخدم البريد بديلًا للاسم، و«طبيب بلا اسم» عند غيابهما', () => {
    const { perDoctor } = summarizeDoctors(coaches, []);
    expect(perDoctor[0].displayName).toBe('د. أحمد');
    expect(perDoctor[1].displayName).toBe('b@example.com');
    expect(perDoctor[2].displayName).toBe('طبيب بلا اسم');
    expect(perDoctor[2].email).toBeNull();
  });
});
