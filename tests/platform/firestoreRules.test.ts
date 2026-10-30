// اختبارات ثابتة (static) لملف القواعد ووثيقة حالاتها.
// هذه ليست تقييمًا حيًا للقواعد: التقييم الحي يتم في Rules Playground أو
// محاكي Firestore قبل أي نشر (انظر firestore.rules.test.md). ما يُثبت هنا
// هو أن القواعد المطلوبة موجودة نصيًا وأن وثيقة الحالات تغطي الثماني
// وحالات الدعوات (9-18) وحالات قائمة المرضى (19-20).

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
    expect(rules).toContain('match /patients/{pid}/{subcollection}/{doc=**}');
    expect(rules).toContain('patientClinicId(pid) == clinicId()');
    expect(rules).toContain("request.auth.uid == pid");
  });

  it('تدقيق: كتابة مرفوضة من العميل وقراءة للأدمن فقط', () => {
    expect(rules).toContain('match /clinicAudit/{cid}/events/{eid}');
    expect(rules).toContain('allow read: if isAdmin() && clinicId() == cid;');
    expect(rules).toContain('allow write: if false;');
  });

  it('مرضى: قائمة العيادة مقبولة عبر resource.data في مستند المريض نفسه', () => {
    expect(rules).toContain('match /patients/{pid}');
    expect(rules).toContain(
      'allow read: if isPatient() && request.auth.uid == pid;',
    );
    expect(rules).toContain(
      'allow read: if isStaff() && resource.data.clinicId == clinicId();',
    );
  });

  it('مرضى: إنشاء المريض لسجله مقيد به وبعيادته وحقول محدودة (لا wildcard)', () => {
    // كتلة مستند المريض نفسه فقط — لا الممرر العام /patients/{pid}/{subcollection}/{doc=**}
    const parentBlock = rules.match(/match \/patients\/\{pid\} \{[^}]*\}/);
    expect(parentBlock).not.toBeNull();
    const block = parentBlock![0];
    expect(block).toContain(
      'allow create: if isPatient() && request.auth.uid == pid',
    );
    expect(block).toContain('request.resource.data.clinicId == clinicId()');
    expect(block).toContain(
      'request.resource.data.profile.clientName is string',
    );
    expect(block).toContain("hasOnly(['clinicId', 'profile'])");
    expect(block).toContain("hasOnly(['clinicId', 'profile', 'invitedBy'])");
    // لا إنشاء من الطاقم على مستند المريض
    expect(block).not.toContain('allow create: if isStaff()');
  });

  it('يصرّح بحالة النشر الحقيقية: Firestore منشور على التجريبي، والدور من المستند', () => {
    expect(rules).toContain('نُشرت');
    expect(rules).toContain('smart-diet-platform-trial');
    expect(rules).not.toContain('لم يُنشر');
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

  it('الدعوات: التحديث فرعان مستقلان بأقواس (استهلاك/إعادة فتح)', () => {
    const invBlock = rules.match(/match \/invitations\/\{invId\} \{[^}]*\}/);
    expect(invBlock).not.toBeNull();
    const block = invBlock![0];
    // فرع المدعو: pending -> consumed ببريده فقط
    expect(block).toContain('request.auth.token.email == resource.data.email');
    // فرع الطاقم: consumed -> pending لعيادته فقط
    expect(block).toContain('isStaff()');
    expect(block).toContain('resource.data.clinicId == clinicId()');
    // الإنشاء: معرّف المستند هو البريد نفسه
    expect(block).toContain('invId == request.resource.data.email');
  });

  it('الموافقات: الممرر العام لا يتجاوز قاعدة الموافقات للطاقم', () => {
    expect(rules).toContain('function isConsentSubpath(firstSegment)');
    expect(rules).toContain("firstSegment == 'consents'");
    const wildBlock = rules.match(
      /match \/patients\/\{pid\}\/\{subcollection\}\/\{doc=\*\*\} \{[^}]*\}/,
    );
    expect(wildBlock).not.toBeNull();
    const block = wildBlock![0];
    expect(block).toContain('!isConsentSubpath(subcollection)');
    // كتابة المريض نفسه غير مقيدة بالاستثناء
    expect(block).toContain(
      'allow read, write: if isPatient() && request.auth.uid == pid;',
    );
    // قاعدة الموافقات الأضيق ما زالت: كتابة المريض وحده
    expect(rules).toContain('match /patients/{pid}/consents/{type}');
    expect(rules).toContain(
      'allow write: if isPatient() && request.auth.uid == pid;',
    );
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

  it('وثيقة الحالات تغطي حالات قائمة المرضى (19-20)', () => {
    for (const n of [19, 20]) {
      expect(rulesDoc).toContain(`${n}.`);
    }
    expect(rulesDoc).toContain('قائمة المرضى');
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

  it('يوثق حالة النشر: Firestore منشور على التجريبي وStorage معلق على Blaze', () => {
    expect(rulesDoc).toContain('Firebase CLI');
    expect(rulesDoc).toContain('smart-diet-platform-trial');
    expect(rulesDoc).toContain('نُشرت');
    expect(rulesDoc).toContain('Blaze');
    expect(rulesDoc).not.toContain('لم يُنشر');
  });
});
