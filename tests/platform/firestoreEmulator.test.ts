// اختبارات تقييم حيّ لقواعد Firestore على المحاكي.
// تُشغَّل عبر `npm run test:rules` فقط (تستبعد من `npm test` الافتراضي).
// لا شبكة، لا مفاتيح حقيقية، معرّف مشروع وهمي.

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-test';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  // عند التشغيل عبر `firebase emulators:exec` يكتشف المضيف/المنفذ تلقائيًا
  // من FIRESTORE_EMULATOR_HOST. القواعد يحمّلها المحاكي نفسه من firebase.json
  // (واجهة :securityRules في هذا الإصدار مكسورة — لا ندفع القواعد عبرها).
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {},
  });
}, 60000);

afterAll(async () => {
  await testEnv.cleanup();
});

// بذر أساسي: المستخدمون والدعوات ومريض جاهز — بالمصادقة المعطلة حيث
// لا يستطيع العميل الإنشاء (الأدمن الأول والمريض المزروع للقراءة).
async function seedBase(): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/patient-1'), {
      role: 'patient',
      clinicId: 'clinic-a',
      email: 'p1@example.com',
    });
    await setDoc(doc(db, 'users/patient-9'), {
      role: 'patient',
      clinicId: 'clinic-a',
      email: 'p9@example.com',
    });
    await setDoc(doc(db, 'users/coach-1'), {
      role: 'coach',
      clinicId: 'clinic-a',
      email: 'c1@example.com',
    });
    await setDoc(doc(db, 'users/admin-1'), {
      role: 'admin',
      clinicId: 'clinic-a',
      email: 'a1@example.com',
    });
    await setDoc(doc(db, 'users/coach-2'), {
      role: 'coach',
      clinicId: 'clinic-b',
      email: 'c2@example.com',
    });
    await setDoc(doc(db, 'patients/patient-9'), {
      clinicId: 'clinic-a',
      profile: { clientName: 'Nine' },
      invitedBy: 'coach-1',
    });
    await setDoc(doc(db, 'patients/patient-9/consents/privacy'), {
      granted: true,
    });
    await setDoc(doc(db, 'invitations/invitee@example.com'), {
      email: 'invitee@example.com',
      role: 'patient',
      clinicId: 'clinic-a',
      createdBy: 'admin-1',
      status: 'pending',
    });
    await setDoc(doc(db, 'invitations/consumed@example.com'), {
      email: 'consumed@example.com',
      role: 'patient',
      clinicId: 'clinic-a',
      createdBy: 'admin-1',
      status: 'consumed',
    });
    // --- بذر B2B (المرحلة الثالثة) ---
    // اشتراكات: نشط لـ a وb، منتهٍ، وسماح — لاختبار بوابة الاشتراك.
    await setDoc(doc(db, 'clinicSubscriptions/clinic-a'), {
      plan: 'annual',
      status: 'active',
      payments: [],
    });
    await setDoc(doc(db, 'clinicSubscriptions/clinic-b'), {
      plan: 'annual',
      status: 'active',
      payments: [],
    });
    await setDoc(doc(db, 'clinicSubscriptions/clinic-expired'), {
      plan: 'annual',
      status: 'expired',
      payments: [],
    });
    await setDoc(doc(db, 'clinicSubscriptions/clinic-grace'), {
      plan: 'annual',
      status: 'grace',
      payments: [],
    });
    // صاحب المنصة + عيادة منتهية/سماح بمستخدمين.
    await setDoc(doc(db, 'users/owner-1'), {
      role: 'owner',
      clinicId: 'platform',
      email: 'owner@example.com',
    });
    await setDoc(doc(db, 'users/admin-exp'), {
      role: 'admin',
      clinicId: 'clinic-expired',
      email: 'adminexp@example.com',
    });
    await setDoc(doc(db, 'users/coach-exp'), {
      role: 'coach',
      clinicId: 'clinic-expired',
      email: 'coachexp@example.com',
    });
    await setDoc(doc(db, 'users/patient-exp'), {
      role: 'patient',
      clinicId: 'clinic-expired',
      email: 'pexp@example.com',
    });
    await setDoc(doc(db, 'users/coach-grace'), {
      role: 'coach',
      clinicId: 'clinic-grace',
      email: 'coachgrace@example.com',
    });
    await setDoc(doc(db, 'patients/patient-exp'), {
      clinicId: 'clinic-expired',
      profile: { clientName: 'Expired' },
      invitedBy: 'coach-exp',
    });
    // مرضى لنطاق الدكتور: واحد لدعوة coach-1 وآخر لدعوة admin-1.
    await setDoc(doc(db, 'patients/patient-coach1'), {
      clinicId: 'clinic-a',
      profile: { clientName: 'CoachOne' },
      invitedBy: 'coach-1',
    });
    await setDoc(doc(db, 'patients/patient-admin1'), {
      clinicId: 'clinic-a',
      profile: { clientName: 'AdminOne' },
      invitedBy: 'admin-1',
    });
    // عيادة وسجل اشتراك لاختبار دعوة صاحب العيادة.
    await setDoc(doc(db, 'clinics/clinic-new'), {
      name: 'New Clinic',
      ownerUid: 'admin-new',
      status: 'active',
    });
  });
}

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedBase();
});

