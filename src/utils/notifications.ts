// OS-Resilient PWA & Local Notification System with Self-Healing SW & Catch-Up Logic
import { getTodayDateString, loadPlanFromStorage, loadDayLog, getActiveFastingSession } from './storage';
import { PlanConfig, DayLog, MedicationSlot, MedicationItem } from '../types';
import { getAllScheduledDoses, WITH_FOOD_LABELS } from './medications';
import { calculateStreak } from './calculations';
import { shouldFireStreakReminder, buildStreakReminderMessage } from './streakReminder';
import { BRAND } from '../config/brand';
import { StorageKeys } from './storageKeys';

export interface MealReminderConfig {
 id: string;
 name: string;
 time: string; // HH:mm format (24h)
 enabled: boolean;
}

export interface MedicationReminderSettings {
 enabled: boolean;
 offsetMinutesBeforeMeal: number; // e.g. 15 or 30 mins before/after meals
 disabledMedicationIds: string[]; // Specific medication IDs turned off
 customSlotTimes?: Partial<Record<MedicationSlot, string>>; // Optional custom time overrides
}

export interface SleepReminderSettings {
 enabled: boolean;
 time: string; // HH:mm (default 22:30)
 morningCheckEnabled: boolean; // Gentle morning reminder to log sleep
 morningTime: string; // HH:mm (default 08:00)
}

export interface HabitsReminderSettings {
 enabled: boolean;
 time: string; // HH:mm (default 10:00)
}

export interface WeeklyWeightReminderSettings {
 enabled: boolean;
 weekday: number; // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday (default: 6 - السبت)
 time: string; // HH:mm (default 09:00)
}

export interface FastingReminderSettings {
 enabled: boolean;
 notifyOnComplete: boolean;
}

export interface StreakReminderSettings {
 enabled: boolean;
 time: string; // HH:mm (default 20:30) — Batch 1.4: تنبيه «السلسلة في خطر»
}

export interface NotificationSettings {
 enabled: boolean;
 sound: boolean;
 vibrate: boolean;
 waterReminders: {
 enabled: boolean;
 intervalMinutes: number; // 30, 45, 60, 90, 120
 startHour: number; // e.g. 8 (8 AM)
 endHour: number; // e.g. 23 (11 PM)
 };
 mealReminders: {
 enabled: boolean;
 meals: MealReminderConfig[];
 };
 medicationReminders: MedicationReminderSettings;
 sleepReminder: SleepReminderSettings;
 habitsReminder: HabitsReminderSettings;
 weeklyWeightReminder: WeeklyWeightReminderSettings;
 fastingReminders: FastingReminderSettings;
 streakReminder: StreakReminderSettings;
 workoutReminder: {
 enabled: boolean;
 time: string; // HH:mm
 };
 nightReviewReminder: {
 enabled: boolean;
 time: string; // HH:mm
 };
}

export interface SystemStatusInfo {
 isSupported: boolean;
 permission: NotificationPermission;
 swRegistered: boolean;
 swActive: boolean;
 isPWAStandalone: boolean;
 isIOS: boolean;
 isAndroid: boolean;
 supportsTriggers: boolean;
}

// Resolve keys when accessed so account switching cannot retain the previous UID's bucket.
const STORAGE_KEY = () => StorageKeys.notificationSettings();
const LAST_WATER_NOTIF_KEY = () => StorageKeys.lastWaterNotif();
const FIRED_TODAY_KEY = () => StorageKeys.firedNotifsToday(); // JSON { date, keys }
const LAST_APP_BOOT_KEY = () => StorageKeys.lastAppBoot();

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
 enabled: false,
 sound: true,
 vibrate: true,
 waterReminders: {
 enabled: true,
 intervalMinutes: 60,
 startHour: 8,
 endHour: 23,
 },
 mealReminders: {
 enabled: true,
 meals: [
 { id: 'm1', name: 'وجبة الإفطار', time: '08:30', enabled: true },
 { id: 'm2', name: 'سناك خفيف 1', time: '12:00', enabled: true },
 { id: 'm3', name: 'وجبة الغداء', time: '15:30', enabled: true },
 { id: 'm4', name: 'سناك خفيف 2', time: '18:30', enabled: true },
 { id: 'm5', name: 'وجبة العشاء', time: '21:30', enabled: true },
 ],
 },
 medicationReminders: {
 enabled: false,
 offsetMinutesBeforeMeal: 15,
 disabledMedicationIds: [],
 customSlotTimes: {},
 },
 sleepReminder: {
 enabled: false,
 time: '22:30',
 morningCheckEnabled: false,
 morningTime: '08:00',
 },
 habitsReminder: {
 enabled: false,
 time: '10:00',
 },
 weeklyWeightReminder: {
 enabled: false,
 weekday: 6, // السبت
 time: '09:00',
 },
 fastingReminders: {
 enabled: false,
 notifyOnComplete: true,
 },
 streakReminder: {
 enabled: true,
 time: '20:30',
 },
 workoutReminder: {
 enabled: false,
 time: '17:30',
 },
 nightReviewReminder: {
 enabled: true,
 time: '22:30',
 },
};

