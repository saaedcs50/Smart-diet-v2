// ============================================================================
// تهيئة Firebase — المرحلة الأولى من بناء المنصة (وضع تجريبي فقط)
// ----------------------------------------------------------------------------
// - المشروع هنا هو مشروع تجريبي منفصل (Spark) بلا أي بيانات إنتاج وبلا أي
//   ربط بالإنتاج. إعدادات تطبيق الويب أدناه هي إعدادات عميل Firebase قياسية
//   (ليست مفاتيح خادم ولا أسرارًا) وتُشحن في حزمة التطبيق عند التفعيل.
// - الثبات بلا اتصال مفعّل عبر persistentLocalCache: القراءة والكتابة تعملان
//   بلا اتصال وتُزامن عند عودة الاتصال (مزامنة offline-first، دراسة §٧).
// - لا تُستدعى أي دالة من هذا الملف تلقائيًا عند بدء التطبيق الحالي: وضع
//   المنصة معطّل افتراضيًا (انظر platformMode.ts) ولا يوجد أي ربط له في
//   App.tsx في هذه المرحلة.
// ============================================================================

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

// إعدادات تطبيق الويب للمشروع التجريبي المنفصل.
const firebaseConfig = {
  apiKey: 'AIzaSyAJNbqEgWOttXLYD_3oRMUwlcPEfpiZJzY',
  authDomain: 'smart-diet-platform-trial.firebaseapp.com',
  projectId: 'smart-diet-platform-trial',
  storageBucket: 'smart-diet-platform-trial.firebasestorage.app',
  messagingSenderId: '1008856646338',
  appId: '1:1008856646338:web:a151cf526a949b1b8a715b',
};

function getFirebaseApp(): FirebaseApp {
  const existing = getApps();
  if (existing.length > 0) return existing[0];
  return initializeApp(firebaseConfig);
}

export const firebaseApp: FirebaseApp = getFirebaseApp();

export const firebaseAuth: Auth = getAuth(firebaseApp);

// الثبات بلا اتصال: ذاكرة محلية دائمة (IndexedDB) مع مدير تبويبات متعددة،
// حتى لا تتعارض نافذتان مفتوحتان لنفس الحساب على نفس الجهاز.
// في بيئة بلا IndexedDB (مثل اختبارات Node) يُستخدم Firestore العادي بدل
// أن يفشل الاستيراد — السلوك في المتصفح لا يتغير.
function createFirestore(): Firestore {
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    return getFirestore(firebaseApp);
  }
}

export const firestoreDb: Firestore = createFirestore();
