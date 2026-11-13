import { PhotoRecord } from '../types';
import { StorageKeys } from './storageKeys';

const DB_VERSION = 1;
const STORE_NAME = 'progress_photos';

function openNamedPhotoDB(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('ts', 'ts', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function openPhotoDB(): Promise<IDBDatabase> {
  // Each platform account gets a separate database. Never auto-copy historical
  // photos into another account's bucket; the unscoped legacy DB stays intact.
  return openNamedPhotoDB(StorageKeys.photoDbName());
}

export async function addPhotoToDB(record: Omit<PhotoRecord, 'id'>): Promise<number> {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export const savePhotoToDB = addPhotoToDB;

export async function getPhotosForDate(dateStr: string): Promise<PhotoRecord[]> {
  const all = await getAllPhotosFromDB();
  return all.filter((p) => p.date === dateStr);
}

export async function getAllPhotosFromDB(): Promise<PhotoRecord[]> {
  try {
    const db = await openPhotoDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list: PhotoRecord[] = req.result || [];
        list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.ts - a.ts);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('Failed to get photos from IDB', e);
    return [];
  }
}

export async function deletePhotoFromDB(id: number): Promise<boolean> {
  try {
    const db = await openPhotoDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('Failed to delete photo', e);
    return false;
  }
}

export interface CompressionResult {
  dataUrl: string;
  originalSizeKb: number;
  compressedSizeKb: number;
  savedPercent: number;
  format: string;
}

export function compressImageWithStats(
  file: File,
  maxDimension = 1200,
  initialQuality = 0.8
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    const originalSizeKb = Math.round(file.size / 1024);
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first for superior compression, fallback to JPEG
        let chosenFormat = 'image/webp';
        let dataUrl = canvas.toDataURL('image/webp', initialQuality);

        if (!dataUrl.startsWith('data:image/webp')) {
          chosenFormat = 'image/jpeg';
          dataUrl = canvas.toDataURL('image/jpeg', initialQuality);
        }

        // Calculate compressed size in KB from base64 string
        const base64Length = dataUrl.length - (dataUrl.indexOf(',') + 1);
        const compressedSizeBytes = (base64Length * 3) / 4;
        const compressedSizeKb = Math.round(compressedSizeBytes / 1024);

        const savedPercent = originalSizeKb > 0 
          ? Math.max(0, Math.round(((originalSizeKb - compressedSizeKb) / originalSizeKb) * 100))
          : 0;

        resolve({
          dataUrl,
          originalSizeKb,
          compressedSizeKb,
          savedPercent,
          format: chosenFormat,
        });
      };
      img.onerror = () => reject(new Error('Image decode error'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function processAndCompressImage(file: File, maxDimension = 1200, quality = 0.8): Promise<string> {
  const result = await compressImageWithStats(file, maxDimension, quality);
  return result.dataUrl;
}
