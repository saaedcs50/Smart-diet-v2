# اختبار قواعد Cloud Storage — المرحلة الثانية (غير منفذ هنا)

> ملف `storage.rules` مكتوب للمراجعة فقط ولم يُنشر من بيئة البناء هذه.
> نشر القواعد يحتاج Firebase CLI بتسجيل دخول (`firebase deploy --only
> storage` من مجلد المشروع بعد `firebase login` و`firebase use
> smart-diet-platform-trial`) — وهذه الخطوة خارج نطاق هذه المرحلة.
> الحالات أدناه تُنفذ في Rules Playground أو محاكي التخزين (Emulator Suite)
> قبل أي نشر، ببيانات تجريبية فقط وبلا أي مستخدم حقيقي.

## إعداد الاختبار (بيانات تجريبية)

- عيادة `clinic-a` و`clinic-b`.
- أدمن `admin-a` بمستند `users/admin-a` = `{ role: 'admin', clinicId: 'clinic-a' }`.
- طبيب `coach-a` بمستند `users/coach-a` = `{ role: 'coach', clinicId: 'clinic-a' }`.
- مريض `patient-a` بمستند `users/patient-a` = `{ role: 'patient', clinicId: 'clinic-a' }`
  ومستند `patients/patient-a` = `{ clinicId: 'clinic-a', ... }`.
- مريض `patient-b` في `clinic-b` بالشكل نفسه.
- مسار الصورة: `clinics/clinic-a/patients/patient-a/photos/photo-1`.

## الحالات

1. **المريض يقرأ صورته** — `patient-a` يقرأ مسار صورته → **مقبول**.
2. **المريض يقرأ صورة مريض آخر** — `patient-a` يقرأ
   `clinics/clinic-b/patients/patient-b/photos/photo-1` → **مرفوض**.
3. **المريض يرفع صورته** — `patient-a` يرفع صورة (نوع `image/jpeg`، أقل من
   10MB) إلى مساره → **مقبول**.
4. **رفع غير صورة** — `patient-a` يرفع ملفًا بنوع `application/pdf` →
   **مرفوض**.
5. **رفع أكبر من 10MB** — `patient-a` يرفع صورة 11MB → **مرفوض**.
6. **طبيب يقرأ/يرفع صور مريض عيادته** — `coach-a` على مسار `patient-a` →
   **مقبول**؛ على مسار `patient-b` → **مرفوض**.
7. **غير مسجّل يقرأ أي شيء** — بلا مصادقة → **مرفوض**.
8. **مسار خارج النمط** — أي قراءة/كتابة خارج
   `clinics/{cid}/patients/{pid}/photos/{photoId}` → **مرفوض**.
9. **حذف صورة** — `patient-a` يحذف صورته → **مقبول**؛ `patient-b` يحذف
   صورة `patient-a` → **مرفوض**.

## ملاحظة عن التقييم الحي

قواعد التخزين تقرأ مستندات Firestore عبر `firestore.get()`، لذلك يتطلب
التقييم الحي وجود مستندات `users/` و`patients/` التجريبية أعلاه في محاكي
Firestore أو في المشروع التجريبي قبل اختبار التخزين.