function dbAs(uid: string | null, token?: Record<string, unknown>) {
  if (uid === null) return testEnv.unauthenticatedContext().firestore();
  return testEnv.authenticatedContext(uid, token ?? {}).firestore();
}

describe('emulator — patient document create (Phase 1)', () => {
  it('غير مسجّل: قراءة المرضى مرفوضة', async () => {
    const db = dbAs(null);
    await assertFails(getDoc(doc(db, 'patients/patient-9')));
  });

  it('مريض ينشئ سجله لعيادته بالحقول المسموحة: مسموح', async () => {
    const db = dbAs('patient-1');
    await assertSucceeds(
      setDoc(doc(db, 'patients/patient-1'), {
        clinicId: 'clinic-a',
        profile: { clientName: 'One' },
      }),
    );
  });

  it('مريض ينشئ سجل uid آخر: مرفوض', async () => {
    const db = dbAs('patient-1');
    await assertFails(
      setDoc(doc(db, 'patients/patient-2'), {
        clinicId: 'clinic-a',
        profile: { clientName: 'Two' },
      }),
    );
  });

  it('مريض ينشئ سجله بعيادة مختلفة: مرفوض', async () => {
    const db = dbAs('patient-1');
    await assertFails(
      setDoc(doc(db, 'patients/patient-1'), {
        clinicId: 'clinic-b',
        profile: { clientName: 'One' },
      }),
    );
  });

  it('مريض ينشئ سجله متضمنًا plan: مرفوض', async () => {
    const db = dbAs('patient-1');
    await assertFails(
      setDoc(doc(db, 'patients/patient-1'), {
        clinicId: 'clinic-a',
        profile: { clientName: 'One' },
        plan: { meals: [] },
      }),
    );
  });

  it('مريض ينشئ سجله مع invitedBy النصي: مسموح', async () => {
    const db = dbAs('patient-1');
    await assertSucceeds(
      setDoc(doc(db, 'patients/patient-1'), {
        clinicId: 'clinic-a',
        profile: { clientName: 'One' },
        invitedBy: 'coach-1',
      }),
    );
  });
});

describe('emulator — consents carve-out (Phase 2)', () => {
  it('مريض يكتب موافقته: مسموح', async () => {
    const db = dbAs('patient-9');
    await assertSucceeds(
      setDoc(doc(db, 'patients/patient-9/consents/privacy'), { granted: false }),
    );
  });

  it('طبيب نفس العيادة يقرأ الموافقة: مسموح', async () => {
    const db = dbAs('coach-1');
    await assertSucceeds(getDoc(doc(db, 'patients/patient-9/consents/privacy')));
  });

  it('طبيب نفس العيادة يكتب الموافقة: مرفوض', async () => {
    const db = dbAs('coach-1');
    await assertFails(
      setDoc(doc(db, 'patients/patient-9/consents/privacy'), { granted: false }),
    );
  });

  it('طبيب نفس العيادة يكتب الخطة (مسار firestore.ts الفعلي): مسموح', async () => {
    const db = dbAs('coach-1');
    await assertSucceeds(
      setDoc(
        doc(db, 'patients/patient-9'),
        { plan: { meals: [], updatedBy: 'coach-1' } },
        { merge: true },
      ),
    );
  });

  it('طبيب نفس العيادة يكتب سجل يوم (dayLogs): مسموح', async () => {
    const db = dbAs('coach-1');
    await assertSucceeds(
      setDoc(doc(db, 'patients/patient-9/dayLogs/2026-10-30'), {
        water: 1500,
      }),
    );
  });

  it('طبيب عيادة أخرى يقرأ المريض: مرفوض', async () => {
    const db = dbAs('coach-2');
    await assertFails(getDoc(doc(db, 'patients/patient-9')));
  });
});

