// اختبارات ثابتة (static) لملف قواعد التخزين ووثيقة حالاته.
// ليست تقييمًا حيًا للقواعد: التقييم الحي يتم في Rules Playground أو
// محاكي التخزين قبل أي نشر (انظر storage.rules.test.md).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const rules = readFileSync(path.join(repoRoot, 'storage.rules'), 'utf8');
const rulesDoc = readFileSync(
  path.join(repoRoot, 'storage.rules.test.md'),
  'utf8',
);

describe('storage.rules content', () => {
  it('مسار الصور مطابق لمسار photos.ts', () => {
    expect(rules).toContain(
      'match /clinics/{cid}/patients/{pid}/photos/{photoId}',
    );
  });

  it('رفض افتراضي شامل في النهاية', () => {
    expect(rules).toContain('match /{allPaths=**}');
    expect(rules).toContain('allow read, write: if false;');
  });

  it('الوصول للمالك أو طاقم العيادة فقط', () => {
    expect(rules).toContain('canAccessPhoto(cid, pid)');
    expect(rules).toContain('request.auth.uid == pid');
    expect(rules).toContain("role() == 'coach'");
    expect(rules).toContain("role() == 'admin'");
  });

  it('قيود المحتوى: صور فقط وأقل من 10MB', () => {
    expect(rules).toContain("request.resource.contentType.matches('image/.*')");
    expect(rules).toContain('request.resource.size < 10 * 1024 * 1024');
  });

  it('يصرّح أن القواعد غير منشورة', () => {
    expect(rules).toContain('لم يُنشر');
  });

  it('وثيقة الحالات تغطي الحالات التسع', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(rulesDoc).toContain(`${n}.`);
    }
    expect(rulesDoc).toContain('10MB');
  });
});