// Device & PWA Environment Detection
export function getDeviceInfo() {
 if (typeof window === 'undefined') {
 return { isIOS: false, isAndroid: false, isPWAStandalone: false };
 }

 const ua = navigator.userAgent || '';
 const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
 const isAndroid = /Android/i.test(ua);
 const isPWAStandalone =
 window.matchMedia('(display-mode: standalone)').matches ||
 (window.navigator as unknown as { standalone?: boolean }).standalone === true;

 return { isIOS, isAndroid, isPWAStandalone };
}

// Check Notification Triggers API support (TimestampTrigger)
export function supportsNotificationTriggers(): boolean {
 return typeof window!== 'undefined' && 'showTrigger' in Notification.prototype;
}

// Service Worker Self-Healing & Registration
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
 if (typeof window === 'undefined' ||!('serviceWorker' in navigator)) {
 return null;
 }
 try {
 const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
 await reg.update().catch(() => {}); // Force background update check
 return reg;
 } catch (err) {
 console.warn('SW registration failed:', err);
 return null;
 }
}

// Health check to verify Service Worker responsiveness
export async function checkSWHealth(): Promise<boolean> {
 if (typeof window === 'undefined' ||!('serviceWorker' in navigator)) return false;
 try {
 const reg = await navigator.serviceWorker.ready;
 const activeWorker = reg?.active;
 if (!activeWorker) return false;

 return new Promise((resolve) => {
 const channel = new MessageChannel();
 const timeout = setTimeout(() => resolve(false), 1500);

 channel.port1.onmessage = (event) => {
 clearTimeout(timeout);
 if (event.data && event.data.status === 'OK') {
 resolve(true);
 } else {
 resolve(false);
 }
 };

 activeWorker.postMessage({ type: 'SW_HEALTH_CHECK' }, [channel.port2]);
 });
 } catch (e) {
 return false;
 }
}

// Overall system status
export async function getSystemNotificationStatus(): Promise<SystemStatusInfo> {
 const { isIOS, isAndroid, isPWAStandalone } = getDeviceInfo();
 const isSupported = typeof window!== 'undefined' && 'Notification' in window;
 const permission = isSupported? Notification.permission: 'denied';
 let swRegistered = false;
 let swActive = false;

 if (typeof window!== 'undefined' && 'serviceWorker' in navigator) {
 const reg = await navigator.serviceWorker.getRegistration('/');
 swRegistered =!!reg;
 swActive = await checkSWHealth();
 }

 return {
 isSupported,
 permission,
 swRegistered,
 swActive,
 isPWAStandalone,
 isIOS,
 isAndroid,
 supportsTriggers: supportsNotificationTriggers(),
 };
}

