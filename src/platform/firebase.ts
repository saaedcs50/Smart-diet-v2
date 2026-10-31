// ============================================================================
// تهيئة Firebase — المرحلة الأولى من بناء المنصة (وضع تجريبي فقط)
// ----------------------------------------------------------------------------
// - المشروع هنا هو مشروع تجريبي منفصل (Spark) بلا أي بيانات إنتاج وبلا أي
//   ربط بالإنتاج.
// - إعدادات تطبيق الويب تُقرأ من متغيرات بيئة Vite (انظر .env.example) ولا
//   توجد أي قيمة حقيقية في هذا الريبو أبدًا: القيم الحقيقية للمشروع
//   التجريبي تُضبط في ملف .env المحلي أو في بيئة النشر فقط، وملف .env لا
//   يُرفع أبدًا. إعدادات الويب هذه معرّفات عميل بالتصميم (تُشحن في حزمة
//   التطبيق عند التفعيل)، والحماية الحقيقية تأتي من قواعد Firestore
//   (firestore.rules) لا من إخفاء هذه القيم.
// - الثبات بلا اتصال مفعّل عبر persistentLocalCache: القراءة والكتابة تعملان
//   بلا اتصال وتُزامن عند عودة الاتصال (مزامنة offline-first، دراسة §٧).
// - لا تُستدعى أي دالة من هذا الملف تلقائيًا عند بدء التطبيق الحالي: وضع
//   المنصة معطّل افتراضيًا (انظر platformMode.ts) ولا يوجد أي ربط له في
//   App.tsx في هذه المرحلة.
// - بلا متغيرات بيئة: التهيئة لا تنكسر عند الاستيراد (الاختبارات تعمل بلا
//   إعدادات)، لكن أي عملية مصادقة/بيانات فعلية ستفشل حتى تُضبط المتغيرات —
//   وهذا مقصود: لا إعدادات افتراضية ولا قيم تجريبية مضمّنة.
// ============================================================================

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getMessaging, type Messaging } from 'firebase/messaging';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// قراءة متغير بيئة واحد: import.meta.env أولًا (Vite) ثم process.env
// (vitest/Node)، بنفس نمط platformMode.ts.
function readEnv(name: string): string | undefined {
  const metaEnv = (import.meta as unknown as {
    env?: Record<string, string | undefined>;
  }).env?.[name];
  if (metaEnv !== undefined) return metaEnv;
  return (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env?.[name];
}

// إعدادات تطبيق الويب — تُقرأ عند كل استدعاء (لا عند تحميل الوحدة)،
// بنفس نمط platformMode.ts، حتى تعمل الاختبارات التي تضبط البيئة بعد
// الاستيراد، وحتى لا يلتقط البناء قيمة قديمة.
function readFirebaseConfig(): {
  apiKey: string | undefined;
  authDomain: string | undefined;
  projectId: string | undefined;
  storageBucket: string | undefined;
  messagingSenderId: string | undefined;
  appId: string | undefined;
} {
  return {
    apiKey: readEnv('VITE_FIREBASE_API_KEY'),
    authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: readEnv('VITE_FIREBASE_APP_ID'),
  };
}

// true فقط عندما تكون المتغيرات الأساسية حاضرة؛ تُستخدم عند ربط المنصة
// بالواجهة لاحقًا لإظهار رسالة إعداد واضحة بدل فشل غامض.
export function isFirebaseConfigured(): boolean {
  const config = readFirebaseConfig();
  return Boolean(config.apiKey && config.projectId);
}

function getFirebaseApp(): FirebaseApp {
  const existing = getApps();
  if (existing.length > 0) return existing[0];
  return initializeApp(readFirebaseConfig());
}

// تهيئة كسولة (lazy) عمدًا: استيراد هذا الملف لا يهيّئ شيئًا، لأن
// getAuth يرفض مفتاحًا غائبًا عند الاستدعاء. بهذا لا ينكسر الاستيراد
// (ولا الاختبارات) بلا متغيرات بيئة، وتفشل أي عملية فعلية برسالة واضحة
// بدل فشل غامض عند التحميل. لا تُستدعى هذه الدوال إلا عند تفعيل المنصة.
function requireConfigured(): void {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase غير مهيأ: اضبط متغيرات VITE_FIREBASE_* (انظر .env.example) قبل استخدام المنصة.',
    );
  }
}

export function getFirebaseAuth(): Auth {
  requireConfigured();
  return getAuth(getFirebaseApp());
}

let cachedStorage: FirebaseStorage | null = null;

// تهيئة كسولة للتخزين بنفس نمط Firestore: لا تُستدعى إلا في وضع المنصة
// المُفعَّل، وتفشل برسالة واضحة بلا إعدادات.
export function getFirebaseStorage(): FirebaseStorage {
  requireConfigured();
  if (!cachedStorage) cachedStorage = getStorage(getFirebaseApp());
  return cachedStorage;
}

// الثبات بلا اتصال: ذاكرة محلية دائمة (IndexedDB) مع مدير تبويبات متعددة،
// حتى لا تتعارض نافذتان مفتوحتان لنفس الحساب على نفس الجهاز.
// في بيئة بلا IndexedDB (مثل اختبارات Node) يُستخدم Firestore العادي بدل
// أن يفشل الاستدعاء — السلوك في المتصفح لا يتغير.
let cachedFirestore: Firestore | null = null;

let cachedMessaging: Messaging | null = null;

/** Messaging للـ FCM — يعيد null في بيئة بلا دعم (اختبارات Node). */
export function getFirebaseMessaging(): Messaging | null {
  try {
    requireConfigured();
    if (cachedMessaging) return cachedMessaging;
    cachedMessaging = getMessaging(getFirebaseApp());
    return cachedMessaging;
  } catch {
    return null;
  }
}

export function getFirestoreDb(): Firestore {
  requireConfigured();
  if (cachedFirestore) return cachedFirestore;
  const app = getFirebaseApp();
  try {
    cachedFirestore = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    cachedFirestore = getFirestore(app);
  }
  return cachedFirestore;
}
