import React, { useState } from 'react';
import { BRAND, brandCopy } from '../config/brand';
import {
 Circle,
 FolderHeart,
 Calculator,
 Stethoscope,
 Pill,
 Heart,
 Activity,
 Utensils,
 Share2,
 ChevronRight,
 ChevronLeft,
 X,
 BookOpen,
 CheckCircle2,
 ShieldCheck,
 Zap,
 Sliders,
 SlidersHorizontal,
 Flame,
 LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlanConfig } from '../types';

interface CoachOnboardingModalProps {
 isOpen: boolean;
 onClose: () => void;
 plan: PlanConfig;
}

interface CoachStepItem {
 id: string;
 badge: string;
 badgeColor: string;
 title: string;
 subtitle: string;
 description: string;
 icon: React.ReactNode;
 details: {
 title: string;
 description: string;
 icon: React.ReactNode;
 highlight?: string;
 }[];
 clinicalTip: string;
}

export const CoachOnboardingModal: React.FC<CoachOnboardingModalProps> = ({
 isOpen,
 onClose,
 plan,
}) => {
 const [currentStep, setCurrentStep] = useState(0);

 if (!isOpen) return null;

 const steps: CoachStepItem[] = [
 {
 id: 'welcome',
 badge: brandCopy.coachGuideBadge,
 badgeColor: 'bg-peacock-pale text-peacock-indigo-deep dark:bg-peacock-ink-deep dark:text-peacock-teal-light border-peacock-sage dark:border-peacock-indigo-deep',
 title: 'مرحباً بكِ في لوحة تحكم التغذية الإكلينيكية ',
 subtitle: `نظام إدارة الخطط والبدائل والمتابعة بإشراف ${BRAND.doctorName}`,
 description: 'تم تصميم هذه اللوحة لتمنحكِ تحكماً شاملاً وسريعاً في تصميم الخطط الغذائية العلاجية، حساب السعرات والماكروز، مراقبة التحاليل والأدوية، ونظام الحصص التبادلية ADA مع مرونة كاملة في التصدير والمشاركة.',
 icon: <Circle className="w-8 h-8 text-peacock-indigo dark:text-peacock-teal" />,
 details: [
 {
 title: 'تصميم سريري متكامل (Clinical-First)',
 description: 'ربط مباشر بين التاريخ المرضي، الأدوية، التحاليل المعملية، وتوزيع الحصص اليومية.',
 icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />
 },
 {
 title: 'نظام الحصص والبدائل المعتمدة (ADA Exchange)',
 description: 'توزيع مرن للبروتين والنشويات والدهون والخضار مع بدائل دقيقة ومكافئة لكل وجبة.',
 icon: <BookOpen className="w-5 h-5 text-peacock-blue" />
 },
 {
 title: 'أزرار مساعدة وتوجيهات مباشرة ()',
 description: 'ستجدين زر مساعدة () بجانب كل قسم يشرح المعايير الطبية وكيفية استخدامها خطوة بخطوة.',
 icon: <Zap className="w-5 h-5 text-amber-500" />
 }
 ],
 clinicalTip: `يمكنكِ دائماً إعادة فتح هذا الدليل في أي وقت من زر "${brandCopy.coachGuide} " الموجود في أعلى اللوحة.`
 },
 {
 id: 'step1_presets',
 badge: 'الخطوة 1 من 7: مكتبة القوالب',
 badgeColor: 'bg-peacock-pale text-peacock-indigo-deep dark:bg-peacock-ink-deep dark:text-peacock-teal-light border-peacock-sage dark:border-peacock-indigo-deep',
 title: 'مكتبة القوالب الطبية الجاهزة ',
 subtitle: 'تجهيز خطة علاجية متكاملة بنقرة زر واحدة',
 description: 'تحتوي المكتبة على قوالب إكلينيكية معدة مسبقاً لأشهر الحالات التغذوية لتقليل وقت إعداد الخطة بنسبة 90%.',
 icon: <FolderHeart className="w-8 h-8 text-peacock-indigo dark:text-peacock-teal" />,
 details: [
 {
 title: 'قوالب علاجية متخصصة',
 description: 'مقاومة الإنسولين، تكيس المبايض (PCOS)، الكيتو، الصيام المتقطع، كمال الأجسام، وحمية داش لارتفاع الضغط.',
 icon: <FolderHeart className="w-5 h-5 text-peacock-blue" />
 },
 {
 title: 'تطبيق فوري مع إمكانية التخصيص',
 description: 'عند اختيار القالب، تُعبأ السعرات، الماكروز، وجداول الوجبات والمكملات تلقائياً مع إمكانية التعديل عليها بحرية.',
 icon: <CheckCircle2 className="w-5 h-5 text-peacock-blue" />
 }
 ],
 clinicalTip: 'استخدمي القوالب كنقطة انطلاق ثم خصصي الحصص حسب وزن وهدف المتدرب الفردي.'
 },
 {
 id: 'step2_calculators',
 badge: 'الخطوة 2 من 7: حاسبة الحرق والماكروز',
 badgeColor: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
 title: 'الحاسبة الإكلينيكية (BMR / TDEE & Macros) ',
 subtitle: 'حساب دقيق لمعدل الأيض الأساسي وعجز السعرات',
 description: 'احسبي احتياج المتدرب بأدق المعادلات المعتمدة مع تحديد نسبة عجز السعرات ونسب توزيع المغذيات الكبرى.',
 icon: <Calculator className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />,
 details: [
 {
 title: 'معادلات Mifflin-St Jeor و Katch-McArdle',
 description: 'حساب BMR و TDEE بناءً على الطول، الوزن، العمر، ومستوى النشاط الرياضي ونسبة الدهون.',
 icon: <Flame className="w-5 h-5 text-orange-500" />
 },
 {
 title: 'توزيع الماكروز والجرامات',
 description: 'تحديد جرامات البروتين لكل كجم من وزن الجسم، وضبط نسب الكارب والدهون الصحية بدقة.',
 icon: <Sliders className="w-5 h-5 text-cyan-500" />
 }
 ],
 clinicalTip: 'عجز السعرات المعتدل (300-500 سعرة) يحافظ على معدل الحرق والكتلة العضلية ويمنع نوبات الجوع الشديد.'
 },
 {
 id: 'step3_medical',
 badge: 'الخطوة 3 من 7: التشخيصات المرضية',
 badgeColor: 'bg-peacock-pale text-peacock-indigo-deep dark:bg-peacock-ink-deep dark:text-peacock-teal-light border-peacock-sage dark:border-peacock-indigo-deep',
 title: 'الملف الإكلينيكي والتشخيصات ',
 subtitle: 'ربط الأمراض المزمنة بالتنبيهات الغذائية الذكية',
 description: 'سجلي التاريخ المرضي للمتدرب لتفعيل التنبيهات التلقائية للأطعمة الممنوعة والمسموحة ومراعاة السلامة الإكلينيكية.',
 icon: <Stethoscope className="w-8 h-8 text-peacock-indigo dark:text-peacock-teal" />,
 details: [
 {
 title: 'تشخيصات الأمراض المزمنة',
 description: 'السكري، ضغط الدم، خمول أو فرط الغدة الدرقية، حساسية الجلوتين (Celiac)، ومقاومة الإنسولين.',
 icon: <Stethoscope className="w-5 h-5 text-peacock-blue" />
 },
 {
 title: 'تنبيهات سلامة وتوجيهات مباشرة',
 description: 'يتم تنبيه المتدرب تلقائياً بالأطعمة الواجب تجنبها ومصادر الألياف والمعادن المناسبة لحالته.',
 icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />
 }
 ],
 clinicalTip: 'توثيق التاريخ المرضي يضمن التوافق العلاجي ويحمي المتدرب من أي مضاعفات غير مرغوبة.'
 },
 {
 id: 'step4_medications',
 badge: 'الخطوة 4 من 7: خطة الأدوية والتعارضات',
 badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
 title: 'سجل الأدوية والتفاعلات الغذائية (Drug-Nutrient) ',
 subtitle: 'مراقبة مواعيد الجرعات وتجنب التعارضات الكيميائية',
 description: 'حددي جدول أدوية المتدرب مع تعليمات الامتصاص الدقيقة لمنع أي تداخل دوائي-غذائي يقلل كفاءة العلاج.',
 icon: <Pill className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />,
 details: [
 {
 title: 'جدول الجرعات والمواعيد',
 description: 'تحديد توقيت الجرعة (قبل الأكل، بعد الأكل، صباحاً، أو قبل النوم) لربطها بتنبيهات المتدرب الذكية.',
 icon: <Pill className="w-5 h-5 text-indigo-500" />
 },
 {
 title: 'فحص التفاعلات مع الأطعمة',
 description: 'تنبيه المتدرب بتجنب الأطعمة المعارضة (مثل الكالسيوم مع الحديد، أو الجريب فروت مع أدوية الضغط والدهون).',
 icon: <Zap className="w-5 h-5 text-amber-500" />
 }
 ],
 clinicalTip: 'فصل مكملات الحديد عن الشاي ومنتجات الألبان بساعتين يضمن أقصى امتصاص للهيموجلوبين.'
 },
 {
 id: 'step5_labs_cycle',
 badge: 'الخطوة 5 من 7: التحاليل والدورة',
 badgeColor: 'bg-peacock-pale text-peacock-indigo-dark dark:bg-peacock-ink-deep dark:text-peacock-teal-light border-peacock-sage dark:border-peacock-ink',
 title: 'التحاليل المعملية والتتبع الهرموني ',
 subtitle: 'المتابعة البيوكيميائية وتزامن الهرمونات',
 description: 'تابعي الفحوصات المعملية الدورية ومطابقتها بالنطاقات المرجعية، مع ضبط الخطة حسب مراحل الدورة الشهرية.',
 icon: <Activity className="w-8 h-8 text-peacock-indigo dark:text-peacock-teal-light" />,
 details: [
 {
 title: 'مراقبة التحاليل المعملية (Labs)',
 description: 'تسجيل HbA1c، ملف الدهون Lipid Profile، فيتامين D، ومخزون الحديد مع تصنيف النطاقات الحيوية.',
 icon: <Activity className="w-5 h-5 text-peacock-blue" />
 },
 {
 title: 'مزامنة الدورة الشهرية (Cycle Syncing)',
 description: 'تفسير احتباس السوائل الطبيعي قبل الدورة وضبط السعرات والمغنيسيوم لتخفيف أعراض PMS.',
 icon: <Heart className="w-5 h-5 text-peacock-teal" />
 }
 ],
 clinicalTip: 'تحسن المؤشرات المعملية والدهون الحشوية هو الدليل القاطع على نجاح الخطة حتى في فترات ثبات الميزان.'
 },
 {
 id: 'step6_meals_exchange',
 badge: 'الخطوة 6 من 7: نظام الحصص والبدائل',
 badgeColor: 'bg-peacock-pale text-peacock-indigo-deep dark:bg-peacock-ink-deep dark:text-peacock-teal-light border-peacock-sage dark:border-peacock-indigo-deep',
 title: 'نظام الحصص والبدائل المعتمدة (ADA Exchange) ',
 subtitle: 'مرونة قصوى للمتدرب في استبدال الأكلات بالبدائل المنزلية',
 description: 'وزعي الحصص التبادلية لكل وجبة مع كتابة الأصناف المقترحة وبدائلها المتكافئة لتسهيل التزام المتدرب بدون حيرة.',
 icon: <Utensils className="w-8 h-8 text-peacock-indigo dark:text-peacock-teal" />,
 details: [
 {
 title: 'توزيع الحصص السريع (+ / -)',
 description: 'أزرار تحكم مريحة لإضافة أو إنقاص حصص النشويات، البروتين، الخضار، الفواكه، والدهون في كل وجبة.',
 icon: <SlidersHorizontal className="w-5 h-5 text-peacock-blue" />
 },
 {
 title: 'قائمة البدائل التلقائية',
 description: 'يستطيع المتدرب في تطبيقه الضغط على زر ( البدائل) واختيار صنف متكافئ تماماً في السعرات والماكروز.',
 icon: <BookOpen className="w-5 h-5 text-peacock-blue" />
 }
 ],
 clinicalTip: 'توزيع البروتين بالتساوي على مدار اليوم يحفز بناء العضلات والشبع المستمر لأكثر من 4 ساعات.'
 },
 {
 id: 'step7_export_sync',
 badge: 'الخطوة 7 من 7: التصدير والمشاركة',
 badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
 title: 'التصدير، المشاركة، وضبط اللوحات ',
 subtitle: 'إرسال الخطة للمتدرب عبر واتساب أو كود الاستيراد',
 description: 'شاركي الخطة بنقرة زر واحدة عبر واتساب أو كود استيراد مشفر، مع إمكانية التحكم في الأقسام واللوحات الظاهرة للعميل.',
 icon: <Share2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />,
 details: [
 {
 title: 'مشاركة مباشرة على واتساب',
 description: 'توليد رسالة نصية منسقة بجدول الوجبات، الحصص، والملاحظات الطبية بنقرة واحدة.',
 icon: <Share2 className="w-5 h-5 text-peacock-blue" />
 },
 {
 title: 'تخصيص اللوحات وإخفاء الأقسام (Section Visibility)',
 description: 'تحكمي في إظهار أو إخفاء عداد الماكروز، مؤقت الصيام، أو تتبع الدورة حسب احتياج كل متدرب.',
 icon: <LayoutGrid className="w-5 h-5 text-blue-500" />
 }
 ],
 clinicalTip: 'اضغطي دائماً على زر "حفظ وتطبيق الخطة" في الشريط السفلي لتثبيت كافة التعديلات بنجاح.'
 }
 ];

 const current = steps[currentStep];
 const isFirstStep = currentStep === 0;
 const isLastStep = currentStep === steps.length - 1;

 const handleNext = () => {
 if (isLastStep) {
 onClose();
 } else {
 setCurrentStep((prev) => prev + 1);
 }
 };

 const handlePrev = () => {
 if (!isFirstStep) {
 setCurrentStep((prev) => prev - 1);
 }
 };

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto" dir="rtl">
 <motion.div
 initial={{ opacity: 0, scale: 0.96, y: 15 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.96, y: 15 }}
 className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl app-overlay-shadow overflow-hidden my-auto flex flex-col max-h-[92vh]"
 >
 {/* Top Header */}
 <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-peacock-mist/80 dark:bg-peacock-ink-deep/30 shrink-0">
 <div className="flex items-center gap-2.5">
 <div className="w-10 h-10 rounded-2xl text-peacock-indigo dark:text-peacock-teal flex items-center justify-center shrink-0">
 <Stethoscope className="w-5 h-5" />
 </div>
 <div>
 <span className="text-[12px] font-black uppercase tracking-wider text-peacock-indigo-dark dark:text-peacock-teal-light">
 {brandCopy.coachGuideBadge} ({BRAND.doctorName})
 </span>
 <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
 جولة إرشادية في لوحة التحكم الإكلينيكية
 </h3>
 </div>
 </div>

 <button
 onClick={onClose}
 className="w-9 h-9 rounded-2xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover: dark:hover: flex items-center justify-center transition-colors shrink-0 cursor-pointer"
 title="إغلاق الدليل"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Step Progress Dots */}
 <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-850/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
 <div className="flex items-center gap-1.5 flex-1">
 {steps.map((step, idx) => (
 <button
 key={step.id}
 onClick={() => setCurrentStep(idx)}
 className={`h-2 rounded-full transition-all duration-150 cursor-pointer ${
 idx === currentStep
? 'w-7 bg-peacock-indigo'
: idx < currentStep
? 'w-2.5 bg-peacock-teal/80 dark:bg-peacock-indigo-dark'
: 'w-2 bg-slate-200 dark:bg-slate-700'
 }`}
 title={`الخطوة ${idx + 1}: ${step.title}`}
 />
 ))}
 </div>
 <span className="text-[12px] font-black text-slate-500 dark:text-slate-400 whitespace-nowrap">
 {currentStep + 1} من {steps.length}
 </span>
 </div>

 {/* Main Content Area */}
 <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-slate-700 dark:text-slate-200 flex-1">
 <AnimatePresence mode="wait">
 <motion.div
 key={current.id}
 initial={{ opacity: 0, x: -10 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: 10 }}
 transition={{ duration: 0.2 }}
 className="space-y-4"
 >
 {/* Badge & Title */}
 <div className="space-y-1.5">
 <span className={`inline-block text-[12px] font-black px-2.5 py-0.5 rounded-full border ${current.badgeColor}`}>
 {current.badge}
 </span>
 <div className="flex items-center gap-3">
 <div className="p-2.5 rounded-2xl bg-peacock-blue/10 border border-peacock-blue/20 shrink-0">
 {current.icon}
 </div>
 <div>
 <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
 {current.title}
 </h2>
 <p className="text-xs font-bold text-peacock-indigo-dark dark:text-peacock-teal-light">
 {current.subtitle}
 </p>
 </div>
 </div>
 </div>

 {/* Description */}
 <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
 {current.description}
 </p>

 {/* Step Details Grid */}
 <div className="space-y-2.5">
 {current.details.map((detail, idx) => (
 <div
 key={idx}
 className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-750 space-y-1"
 >
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-2">
 {detail.icon}
 <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">
 {detail.title}
 </h4>
 </div>
 {detail.highlight && (
 <span className="text-[12px] font-black px-2 py-0.5 rounded-full bg-peacock-pale text-peacock-indigo-deep dark:bg-peacock-ink-deep dark:text-peacock-teal-light border border-peacock-sage dark:border-peacock-indigo-deep shrink-0">
 {detail.highlight}
 </span>
 )}
 </div>
 <p className="text-xs text-slate-500 dark:text-slate-400 pr-7 leading-relaxed">
 {detail.description}
 </p>
 </div>
 ))}
 </div>

 {/* Clinical Pro Tip */}
 {current.clinicalTip && (
 <div className="p-3.5 rounded-2xl bg-peacock-blue/10 dark:bg-peacock-blue/15 border border-peacock-teal-light/60 dark:border-peacock-indigo-dark/50 flex items-start gap-2.5 text-xs text-peacock-ink dark:text-peacock-sage">
 <Circle className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal shrink-0 mt-0.5" />
 <div>
 <strong className="font-black">توجيه {BRAND.doctorName} الإكلينيكي: </strong>
 <span className="font-medium">{current.clinicalTip}</span>
 </div>
 </div>
 )}
 </motion.div>
 </AnimatePresence>
 </div>

 {/* Footer Actions */}
 <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
 <button
 type="button"
 onClick={handlePrev}
 disabled={isFirstStep}
 className={`min-h-[42px] px-3.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
 isFirstStep
? 'opacity-40 cursor-not-allowed text-slate-400'
: 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
 }`}
 >
 <ChevronRight className="w-4 h-4" />
 <span>السابق</span>
 </button>

 <div className="flex items-center gap-2">
 {!isLastStep && (
 <button
 type="button"
 onClick={onClose}
 className="min-h-[42px] px-3 rounded-xl font-bold text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
 >
 تخطي الجولة
 </button>
 )}

 <button
 type="button"
 onClick={handleNext}
 className="min-h-[42px] px-5 rounded-2xl bg-peacock-indigo hover:bg-peacock-indigo-dark text-white font-black text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer"
 >
 <span>{isLastStep? 'بدء العمل على اللوحة ': 'الخطوة التالية'}</span>
 {!isLastStep && <ChevronLeft className="w-4 h-4" />}
 </button>
 </div>
 </div>
 </motion.div>
 </div>
 );
};