export function isNotificationSupported(): boolean {
 return typeof window!== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission {
 if (!isNotificationSupported()) return 'denied';
 return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
 if (!isNotificationSupported()) return false;
 try {
 const permission = await Notification.requestPermission();
 if (permission === 'granted') {
 await registerServiceWorker();
 return true;
 }
 return false;
 } catch (e) {
 console.error('Error requesting notification permission:', e);
 return false;
 }
}

export function loadNotificationSettings(): NotificationSettings {
 if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_SETTINGS;
 try {
 const raw = localStorage.getItem(STORAGE_KEY());
 if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
 const parsed = JSON.parse(raw);
 return {
...DEFAULT_NOTIFICATION_SETTINGS,
...parsed,
 waterReminders: {
...DEFAULT_NOTIFICATION_SETTINGS.waterReminders,
...(parsed.waterReminders || {}),
 },
 mealReminders: {
...DEFAULT_NOTIFICATION_SETTINGS.mealReminders,
...(parsed.mealReminders || {}),
 },
 medicationReminders: {
...DEFAULT_NOTIFICATION_SETTINGS.medicationReminders,
...(parsed.medicationReminders || {}),
 },
 sleepReminder: {
...DEFAULT_NOTIFICATION_SETTINGS.sleepReminder,
...(parsed.sleepReminder || {}),
 },
 habitsReminder: {
...DEFAULT_NOTIFICATION_SETTINGS.habitsReminder,
...(parsed.habitsReminder || {}),
 },
 weeklyWeightReminder: {
...DEFAULT_NOTIFICATION_SETTINGS.weeklyWeightReminder,
...(parsed.weeklyWeightReminder || {}),
 },
 fastingReminders: {
...DEFAULT_NOTIFICATION_SETTINGS.fastingReminders,
...(parsed.fastingReminders || {}),
 },
 streakReminder: {
...DEFAULT_NOTIFICATION_SETTINGS.streakReminder,
...(parsed.streakReminder || {}),
 },
 workoutReminder: {
...DEFAULT_NOTIFICATION_SETTINGS.workoutReminder,
...(parsed.workoutReminder || {}),
 },
 nightReviewReminder: {
...DEFAULT_NOTIFICATION_SETTINGS.nightReviewReminder,
...(parsed.nightReviewReminder || {}),
 },
 };
 } catch (e) {
 return DEFAULT_NOTIFICATION_SETTINGS;
 }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
 if (typeof window === 'undefined') return;
 try {
 localStorage.setItem(STORAGE_KEY(), JSON.stringify(settings));
 } catch (e) {
 console.error('Failed to save notification settings:', e);
 }
}

// Time manipulation helpers
export function parseTimeString(timeStr: string): { hours: number; minutes: number } {
 const [h, m] = (timeStr || '12:00').split(':').map(Number);
 return { 
 hours: isNaN(h)? 12: Math.max(0, Math.min(23, h)), 
 minutes: isNaN(m)? 0: Math.max(0, Math.min(59, m)) 
 };
}

export function formatTimeString(hours: number, minutes: number): string {
 const totalMinutes = ((hours * 60 + minutes) % (24 * 60) + (24 * 60)) % (24 * 60);
 const normalizedHours = Math.floor(totalMinutes / 60);
 const normalizedMinutes = totalMinutes % 60;
 return `${String(normalizedHours).padStart(2, '0')}:${String(normalizedMinutes).padStart(2, '0')}`;
}

export function addMinutesToTimeString(timeStr: string, minutesToAdd: number): string {
 const { hours, minutes } = parseTimeString(timeStr);
 return formatTimeString(hours, minutes + minutesToAdd);
}

// Helper to find meal time from meal list by keywords
export function getMealTimeByKeywords(
 meals: MealReminderConfig[], 
 keywords: string[], 
 fallbackIndex: number, 
 fallbackTime: string
): string {
 const matched = meals.find((m) => {
 const n = m.name.toLowerCase();
 return keywords.some((k) => n.includes(k.toLowerCase()));
 });
 if (matched?.time) return matched.time;
 if (meals[fallbackIndex]?.time) return meals[fallbackIndex].time;
 return fallbackTime;
}

// Resolve approximate scheduled time for a medication slot based on meal settings
export function getMedicationSlotEstimatedTime(
 slot: MedicationSlot,
 meals: MealReminderConfig[],
 customSlotTimes?: Partial<Record<MedicationSlot, string>>,
 offsetMinutes: number = 15
): string | null {
 // If user provided a custom override for this slot, use it
 if (customSlotTimes && customSlotTimes[slot]) {
 return customSlotTimes[slot]!;
 }

 if (slot === 'prn') {
 return null; // PRN is as needed, no fixed automatic alarm
 }

 const breakfastTime = getMealTimeByKeywords(meals, ['إفطار', 'فطور', 'breakfast'], 0, '08:30');
 const lunchTime = getMealTimeByKeywords(meals, ['غداء', 'غدا', 'lunch'], 2, '15:30');
 const dinnerTime = getMealTimeByKeywords(meals, ['عشاء', 'عشا', 'dinner'], 4, '21:30');

 switch (slot) {
 case 'before_breakfast':
 return addMinutesToTimeString(breakfastTime, -Math.max(15, offsetMinutes));
 case 'with_breakfast':
 return breakfastTime;
 case 'after_breakfast':
 return addMinutesToTimeString(breakfastTime, Math.max(15, offsetMinutes));

 case 'before_lunch':
 return addMinutesToTimeString(lunchTime, -Math.max(15, offsetMinutes));
 case 'with_lunch':
 return lunchTime;
 case 'after_lunch':
 return addMinutesToTimeString(lunchTime, Math.max(15, offsetMinutes));

 case 'before_dinner':
 return addMinutesToTimeString(dinnerTime, -Math.max(15, offsetMinutes));
 case 'with_dinner':
 return dinnerTime;
 case 'after_dinner':
 return addMinutesToTimeString(dinnerTime, Math.max(15, offsetMinutes));

 case 'morning':
 return '08:00';
 case 'evening':
 return '20:00';
 case 'before_sleep':
 return '22:30';

 default:
 return '12:00';
 }
}

// Multi-tone Web Audio API sound generator
export function playChimeSound(type: 'water' | 'meal' | 'medication' | 'sleep' | 'workout' | 'test' = 'meal'): void {
 try {
 const AudioCtx =
 window.AudioContext ||
 (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
 if (!AudioCtx) return;
 const ctx = new AudioCtx();

 if (type === 'water') {
 // Gentle water drop sound (Pitch rise)
 const osc = ctx.createOscillator();
 const gain = ctx.createGain();
 osc.type = 'sine';
 osc.frequency.setValueAtTime(800, ctx.currentTime);
 osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.15);
 gain.gain.setValueAtTime(0.3, ctx.currentTime);
 gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
 osc.connect(gain);
 gain.connect(ctx.destination);
 osc.start(ctx.currentTime);
 osc.stop(ctx.currentTime + 0.25);
 } else if (type === 'medication') {
 // Crisp, pleasant double chime for medication
 const osc1 = ctx.createOscillator();
 const gain1 = ctx.createGain();
 osc1.type = 'sine';
 osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
 gain1.gain.setValueAtTime(0.2, ctx.currentTime);
 gain1.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
 osc1.connect(gain1);
 gain1.connect(ctx.destination);
 osc1.start(ctx.currentTime);
 osc1.stop(ctx.currentTime + 0.25);

 const osc2 = ctx.createOscillator();
 const gain2 = ctx.createGain();
 osc2.type = 'sine';
 osc2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.1); // D6
 gain2.gain.setValueAtTime(0, ctx.currentTime);
 gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.1);
 gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
 osc2.connect(gain2);
 gain2.connect(ctx.destination);
 osc2.start(ctx.currentTime + 0.1);
 osc2.stop(ctx.currentTime + 0.5);
 } else if (type === 'sleep') {
 // Soft calming low chime
 const osc = ctx.createOscillator();
 const gain = ctx.createGain();
 osc.type = 'triangle';
 osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
 osc.frequency.exponentialRampToValueAtTime(329.63, ctx.currentTime + 0.8); // E4
 gain.gain.setValueAtTime(0.2, ctx.currentTime);
 gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
 osc.connect(gain);
 gain.connect(ctx.destination);
 osc.start(ctx.currentTime);
 osc.stop(ctx.currentTime + 0.8);
 } else {
 // Pleasant 2-tone melodic chime
 const osc1 = ctx.createOscillator();
 const gain1 = ctx.createGain();
 osc1.type = 'sine';
 osc1.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
 gain1.gain.setValueAtTime(0.2, ctx.currentTime);
 gain1.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
 osc1.connect(gain1);
 gain1.connect(ctx.destination);
 osc1.start(ctx.currentTime);
 osc1.stop(ctx.currentTime + 0.4);

 const osc2 = ctx.createOscillator();
 const gain2 = ctx.createGain();
 osc2.type = 'sine';
 osc2.frequency.setValueAtTime(987.77, ctx.currentTime + 0.12); // B5
 gain2.gain.setValueAtTime(0, ctx.currentTime);
 gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.12);
 gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.65);
 osc2.connect(gain2);
 gain2.connect(ctx.destination);
 osc2.start(ctx.currentTime + 0.12);
 osc2.stop(ctx.currentTime + 0.65);
 }
 } catch (e) {
 // AudioContext blocked until user gesture, ignore safely
 }
}

