// يحقن إعدادات Firebase في firebase-messaging-sw.js وقت البناء.
// القيم من متغيرات بيئة Vite (VITE_FIREBASE_*).
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const swPath = join(root, 'dist', 'firebase-messaging-sw.js');

const replacements = {
  __VITE_FIREBASE_API_KEY__: process.env.VITE_FIREBASE_API_KEY ?? '',
  __VITE_FIREBASE_AUTH_DOMAIN__: process.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  __VITE_FIREBASE_PROJECT_ID__: process.env.VITE_FIREBASE_PROJECT_ID ?? '',
  __VITE_FIREBASE_MESSAGING_SENDER_ID__:
    process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  __VITE_FIREBASE_APP_ID__: process.env.VITE_FIREBASE_APP_ID ?? '',
};

try {
  let content = readFileSync(swPath, 'utf-8');
  for (const [placeholder, value] of Object.entries(replacements)) {
    content = content.replaceAll(placeholder, value);
  }
  writeFileSync(swPath, content);
  console.log('SW config injected');
} catch (err) {
  console.warn('SW inject skipped:', err.message);
}
