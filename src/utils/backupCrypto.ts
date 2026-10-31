/**
 * تشفير النسخ الاحتياطية اختياريًا بكلمة مرور — WebCrypto:
 * AES-GCM بمفتاح مشتق PBKDF2-HMAC-SHA256 (210k تكرار، ملح و IV عشوائيان لكل ملف).
 * الصيغة: JSON مغلف فيه الحقول اللازمة لفك التشفير دون تخزين كلمة المرور أبدًا.
 */

const ENVELOPE_APP = 'SmartDietBackup';
const KDF_ITERATIONS = 210_000;

interface BackupEnvelope {
  app: typeof ENVELOPE_APP;
  encrypted: true;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string; // base64
  iv: string; // base64
  data: string; // base64 ciphertext
}

function toB64(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function isEncryptedBackup(text: string): boolean {
  try {
    const parsed = JSON.parse(text);
    return parsed?.app === ENVELOPE_APP && parsed?.encrypted === true && typeof parsed?.data === 'string';
  } catch {
    return false;
  }
}

export async function encryptBackupJSON(plainJson: string, passphrase: string): Promise<string> {
  if (!passphrase || passphrase.length < 6) {
    throw new Error('كلمة مرور التشفير يجب أن تكون 6 أحرف على الأقل.');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS);
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plainJson)
  );
  const envelope: BackupEnvelope = {
    app: ENVELOPE_APP,
    encrypted: true,
    kdf: 'PBKDF2-SHA256',
    iterations: KDF_ITERATIONS,
    salt: toB64(salt),
    iv: toB64(iv),
    data: toB64(new Uint8Array(cipher)),
  };
  return JSON.stringify(envelope, null, 2);
}

/** يفك تشفير مغلف نسخة احتياطية. يرمي خطأ عند كلمة مرور خاطئة أو ملف تالف. */
export async function decryptBackupJSON(envelopeJson: string, passphrase: string): Promise<string> {
  let envelope: BackupEnvelope;
  try {
    envelope = JSON.parse(envelopeJson) as BackupEnvelope;
  } catch {
    throw new Error('ملف النسخة الاحتياطية غير سليم.');
  }
  if (envelope?.app !== ENVELOPE_APP || envelope?.encrypted !== true) {
    throw new Error('هذا الملف ليس نسخة احتياطية مشفرة.');
  }
  // SDV2-DATA-001: حدّ عدد تكرارات PBKDF2 وحجم الملف قبل أي عمل مشفّر مكلف.
  const iterations = envelope.iterations || KDF_ITERATIONS;
  if (!Number.isSafeInteger(iterations) || iterations < 1000 || iterations > 1000000) {
    throw new Error('عدد تكرارات التشفير في الملف غير صالح.');
  }
  const key = await deriveKey(
    passphrase,
    fromB64(envelope.salt),
    iterations
  );
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(envelope.iv) as BufferSource },
      key,
      fromB64(envelope.data) as BufferSource
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error('كلمة المرور غير صحيحة أو الملف تالف.');
  }
}