// Send local or Service Worker notification
export async function sendLocalNotification(
 title: string,
 body: string,
 tag: string = 'general',
 playSound: boolean = true,
 soundType: 'water' | 'meal' | 'medication' | 'sleep' | 'workout' | 'test' = 'meal'
): Promise<boolean> {
 if (!isNotificationSupported()) return false;
 if (Notification.permission!== 'granted') return false;

 if (playSound) {
 playChimeSound(soundType);
 }

 const options: Record<string, any> = {
 body,
 icon: BRAND.logoPath || '/icon.svg',
 badge: BRAND.logoPath || '/icon.svg',
 tag,
 renotify: true,
 vibrate: [200, 100, 200, 100, 300],
 data: { url: window.location.origin, timestamp: Date.now() },
 };

 try {
 if ('serviceWorker' in navigator) {
 const reg = await navigator.serviceWorker.ready;
 if (reg && reg.showNotification) {
 await reg.showNotification(title, options as NotificationOptions);
 return true;
 }
 }
 } catch (e) {
 console.warn('SW showNotification fallback:', e);
 }

 try {
 new Notification(title, options as NotificationOptions);
 return true;
 } catch (e) {
 console.error('Notification error:', e);
 return false;
 }
}

const WATER_MESSAGES = [
 'روّق على جسمك بكوباية مية دلوقتي! ترطيبك سر حرقك العالي.',
 'المية سر طاقتك ونضارة بشرتك! متنساش تشرب كوباية مية حالا ',
 'صحتك في كوباية مية! املى كبايتك وكمّل التزامك الجميل ',
 'جسمك محتاج يترطب! اشرب كوباية مية عشان تحافظ على نشاطك ومعدل الأيض ',
 'كل كوباية مية بتفرق في حرقك وصحتك، اشرب دلوقتي واستمتع بالانتعاش! ',
];

export function getRandomWaterMessage(): string {
 const idx = Math.floor(Math.random() * WATER_MESSAGES.length);
 return WATER_MESSAGES[idx];
}

