import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // فصل مكتبات البائع في شحنة ثابتة تُخزَّن مؤقتًا عبر الإصدارات
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-motion': ['motion'],
            // المسارات الفرعية الفعلية المستوردة (الحزمة 'firebase' نفسها بلا نقطة دخول)
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            'vendor-pdf': ['jspdf', 'html2canvas'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    // اختبار المحاكي يحتاج Firestore Emulator — يُستبعد من التشغيل الافتراضي
    // ويُشغَّل عبر npm run test:rules فقط
    test: {
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        'tests/platform/firestoreEmulator.test.ts',
      ],
    },
  };
});
