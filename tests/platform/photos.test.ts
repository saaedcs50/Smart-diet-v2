// اختبارات خالصة لمساعدات الصور (بلا Storage ولا شبكة).
import { describe, it, expect } from 'vitest';
import {
  MAX_PHOTO_SIZE_BYTES,
  newPhotoId,
  photoStoragePath,
  validatePhotoFile,
} from '../../src/platform/photos';

describe('photoStoragePath', () => {
  it('يبني المسار المتفق عليه مع storage.rules', () => {
    expect(photoStoragePath('clinic-a', 'patient-1', 'photo-9')).toBe(
      'clinics/clinic-a/patients/patient-1/photos/photo-9',
    );
  });
});

describe('newPhotoId', () => {
  it('ينتج معرّفًا غير فارغ وغير متكرر عادة', () => {
    const a = newPhotoId();
    const b = newPhotoId();
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});

describe('validatePhotoFile', () => {
  it('يقبل صورة ضمن الحد', () => {
    expect(validatePhotoFile({ type: 'image/jpeg', size: 1024 })).toBeNull();
  });

  it('يرفض غير الصور', () => {
    expect(validatePhotoFile({ type: 'application/pdf', size: 1024 })).not.toBeNull();
  });

  it('يرفض ما فوق 10MB', () => {
    expect(
      validatePhotoFile({ type: 'image/png', size: MAX_PHOTO_SIZE_BYTES + 1 }),
    ).not.toBeNull();
  });
});