export function syncMealRemindersWithPlan(
 settings: NotificationSettings,
 planMeals: Array<{ id: string; name: string }>
): NotificationSettings {
 const currentMealReminders = [...settings.mealReminders.meals];
 const newMeals: MealReminderConfig[] = [];
 const defaultTimes = ['08:30', '12:00', '15:30', '18:30', '21:30', '23:00'];

 planMeals.forEach((pm, idx) => {
 const existing = currentMealReminders.find((m) => m.id === pm.id || m.name === pm.name);
 if (existing) {
 newMeals.push({
...existing,
 id: pm.id,
 name: pm.name,
 });
 } else {
 newMeals.push({
 id: pm.id,
 name: pm.name,
 time: defaultTimes[idx % defaultTimes.length] || '14:00',
 enabled: true,
 });
 }
 });

 return {
...settings,
 mealReminders: {
...settings.mealReminders,
 meals: newMeals,
 },
 };
}

// Background Reminder Checker (invoked on interval)
export function checkAndTriggerReminders(
 settings: NotificationSettings,
 planOverride?: PlanConfig,
 dayOverride?: DayLog
): void {
 if (!settings.enabled) return;
 if (getNotificationPermission()!== 'granted') return;

 const now = new Date();
 const todayDateStr = getTodayDateString(now);
 const currentHour = now.getHours();
 const currentMinutes = now.getMinutes();
 const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;
 const currentWeekday = now.getDay(); // 0 = Sunday, 6 = Saturday

 // Load plan and day if not passed
 let plan = planOverride;
 if (!plan) {
 try {
 plan = loadPlanFromStorage();
 } catch (e) {}
 }

 let day = dayOverride;
 if (!day) {
 try {
 day = loadDayLog(todayDateStr);
 } catch (e) {}
 }

 let firedKeys: Record<string, boolean> = {};
 try {
 const raw = localStorage.getItem(FIRED_TODAY_KEY());
 if (raw) {
 const parsed = JSON.parse(raw);
 if (parsed.date === todayDateStr) {
 firedKeys = parsed.keys || {};
 }
 }
 } catch (e) {}

 const markKeyFired = (key: string) => {
 firedKeys[key] = true;
 try {
 localStorage.setItem(FIRED_TODAY_KEY(), JSON.stringify({ date: todayDateStr, keys: firedKeys }));
 } catch (e) {}
 };

 // 1. Water Reminders
 if (settings.waterReminders.enabled) {
 if (currentHour >= settings.waterReminders.startHour && currentHour <= settings.waterReminders.endHour) {
 const lastWaterTime = Number(localStorage.getItem(LAST_WATER_NOTIF_KEY()) || '0');
 const intervalMs = settings.waterReminders.intervalMinutes * 60 * 1000;
 const nowMs = Date.now();

 if (nowMs - lastWaterTime >= intervalMs) {
 sendLocalNotification(
 'تذكير شرب الماء ',
 getRandomWaterMessage(),
 'water-reminder',
 settings.sound,
 'water'
 );
 localStorage.setItem(LAST_WATER_NOTIF_KEY(), String(nowMs));
 }
 }
 }

 // 2. Meal Reminders
 if (settings.mealReminders.enabled) {
 settings.mealReminders.meals.forEach((meal) => {
 if (meal.enabled && meal.time === currentTimeStr) {
 const key = `meal_${meal.id}_${currentTimeStr}`;
 if (!firedKeys[key]) {
 markKeyFired(key);
 sendLocalNotification(
 `موعد وجبتك: ${meal.name} `,
 `حان موعد تناول "${meal.name}" المقررة في خطتك الغذائية مع ${BRAND.doctorName}. بالهنا والشفا!`,
 `meal-${meal.id}`,
 settings.sound,
 'meal'
 );
 }
 }
 });
 }

 // 3. Medication Reminders (High Priority)
 if (settings.medicationReminders?.enabled && plan?.medicationPlan?.items) {
 const disabledIds = new Set(settings.medicationReminders.disabledMedicationIds || []);
 const activeMeds = (plan.medicationPlan.items || []).filter(
 (m: MedicationItem) => m.active!== false &&!disabledIds.has(m.id)
 );

 const scheduled = getAllScheduledDoses(activeMeds);
 scheduled.forEach((dose) => {
 if (dose.isPRN) return; // Skip as-needed

 const scheduledTime = getMedicationSlotEstimatedTime(
 dose.slot,
 settings.mealReminders.meals,
 settings.medicationReminders.customSlotTimes,
 settings.medicationReminders.offsetMinutesBeforeMeal || 15
 );

 if (scheduledTime === currentTimeStr) {
 // If already taken today in dayLog, don't nag
 const doseEntry = day?.medications?.[dose.key];
 if (doseEntry && doseEntry.status === 'taken') {
 return;
 }

 const key = `med_${dose.key}_${currentTimeStr}`;
 if (!firedKeys[key]) {
 markKeyFired(key);
 const withFoodHint = dose.withFood && WITH_FOOD_LABELS[dose.withFood] 
? ` (${WITH_FOOD_LABELS[dose.withFood].label})`
: '';
 
 sendLocalNotification(
 `تذكير موعد الدواء: ${dose.medicationName} `,
 `حان موعد جرعة "${dose.medicationName}" (${dose.dose}) - ${dose.slotLabel}.${withFoodHint}`,
 `med-${dose.key}`,
 settings.sound,
 'medication'
 );
 }
 }
 });
 }

 // 4. Sleep Reminders (Evening & Morning Quality Check)
 if (settings.sleepReminder?.enabled) {
 // 4a. Evening Bedtime Reminder
 if (settings.sleepReminder.time === currentTimeStr) {
 const key = `sleep_bedtime_${currentTimeStr}`;
 if (!firedKeys[key]) {
 markKeyFired(key);
 sendLocalNotification(
 'اقترب موعد النوم والراحة ',
 'احرص على تهدئة الأجواء وإراحة عقلك وجسمك. نومك الكافي هو سر نشاطك وصحتك غداً!',
 'sleep-bedtime',
 settings.sound,
 'sleep'
 );
 }
 }

 // 4b. Optional Morning Sleep Logging Reminder
 if (
 settings.sleepReminder.morningCheckEnabled &&
 settings.sleepReminder.morningTime === currentTimeStr
 ) {
 // Check if sleep already logged today
 const hasSleepLogged = day && day.sleep && day.wake && day.quality;
 if (!hasSleepLogged) {
 const key = `sleep_morning_${currentTimeStr}`;
 if (!firedKeys[key]) {
 markKeyFired(key);
 sendLocalNotification(
 'تسجيل ساعات النوم',
 'يُرجى تسجيل ساعات وجودة نومك الليلة الماضية في التطبيق.',
 'sleep-morning',
 settings.sound,
 'sleep'
 );
 }
 }
 }
 }

 // 5. Habits & Daily Supplements Reminder
 if (settings.habitsReminder?.enabled && settings.habitsReminder.time === currentTimeStr) {
 const hasSupplements = plan?.supplements && plan.supplements.length > 0;
 const hasChecklist = plan?.checklist && plan.checklist.length > 0;

 if (hasSupplements || hasChecklist) {
 const key = `habits_${currentTimeStr}`;
 if (!firedKeys[key]) {
 markKeyFired(key);
 sendLocalNotification(
 'تذكير العادات والمكملات اليومية ',
 `تفقد قائمة مهامك ومكملاتك المقررة لليوم واحرص على توثيق ما أنجزته مع ${BRAND.doctorName}.`,
 'habits-reminder',
 settings.sound,
 'meal'
 );
 }
 }
 }

 // 6. Intermittent Fasting Window Complete Reminder
 if (settings.fastingReminders?.enabled) {
 const activeFasting = getActiveFastingSession();
 if (activeFasting.isActive && activeFasting.startTime) {
 const targetHours = activeFasting.targetHours || plan?.fastingTargetHours || 16;
 const elapsedHours = (Date.now() - activeFasting.startTime) / (1000 * 60 * 60);

 if (elapsedHours >= targetHours) {
 const key = `fasting_complete_${activeFasting.startTime}`;
 if (!firedKeys[key]) {
 markKeyFired(key);
 sendLocalNotification(
 'اكتمال ساعات الصيام',
 `أتممت ${targetHours} ساعة صيام. بدأت نافذة تناول الوجبات المقررة.`,
 'fasting-completed',
 settings.sound,
 'meal'
 );
 }
 }
 }
 }

 // 7. Weekly Weight Measurement Reminder
 if (settings.weeklyWeightReminder?.enabled) {
 const targetWeekday = settings.weeklyWeightReminder.weekday ?? 6;
 if (currentWeekday === targetWeekday && settings.weeklyWeightReminder.time === currentTimeStr) {
 const key = `weekly_weight_${todayDateStr}`;
 if (!firedKeys[key]) {
 markKeyFired(key);
 sendLocalNotification(
 'موعد تسجيل الوزن الأسبوعي',
 'حان وقت قياس وزنك الصباحي (على الريق) وتسجيله في التطبيق.',
 'weekly-weight',
 settings.sound,
 'meal'
 );
 }
 }
 }

 // 8. Workout Reminder
 if (settings.workoutReminder?.enabled && settings.workoutReminder.time === currentTimeStr) {
 const key = `workout_${currentTimeStr}`;
 if (!firedKeys[key]) {
 markKeyFired(key);
 sendLocalNotification(
 'وقت النشاط والرياضة! ‍',
 '30 دقيقة حركة أو مشي هتفرق جداً في صحتك وحرقك ونشاطك اليومي!',
 'workout-reminder',
 settings.sound,
 'workout'
 );
 }
 }

 // 9. Smart Night Review (Enhanced & Context-Aware)
 if (settings.nightReviewReminder?.enabled && settings.nightReviewReminder.time === currentTimeStr) {
 const key = `night_review_${currentTimeStr}`;
 if (!firedKeys[key]) {
 markKeyFired(key);

 // Analyze remaining uncompleted tasks for today
 const remainingItems: string[] = [];

 if (plan && day) {
 // Check water
 const waterGoal = plan.dailyWaterGoalMl || 2500;
 if (day.water < waterGoal * 0.75) {
 remainingItems.push(`الماء (${day.water}/${waterGoal} مل)`);
 }

 // Check unlogged meals
 if (plan.meals && plan.meals.length > 0) {
 const unloggedMeals = plan.meals.filter((m) =>!day.meals ||!day.meals[m.id] || day.meals[m.id].type === 'none');
 if (unloggedMeals.length > 0) {
 remainingItems.push(`${unloggedMeals.length} وجبات`);
 }
 }

 // Check medications
 if (plan.medicationPlan?.items) {
 const disabledIds = new Set(settings.medicationReminders?.disabledMedicationIds || []);
 const activeMeds = plan.medicationPlan.items.filter((m) => m.active!== false &&!disabledIds.has(m.id));
 const scheduled = getAllScheduledDoses(activeMeds).filter((d) =>!d.isPRN);
 const unloggedMeds = scheduled.filter((d) =>!day.medications?.[d.key] || day.medications[d.key].status!== 'taken');
 if (unloggedMeds.length > 0) {
 remainingItems.push(`${unloggedMeds.length} جرعات علاجية`);
 }
 }
 }

 let reviewBody = `افتح التطبيق وسجل وجباتك ومستوى التزامك وشارك تقريرك مع ${BRAND.doctorName}!`;
 if (remainingItems.length > 0) {
 reviewBody = `باقي تسجيلك اليوم: ${remainingItems.join(' • ')}. افتح التطبيق لتوثيق التزامك ومواصلة مسارك الناجح!`;
 } else if (day && day.water >= (plan?.dailyWaterGoalMl || 2000)) {
 reviewBody = 'يومك ممتاز ومكتمل بالكامل! افتح التطبيق لتوثيق تقريرك اليومي ومشاركته مع الأخصائي.';
 }

 sendLocalNotification(
 'مراجعة وتوثيق التزامك اليومي ',
 reviewBody,
 'night-review',
 settings.sound,
 'sleep'
 );
 }
 }

 // 10. Streak At Risk (Batch 1.4) — سلسلة ≥ 3 أيام مهددة ولا نشاط اليوم
 if (settings.streakReminder?.enabled && settings.streakReminder.time === currentTimeStr && plan && day) {
 const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
 const streakUntilYesterday = calculateStreak(getTodayDateString(yesterday), plan);
 const fire = shouldFireStreakReminder({
 masterEnabled: settings.enabled,
 reminderEnabled: settings.streakReminder.enabled,
 reminderTime: settings.streakReminder.time,
 currentTime: currentTimeStr,
 streak: streakUntilYesterday,
 day,
 permission: getNotificationPermission(),
 });
 if (fire) {
 const key = `streak_at_risk_${todayDateStr}`;
 if (!firedKeys[key]) {
 markKeyFired(key);
 sendLocalNotification(
 'سلسلتك في خطر 🔥',
 buildStreakReminderMessage(streakUntilYesterday),
 'streak-at-risk',
 settings.sound,
 'meal'
 );
 }
 }
 }
}

