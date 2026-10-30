export interface HungerLevelInfo {
 level: number;
 label: string;
 shortLabel: string;
 description: string;
 clinicalTip: string;
 emoji: string;
 category: 'hunger' | 'neutral' | 'fullness';
 zone: 'danger' | 'warning' | 'ideal' | 'neutral';
 colorClasses: {
 bg: string;
 text: string;
 border: string;
 badge: string;
 activeRing: string;
 };
}

export const HUNGER_FULLNESS_SCALE: Record<number, HungerLevelInfo> = {
 1: {
 level: 1,
 label: '1 - جوع قارص ومؤلم',
 shortLabel: 'جوع قارص ',
 description: 'دوخة، صداع، انعدام طاقة (خطر الشراهة وفقدان السيطرة)',
 clinicalTip: 'تجنبي الوصول لهذه المرحلة لأنها ترفع هرمون الجريلين وتزيد الشراهة على السكريات.',
 emoji: '',
 category: 'hunger',
 zone: 'danger',
 colorClasses: {
 bg: 'bg-rose-50 dark:bg-rose-950/40',
 text: 'text-rose-700 dark:text-rose-300',
 border: 'border-rose-200 dark:border-rose-800',
 badge: 'bg-rose-100 text-rose-800 border-rose-300',
 activeRing: 'ring-rose-500 bg-rose-600 text-white',
 },
 },
 2: {
 level: 2,
 label: '2 - جوع شديد جداً',
 shortLabel: 'جوع شديد ',
 description: 'البطن تقرقر بقوة، رغبة سريعة في تناول أي طعام متاح',
 clinicalTip: 'ابدئي بكوب ماء وطبق سلطة أولاً حتى لا تتناولي كميات مضاعفة من النشويات.',
 emoji: '',
 category: 'hunger',
 zone: 'warning',
 colorClasses: {
 bg: 'bg-amber-50 dark:bg-amber-950/40',
 text: 'text-amber-700 dark:text-amber-300',
 border: 'border-amber-200 dark:border-amber-800',
 badge: 'bg-amber-100 text-amber-800 border-amber-300',
 activeRing: 'ring-amber-500 bg-amber-600 text-white',
 },
 },
 3: {
 level: 3,
 label: '3 - جوع واضح ومعتدل (المثالي)',
 shortLabel: 'جوع معتدل (مثالي للبدء) ',
 description: 'إشارات جوع حقيقية ومستقرة، التوقيت الذهبي لبدء الوجبة بوعي',
 clinicalTip: 'التوقيت السريري المثالي لبدء تناول وجبتك! استمتعي بكل لقمة وامضغي ببطء.',
 emoji: '',
 category: 'hunger',
 zone: 'ideal',
 colorClasses: {
 bg: 'bg-peacock-mist dark:bg-peacock-ink-deep/40',
 text: 'text-peacock-indigo-dark dark:text-peacock-teal-light',
 border: 'border-peacock-teal-light dark:border-peacock-indigo-dark',
 badge: 'bg-peacock-pale text-peacock-indigo-deep border-peacock-teal-light',
 activeRing: 'ring-peacock-blue bg-peacock-indigo text-white',
 },
 },
 4: {
 level: 4,
 label: '4 - بداية جوع خفيف',
 shortLabel: 'جوع خفيف ',
 description: 'بداية التفكير في الطعام، لكنك ما زلت في كامل طاقتك وسيطرتك',
 clinicalTip: 'ممتاز! يمكنك تجهيز وجبتك الصحية بهدوء الآن دون استعجال.',
 emoji: '',
 category: 'hunger',
 zone: 'ideal',
 colorClasses: {
 bg: 'bg-peacock-mist dark:bg-peacock-ink-deep/40',
 text: 'text-peacock-indigo dark:text-peacock-teal-light',
 border: 'border-peacock-sage dark:border-peacock-indigo-deep',
 badge: 'bg-peacock-pale text-peacock-indigo-deep border-peacock-teal-light',
 activeRing: 'ring-peacock-blue bg-peacock-indigo text-white',
 },
 },
 5: {
 level: 5,
 label: '5 - محايد / متوازن',
 shortLabel: 'محايد متوازن ',
 description: 'لا تشعر بالجوع ولا بالشبع، طاقة الجسم مستقرة',
 clinicalTip: 'إذا رغبتِ بالأكل هنا، تأكدي هل هو جوع حقيقي أم مجرد ملل أو عطش؟ اشربي ماء أولاً.',
 emoji: '',
 category: 'neutral',
 zone: 'neutral',
 colorClasses: {
 bg: 'bg-slate-50 dark:bg-slate-800/60',
 text: 'text-slate-700 dark:text-slate-300',
 border: 'border-slate-200 dark:border-slate-700',
 badge: 'bg-slate-100 text-slate-700 border-slate-300',
 activeRing: 'ring-slate-500 bg-slate-700 text-white',
 },
 },
 6: {
 level: 6,
 label: '6 - شبع خفيف ومرتاح',
 shortLabel: 'شبع خفيف ',
 description: 'بداية الشعور بالاكتفاء، زال الجوع تماماً وخفة المعدة ممتازة',
 clinicalTip: 'مستوى مناسب للشبع الخفيف، وموصى به في وجبة العشاء.',
 emoji: '',
 category: 'fullness',
 zone: 'ideal',
 colorClasses: {
 bg: 'bg-peacock-mist dark:bg-peacock-ink-deep/40',
 text: 'text-peacock-indigo dark:text-peacock-teal-light',
 border: 'border-peacock-sage dark:border-peacock-indigo-deep',
 badge: 'bg-peacock-pale text-peacock-indigo-deep border-peacock-teal-light',
 activeRing: 'ring-peacock-blue bg-peacock-indigo text-white',
 },
 },
 7: {
 level: 7,
 label: '7 - شبع مثالي ومريح (المثالي للتوقف)',
 shortLabel: 'شبع مثالي ومريح ',
 description: 'شبع مريح واكتفاء بنسبة 80%، طاقة ونشاط عالي بدون أي خمول',
 clinicalTip: 'المستوى الذهبي الموصى به طبياً للتوقف عن الأكل! يحافظ على حساسية الإنسولين والهضم.',
 emoji: '',
 category: 'fullness',
 zone: 'ideal',
 colorClasses: {
 bg: 'bg-peacock-mist dark:bg-peacock-ink-deep/40',
 text: 'text-peacock-indigo-dark dark:text-peacock-teal-light',
 border: 'border-peacock-teal-light dark:border-peacock-indigo-dark',
 badge: 'bg-peacock-pale text-peacock-indigo-deep border-peacock-teal-light',
 activeRing: 'ring-peacock-blue bg-peacock-indigo text-white',
 },
 },
 8: {
 level: 8,
 label: '8 - شبع زائد قليلاً',
 shortLabel: 'شبع زائد ',
 description: 'امتلاء واضح بالمعدة وزيادة عن حاجة الجسم، بداية ثقل بسيط',
 clinicalTip: 'حاولي التوقف قبل الوصول لهذا الحد في الوجبات القادمة بمضغ الأكل ببطء أكثر.',
 emoji: '',
 category: 'fullness',
 zone: 'warning',
 colorClasses: {
 bg: 'bg-amber-50 dark:bg-amber-950/40',
 text: 'text-amber-700 dark:text-amber-300',
 border: 'border-amber-200 dark:border-amber-800',
 badge: 'bg-amber-100 text-amber-800 border-amber-300',
 activeRing: 'ring-amber-500 bg-amber-600 text-white',
 },
 },
 9: {
 level: 9,
 label: '9 - تخمة وثقل بالمعدة',
 shortLabel: 'تخمة وثقل ',
 description: 'انزعاج وضغط بالمعدة مع رغبة في الاستلقاء وخمول شديد',
 clinicalTip: 'تناولي شاي أعشاب دافئ (نعناع أو يانسون) وامشي بهدوء لمدة 10 دقائق لتسهيل الهضم.',
 emoji: '',
 category: 'fullness',
 zone: 'danger',
 colorClasses: {
 bg: 'bg-rose-50 dark:bg-rose-950/40',
 text: 'text-rose-700 dark:text-rose-300',
 border: 'border-rose-200 dark:border-rose-800',
 badge: 'bg-rose-100 text-rose-800 border-rose-300',
 activeRing: 'ring-rose-500 bg-rose-600 text-white',
 },
 },
 10: {
 level: 10,
 label: '10 - تخمة مؤلمة وغثيان',
 shortLabel: 'تخمة مؤلمة ',
 description: 'ألم حاد في المعدة، شعور بالغثيان وعسر هضم شديد',
 clinicalTip: 'لا تلومي نفسك، خذي راحة تامة واشربي ماء فاتر بدون سكريات وتجنبي الاستلقاء الفوري.',
 emoji: '',
 category: 'fullness',
 zone: 'danger',
 colorClasses: {
 bg: 'bg-red-50 dark:bg-red-950/40',
 text: 'text-red-700 dark:text-red-300',
 border: 'border-red-300 dark:border-red-800',
 badge: 'bg-red-100 text-red-800 border-red-300',
 activeRing: 'ring-red-500 bg-red-600 text-white',
 },
 },
};

export function getHungerInfo(val: number | null | undefined): HungerLevelInfo | null {
 if (!val || val < 1 || val > 10) return null;
 return HUNGER_FULLNESS_SCALE[val] || null;
}

export function formatHungerFullnessText(
 hungerBefore?: number | null,
 fullnessAfter?: number | null
): string | null {
 const bInfo = getHungerInfo(hungerBefore);
 const aInfo = getHungerInfo(fullnessAfter);

 if (!bInfo &&!aInfo) return null;

 if (bInfo && aInfo) {
 return `قبل الوجبة: ${bInfo.level}/10 (${bInfo.shortLabel}) بعد الوجبة: ${aInfo.level}/10 (${aInfo.shortLabel})`;
 }
 if (bInfo) {
 return `قبل الوجبة: ${bInfo.level}/10 (${bInfo.shortLabel})`;
 }
 if (aInfo) {
 return `بعد الوجبة: ${aInfo.level}/10 (${aInfo.shortLabel})`;
 }
 return null;
}