describe('emulator — invitations (Phase 2)', () => {
  it('مدعو يستهلك دعوته pending -> consumed (الحالة فقط): مسموح', async () => {
    const db = dbAs('invitee-uid', { email: 'invitee@example.com' });
    await assertSucceeds(
      updateDoc(doc(db, 'invitations/invitee@example.com'), {
        status: 'consumed',
      }),
    );
  });

  it('مدعو يعيد فتح دعوة consumed -> pending: مرفوض', async () => {
    const db = dbAs('consumed-uid', { email: 'consumed@example.com' });
    await assertFails(
      updateDoc(doc(db, 'invitations/consumed@example.com'), {
        status: 'pending',
      }),
    );
  });

  it('طاقم يعيد فتح دعوة consumed -> pending (الحالة فقط): مسموح', async () => {
    const db = dbAs('admin-1');
    await assertSucceeds(
      updateDoc(doc(db, 'invitations/consumed@example.com'), {
        status: 'pending',
      }),
    );
  });

  it('طاقم يغيّر الدور مع إعادة الفتح: مرفوض', async () => {
    const db = dbAs('admin-1');
    await assertFails(
      updateDoc(doc(db, 'invitations/consumed@example.com'), {
        status: 'pending',
        role: 'coach',
      }),
    );
  });

  it('إنشاء دعوة معرّفها لا يساوي البريد: مرفوض', async () => {
    const db = dbAs('admin-1');
    await assertFails(
      setDoc(doc(db, 'invitations/other-id'), {
        email: 'x@example.com',
        role: 'patient',
        clinicId: 'clinic-a',
        createdBy: 'admin-1',
        status: 'pending',
      }),
    );
  });

  it('إنشاء دعوة معرّفها يساوي البريد: مسموح', async () => {
    const db = dbAs('admin-1');
    await assertSucceeds(
      setDoc(doc(db, 'invitations/new@example.com'), {
        email: 'new@example.com',
        role: 'patient',
        clinicId: 'clinic-a',
        createdBy: 'admin-1',
        status: 'pending',
      }),
    );
  });
});

// فحص سلامة: البيئة نفسها تعمل
describe('emulator — sanity', () => {
  it('المحاكي يرد', async () => {
    const db = dbAs('admin-1');
    const snap = await getDoc(doc(db, 'users/admin-1'));
    expect(snap.exists()).toBe(true);
  });
});

// --- المرحلة الثالثة: بوابة الاشتراك B2B ---
describe('emulator — subscription gate (Phase 3)', () => {
  it('اشتراك منتهٍ: المريض لا يقرأ سجله', async () => {
    const db = dbAs('patient-exp');
    await assertFails(getDoc(doc(db, 'patients/patient-exp')));
  });

  it('اشتراك منتهٍ: الدكتور لا يقرأ مرضاه', async () => {
    const db = dbAs('coach-exp');
    await assertFails(getDoc(doc(db, 'patients/patient-exp')));
  });

  it('اشتراك منتهٍ: الأدمن لا يقرأ مرضى عيادته', async () => {
    const db = dbAs('admin-exp');
    await assertFails(getDoc(doc(db, 'patients/patient-exp')));
  });

  it('فترة سماح: القراءة مسموحة', async () => {
    const db = dbAs('coach-grace');
    // نزرع مريضًا لعيادة السماح أولًا (بلا قواعد)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const adb = ctx.firestore();
      await setDoc(doc(adb, 'patients/patient-grace'), {
        clinicId: 'clinic-grace',
        profile: { clientName: 'Grace' },
        invitedBy: 'coach-grace',
      });
    });
    await assertSucceeds(getDoc(doc(db, 'patients/patient-grace')));
  });

  it('اشتراك نشط: القراءة مسموحة كالمعتاد', async () => {
    const db = dbAs('coach-1');
    await assertSucceeds(getDoc(doc(db, 'patients/patient-coach1')));
  });

  it('صاحب العيادة يقرأ وثيقة اشتراكه حتى لو منتهي', async () => {
    const db = dbAs('admin-exp');
    await assertSucceeds(getDoc(doc(db, 'clinicSubscriptions/clinic-expired')));
  });

  it('المريض لا يقرأ وثيقة الاشتراك', async () => {
    const db = dbAs('patient-exp');
    await assertFails(getDoc(doc(db, 'clinicSubscriptions/clinic-expired')));
  });
});