// Missed Reminders Catch-Up Detector (Called on App Open)
export function getMissedRemindersOnBoot(
 settings: NotificationSettings,
 planOverride?: PlanConfig,
 dayOverride?: DayLog
): string[] {
 if (!settings.enabled) return [];
 
 const now = new Date();
 const todayDateStr = getTodayDateString(now);
 const currentMinutesTotal = now.getHours() * 60 + now.getMinutes();

 let plan = planOverride;
 if (!plan) {
 try {
 plan = loadPlanFromStorage();
 } catch (e) {}
 }

 let day = dayOverride;
 if (!day) {
 try {
 day = loadDayLog(todayDateStr);
 } catch (e) {}
 }

 let firedKeys: Record<string, boolean> = {};
 try {
 const raw = localStorage.getItem(FIRED_TODAY_KEY());
 if (raw) {
 const parsed = JSON.parse(raw);
 if (parsed.date === todayDateStr) {
 firedKeys = parsed.keys || {};
 }
 }
 } catch (e) {}

 const missed: string[] = [];

 // 1. Check meals that passed in the last 3 hours (180 mins) without firing
 if (settings.mealReminders.enabled) {
 settings.mealReminders.meals.forEach((meal) => {
 if (!meal.enabled ||!meal.time) return;
 const [h, m] = meal.time.split(':').map(Number);
 const mealMinutesTotal = h * 60 + m;
 const diffMinutes = currentMinutesTotal - mealMinutesTotal;

 // Passed within last 180 minutes and not fired
 if (diffMinutes >= 0 && diffMinutes <= 180) {
 const key = `meal_${meal.id}_${meal.time}`;
 if (!firedKeys[key]) {
 missed.push(`وجبة: ${meal.name} (الساعة ${meal.time})`);
 }
 }
 });
 }

 // 2. Check scheduled medications in last 3 hours
 if (settings.medicationReminders?.enabled && plan?.medicationPlan?.items) {
 const disabledIds = new Set(settings.medicationReminders.disabledMedicationIds || []);
 const activeMeds = (plan.medicationPlan.items || []).filter(
 (m: MedicationItem) => m.active!== false &&!disabledIds.has(m.id)
 );
 const scheduled = getAllScheduledDoses(activeMeds).filter((d) =>!d.isPRN);

 scheduled.forEach((dose) => {
 const scheduledTime = getMedicationSlotEstimatedTime(
 dose.slot,
 settings.mealReminders.meals,
 settings.medicationReminders.customSlotTimes,
 settings.medicationReminders.offsetMinutesBeforeMeal || 15
 );
 if (!scheduledTime) return;

 const [h, m] = scheduledTime.split(':').map(Number);
 const doseMinutesTotal = h * 60 + m;
 const diffMinutes = currentMinutesTotal - doseMinutesTotal;

 if (diffMinutes >= 0 && diffMinutes <= 180) {
 const key = `med_${dose.key}_${scheduledTime}`;
 const isLoggedTaken = day?.medications?.[dose.key]?.status === 'taken';
 if (!firedKeys[key] &&!isLoggedTaken) {
 missed.push(`دواء: ${dose.medicationName} (${scheduledTime})`);
 }
 }
 });
 }

 // Store last app boot timestamp
 try {
 localStorage.setItem(LAST_APP_BOOT_KEY(), String(Date.now()));
 } catch (e) {}

 return missed;
}

