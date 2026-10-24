// ============================================================================
// رفع صور التقدم — المرحلة الثانية من بناء المنصة
// ----------------------------------------------------------------------------
// - الملف نفسه يُرفع إلى Cloud Storage تحت
//   clinics/{clinicId}/patients/{uid}/photos/{photoId}، ومستند Firestore
//   يحمل metadata فقط (التاريخ والملاحظة ومسار الملف) — لا base64 في
//   Firestore أبدًا (دراسة §٣).
// - القواعد الحاكمة في storage.rules: المالك نفسه أو طاقم عيادته فقط،
//   ونوع المحتوى صورة وحجم أقل من 10MB. التحقق هنا يطابق القواعد حتى
//   تظهر رسالة واضحة قبل الرفع.
// - الصور لها موافقة مستقلة (دراسة §٦): رفع الصورة من الواجهة يعني
//   موافقة المريض على رفع هذه الصورة تحديدًا؛ لا يوجد رفع تلقائي لأي
//   صورة من IndexedDB المحلي في هذه المرحلة (الربط المتبقي موثق في PR).
// ============================================================================

import { collection, getDocs } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseStorage, getFirestoreDb } from './firebase';
import { savePhotoMeta, type PhotoMeta } from './firestore';

export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

// مسار الملف في Storage — دالة خالصة (قابلة للاختبار بلا شبكة).
export function photoStoragePath(
  clinicId: string,
  patientUid: string,
  photoId: string,
): string {
  return `clinics/${clinicId}/patients/${patientUid}/photos/${photoId}`;
}

export function newPhotoId(): string {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// تحقق خالص قبل الرفع: يطابق قيود storage.rules.
export function validatePhotoFile(file: {
  type: string;
  size: number;
}): string | null {
  if (!file.type.startsWith('image/')) {
    return 'الملف المختار ليس صورة.';
  }
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return 'حجم الصورة أكبر من 10MB المسموح بها.';
  }
  return null;
}

export interface UploadedPhotoMeta extends PhotoMeta {
  photoId: string;
  downloadUrl?: string;
}

export async function uploadPatientPhoto(input: {
  clinicId: string;
  patientUid: string;
  file: Blob;
  fileName: string;
  date: string;
  note?: string;
  editorUid: string;
}): Promise<UploadedPhotoMeta> {
  const error = validatePhotoFile({
    type: input.file.type,
    size: input.file.size,
  });
  if (error) throw new Error(error);
  const photoId = newPhotoId();
  const storagePath = photoStoragePath(input.clinicId, input.patientUid, photoId);
  const storageRef = ref(getFirebaseStorage(), storagePath);
  await uploadBytes(storageRef, input.file, {
    contentType: input.file.type || 'image/jpeg',
    customMetadata: { originalName: input.fileName },
  });
  const meta: PhotoMeta = {
    date: input.date,
    note: input.note,
    storagePath,
  };
  await savePhotoMeta(input.patientUid, photoId, meta, input.editorUid);
  let downloadUrl: string | undefined;
  try {
    downloadUrl = await getDownloadURL(storageRef);
  } catch {
    // رابط العرض اختياري — metadata محفوظة والملف مرفوع.
    downloadUrl = undefined;
  }
  return { photoId, ...meta, downloadUrl };
}

export async function listPhotoMetas(
  patientUid: string,
): Promise<UploadedPhotoMeta[]> {
  const snap = await getDocs(
    collection(getFirestoreDb(), 'patients', patientUid, 'photos'),
  );
  const out: UploadedPhotoMeta[] = [];
  for (const d of snap.docs) {
    const data = d.data() as Partial<PhotoMeta>;
    if (typeof data.date === 'string' && typeof data.storagePath === 'string') {
      out.push({
        photoId: d.id,
        date: data.date,
        note: data.note,
        storagePath: data.storagePath,
      });
    }
  }
  out.sort((a, b) => (a.date < b.date ? 1 : -1));
  return out;
}