// --- المرحلة الثالثة: نطاق الدكتور (مرضاه فقط) ---
describe('emulator — coach scoping (Phase 3)', () => {
  it('الدكتور يقرأ مريضه (invitedBy هو)', async () => {
    const db = dbAs('coach-1');
    await assertSucceeds(getDoc(doc(db, 'patients/patient-coach1')));
  });

  it('الدكتور لا يقرأ مريض زميله', async () => {
    const db = dbAs('coach-1');
    await assertFails(getDoc(doc(db, 'patients/patient-admin1')));
  });

  it('الدكتور لا يكتب على مريض زميله', async () => {
    const db = dbAs('coach-1');
    await assertFails(
      setDoc(
        doc(db, 'patients/patient-admin1/dayLogs/d1'),
        { note: 'x' },
        { merge: true },
      ),
    );
  });

  it('الدكتور يكتب على مجموعة فرعية لمريضه', async () => {
    const db = dbAs('coach-1');
    await assertSucceeds(
      setDoc(doc(db, 'patients/patient-coach1/dayLogs/d1'), { note: 'ok' }),
    );
  });

  it('صاحب العيادة يقرأ كل مرضى عيادته', async () => {
    const db = dbAs('admin-1');
    await assertSucceeds(getDoc(doc(db, 'patients/patient-coach1')));
    await assertSucceeds(getDoc(doc(db, 'patients/patient-admin1')));
  });
});

// --- المرحلة الثالثة: أدوار الدعوات وصاحب المنصة ---
describe('emulator — invitations and platform owner (Phase 3)', () => {
  it('صاحب العيادة لا يدعو admin جديد: مرفوض', async () => {
    const db = dbAs('admin-1');
    await assertFails(
      setDoc(doc(db, 'invitations/boss@example.com'), {
        email: 'boss@example.com',
        role: 'admin',
        clinicId: 'clinic-a',
        createdBy: 'admin-1',
        status: 'pending',
      }),
    );
  });

  it('صاحب العيادة يدعو دكتور: مسموح', async () => {
    const db = dbAs('admin-1');
    await assertSucceeds(
      setDoc(doc(db, 'invitations/doc2@example.com'), {
        email: 'doc2@example.com',
        role: 'coach',
        clinicId: 'clinic-a',
        createdBy: 'admin-1',
        status: 'pending',
      }),
    );
  });

  it('صاحب المنصة يدعو صاحب عيادة لعيادة موجودة: مسموح', async () => {
    const db = dbAs('owner-1');
    await assertSucceeds(
      setDoc(doc(db, 'invitations/newowner@example.com'), {
        email: 'newowner@example.com',
        role: 'admin',
        clinicId: 'clinic-new',
        createdBy: 'owner-1',
        status: 'pending',
      }),
    );
  });

  it('صاحب المنصة يدعو لعيادة غير موجودة: مرفوض', async () => {
    const db = dbAs('owner-1');
    await assertFails(
      setDoc(doc(db, 'invitations/ghost@example.com'), {
        email: 'ghost@example.com',
        role: 'admin',
        clinicId: 'clinic-ghost',
        createdBy: 'owner-1',
        status: 'pending',
      }),
    );
  });

  it('صاحب المنصة يقرأ أي عيادة واشتراكها', async () => {
    const db = dbAs('owner-1');
    await assertSucceeds(getDoc(doc(db, 'clinics/clinic-new')));
    await assertSucceeds(getDoc(doc(db, 'clinicSubscriptions/clinic-a')));
  });

  it('صاحب العيادة لا يعدّل حالة عيادته: مرفوض', async () => {
    const db = dbAs('admin-1');
    // نزرع عيادة clinic-a أولًا
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const adb = ctx.firestore();
      await setDoc(doc(adb, 'clinics/clinic-a'), {
        name: 'A',
        ownerUid: 'admin-1',
        status: 'active',
      });
    });
    await assertFails(updateDoc(doc(db, 'clinics/clinic-a'), { status: 'suspended' }));
  });

  it('صاحب العيادة يعدّل اسم عيادته: مسموح', async () => {
    const db = dbAs('admin-1');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const adb = ctx.firestore();
      await setDoc(doc(adb, 'clinics/clinic-a'), {
        name: 'A',
        ownerUid: 'admin-1',
        status: 'active',
      });
    });
    await assertSucceeds(updateDoc(doc(db, 'clinics/clinic-a'), { name: 'A Renamed' }));
  });

  it('الدكتور لا ينشئ دعوة باشتراك منتهٍ: مرفوض', async () => {
    const db = dbAs('coach-exp');
    await assertFails(
      setDoc(doc(db, 'invitations/exp2@example.com'), {
        email: 'exp2@example.com',
        role: 'patient',
        clinicId: 'clinic-expired',
        createdBy: 'coach-exp',
        status: 'pending',
      }),
    );
  });
});