// Immediate Test Notification
export async function sendTestNotification(
 category: 'general' | 'meal' | 'water' | 'medication' | 'sleep' | 'workout' | 'fasting' | 'weight' = 'general'
): Promise<boolean> {
 const perm = await requestNotificationPermission();
 if (!perm) return false;

 let title = `تنبيه تجريبي من دايت ${BRAND.doctorName} `;
 let body = 'مبروك! نظام الإشعارات نشط ومقاوم للتقييدات. ستصلك التنبيهات في موعدها تماماً.';
 let tag = 'test-notif';
 let soundType: 'water' | 'meal' | 'medication' | 'sleep' | 'workout' | 'test' = 'test';

 switch (category) {
 case 'water':
 title = 'تذكير شرب الماء ';
 body = getRandomWaterMessage();
 tag = 'test-water';
 soundType = 'water';
 break;
 case 'meal':
 title = 'موعد وجبتك المقررة: وجبة الغداء ';
 body = `حان موعد تناول وجبتك الصحية المقررة مع ${BRAND.doctorName}. بالهنا والشفا!`;
 tag = 'test-meal';
 soundType = 'meal';
 break;
 case 'medication':
 title = 'تذكير موعد الدواء: كبسولة الفيتامينات ';
 body = 'حان موعد جرعتك المقررة - بعد الإفطار (مع الأكل حتماً لحماية المعدة).';
 tag = 'test-med';
 soundType = 'medication';
 break;
 case 'sleep':
 title = 'اقترب موعد النوم والراحة ';
 body = 'احرص على أخذ قسط كافٍ من النوم المريح لدعم معدل الحرق وتجديد طاقتك.';
 tag = 'test-sleep';
 soundType = 'sleep';
 break;
 case 'workout':
 title = 'وقت النشاط والرياضة! ‍';
 body = '30 دقيقة مشي أو تمارين هتفرق جداً في صحتك وحرقك ونشاطك اليومي!';
 tag = 'test-workout';
 soundType = 'workout';
 break;
 case 'fasting':
 title = 'اكتمل هدف الصيام المتقطع! ⏱';
 body = 'أتممت 16 ساعة صيام بنجاح! يمكنك الآن بدء نافذة تناول وجباتك الصحية.';
 tag = 'test-fasting';
 soundType = 'meal';
 break;
 case 'weight':
 title = 'موعد تسجيل الوزن الأسبوعي';
 body = 'حان وقت تسجيل وزنك الصباحي على الريق في ملف المتابعة.';
 tag = 'test-weight';
 soundType = 'meal';
 break;
 default:
 break;
 }

 return sendLocalNotification(title, body, tag, true, soundType);
}

