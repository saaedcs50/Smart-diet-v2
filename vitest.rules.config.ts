import { defineConfig } from 'vitest/config';

// إعداد مستقل لاختبار محاكي Firestore — يتجاوز استبعاد vite.config.ts
// يُشغَّل عبر `npm run test:rules` فقط (المحاكي يعمل على 127.0.0.1:8089)
export default defineConfig({
  test: {
    include: ['tests/platform/firestoreEmulator.test.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
