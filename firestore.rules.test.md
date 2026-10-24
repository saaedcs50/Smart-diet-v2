# اختبار قواعد Firestore — المرحلة الأولى (غير منفذ هنا)

> ملف `firestore.rules` مكتوب للمراجعة فقط ولم يُنشر من بيئة البناء هذه.
> نشر القواعد يحتاج Firebase CLI بتسجيل دخول (`firebase deploy --only
> firestore:rules` من مجلد المشروع بعد `firebase login` و`firebase use
> smart-diet-platform-trial`) — وهذه الخطوة خارج نطاق هذه المرحلة.
> الحالات الثمانية أدناه تُنفذ في Rules Playground أو محاكي Firestore
> (Emulator Suite) قبل أي نشر، ببيانات تجريبية فقط وبلا أي مستخدم حقيقي.

## إعداد الاختبار (بيانات تجريبية)

- عيادة `clinic-a` و`clinic-b`.
- أدمن `admin-a` بمستند `users/admin-a` = `{ role: 'admin', clinicId: 'clinic-a' }`.
- طبيب `coach-a` بمستند `users/coach-a` = `{ role: 'coach', clinicId: 'clinic-a' }`.
- مريض `patient-a` بمستند `users/patient-a` = `{ role: 'patient', clinicId: 'clinic-a' }`
  ومستند `patients/patient-a` = `{ clinicId: 'clinic-a', profile: { clientName: 'مريض تجريبي' } }`.
- مريض `patient-b` في `clinic-b` بالشكل نفسه.
- تنبيه التمهيد: أول أدمن يُنشأ من وحدة تحكم المشروع (Console) حصرًا،
  لأن القواعد تمنع إنشاء أول حساب من العميل.

## الحالات الثمانية (من دراسة §٥، مكيّفة لمصدر الدور بالمستند)

1. **مريض يقرأ `dayLogs` لمريض آخر** — `patient-a` يقرأ
   `patients/patient-b/dayLogs/2026-10-24` → **مرفوض**.
2. **مريض يقرأ خطة مريض في عيادة أخرى** — `patient-a` يقرأ
   `patients/patient-b` → **مرفوض**.
3. **طبيب يقرأ مريضًا في عيادة أخرى** — `coach-a` يقرأ `patients/patient-b`
   → **مرفوض**.
4. **طبيب يعدّل `clinicId` لمريض** — `coach-a` يحدّث `patients/patient-a`
   بتغيير `clinicId` إلى `clinic-b` → **مرفوض**.
5. **مريض يكتب في `clinicAudit`** — `patient-a` يكتب في
   `clinicAudit/clinic-a/events/x` → **مرفوض** (الكتابة مرفوضة من الجميع).
6. **غير مسجّل يقرأ أي شيء** — بلا مصادقة، قراءة `clinics/clinic-a` أو أي
   مستند → **مرفوض**.
7. **أدمن داخل عيادته فقط** — `admin-a` يقرأ/يعدّل `clinics/clinic-a` ومرضى
   `clinic-a` → **مقبول**؛ نفس الإجراءات على `clinic-b` → **مرفوض**.
8. **تعديل `role` أو `clinicId` في `users/{uid}` من غير أدمن** — `coach-a`
   أو `patient-a` يعدّل `role`/`clinicId` في أي مستند مستخدم → **مرفوض**؛
   و`admin-a` نفسه لا يستطيع تغيير `role` أو `clinicId` لمستند موجود
   (التعديل مسموح فقط مع بقاء القيمتين كما هما) → **مرفوض**.

## حالات إضافية موصى بها قبل النشر

- مريض يقرأ خطته وسجلاته هو → مقبول.
- أدمن ينشئ مستخدمًا جديدًا في عيادته → مقبول؛ وفي عيادة أخرى → مرفوض.
- حذف أي مستند مستخدم من العميل → مرفوض دائمًا.
- قراءة `clinicAudit` من طبيب (غير أدمن) → مرفوض.
