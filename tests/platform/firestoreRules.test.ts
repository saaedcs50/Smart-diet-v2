// اختبارات ثابتة (static) لملف القواعد ووثيقة حالاتها.
// هذه ليست تقييمًا حيًا للقواعد: التقييم الحي يتم في Rules Playground أو
// محاكي Firestore قبل أي نشر (انظر firestore.rules.test.md). ما يُثبت هنا
// هو أن القواعد المطلوبة موجودة نصيًا وأن وثيقة الحالات تغطي الثماني.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const rules = readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
const rulesDoc = readFileSync(
  path.join(repoRoot, 'firestore.rules.test.md'),
  'utf8',
);

describe('firestore.rules content', () => {
  it('رفض افتراضي شامل في النهاية', () => {
    expect(rules).toContain("match /{document=**}");
    expect(rules).toContain('allow read, write: if false;');
  });

  it('عيادات: قراءة للأعضاء وتعديل للأدمن فقط', () => {
    expect(rules).toContain('match /clinics/{cid}');
    expect(rules).toContain('allow update: if isAdmin() && clinicId() == cid;');
  });

  it('حسابات: الدور والعيادة لا يتغيران بالتعديل', () => {
    expect(rules).toContain('match /users/{uid}');
    expect(rules).toContain(
      'request.resource.data.role == resource.data.role',
    );
    expect(rules).toContain(
      'request.resource.data.clinicId == resource.data.clinicId',
    );
  });

  it('مرضى: عزل بالعيادة عبر مستند المريض', () => {
    expect(rules).toContain('match /patients/{pid}/{doc=**}');
    expect(rules).toContain('patientClinicId(pid) == clinicId()');
    expect(rules).toContain("request.auth.uid == pid");
  });

  it('تدقيق: كتابة مرفوضة من العميل وقراءة للأدمن فقط', () => {
    expect(rules).toContain('match /clinicAudit/{cid}/events/{eid}');
    expect(rules).toContain('allow read: if isAdmin() && clinicId() == cid;');
    expect(rules).toContain('allow write: if false;');
  });

  it('يصرّح أن القواعد غير منشورة وأن الدور من المستند في هذه المرحلة', () => {
    expect(rules).toContain('لم يُنشر');
    expect(rules).toContain('users/{uid}');
  });

  it('الدعوات: معرّفها بريد المدعو، وإنشاء المستخدم عبرها مقيد بها', () => {
    expect(rules).toContain('match /invitations/{invId}');
    expect(rules).toContain('invitationAllows(uid)');
    expect(rules).toContain("invitationData().status == 'pending'");
    expect(rules).toContain("invitationData().role == request.resource.data.role");
    expect(rules).toContain("invitationData().clinicId == request.resource.data.clinicId");
  });

  it('الدعوات: استهلاك بتغيير الحالة فقط، وإعادة دعوة من الطاقم فقط', () => {
    expect(rules).toContain("request.resource.data.status == 'consumed'");
    expect(rules).toContain("request.resource.data.status == 'pending'");
    expect(rules).toContain("affectedKeys().hasOnly(['status'])");
    expect(rules).toContain('allow delete: if false;');
  });

  it('دوال الدور محمية بوجود المستند حتى لا يخطئ تقييم مدعو بلا ملف', () => {
    expect(rules).toContain('function userExists()');
    expect(rules).toContain('userExists() ? userData().role : null');
  });

  it('وثيقة الحالات تغطي حالات الدعوات (9-18)', () => {
    for (const n of [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]) {
      expect(rulesDoc).toContain(`${n}.`);
    }
    expect(rulesDoc).toContain('الدعوات');
  });
});

describe('firestore.rules.test.md coverage', () => {
  it('يوثق الحالات الثمانية من دراسة §٥', () => {
    const caseTitles = [
      'مريض يقرأ `dayLogs` لمريض آخر',
      'مريض يقرأ خطة مريض في عيادة أخرى',
      'طبيب يقرأ مريضًا في عيادة أخرى',
      'طبيب يعدّل `clinicId` لمريض',
      'مريض يكتب في `clinicAudit`',
      'غير مسجّل يقرأ أي شيء',
      'أدمن داخل عيادته فقط',
      'تعديل `role` أو `clinicId`',
    ];
    for (const title of caseTitles) {
      expect(rulesDoc).toContain(title);
    }
  });

  it('يذكر أن النشر خارج النطاق ويتطلب Firebase CLI', () => {
    expect(rulesDoc).toContain('Firebase CLI');
    expect(rulesDoc).toContain('لم يُنشر');
  });
});
