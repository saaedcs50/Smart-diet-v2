import React, { useState } from 'react';
import { BRAND, brandCopy } from '../config/brand';
import {
 Circle,
 Calendar,
 Utensils,
 RefreshCw,
 Droplets,
 Scale,
 Dumbbell,
 Pill,
 FileText,
 Share2,
 CheckCircle2,
 ChevronRight,
 ChevronLeft,
 X,
 BookOpen,
 ArrowRight,
 ShieldCheck,
 Zap,
 Smartphone,
 Info,
 Check,
 HelpCircle,
 Bell,
 Clock,
 HeartPulse,
 Flame,
 Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlanConfig } from '../types';

interface OnboardingModalProps {
 isOpen: boolean;
 onClose: () => void;
 plan: PlanConfig;
}

interface StepItem {
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
 proTip: string;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
 isOpen,
 onClose,
 plan,
}) => {
 const [currentStep, setCurrentStep] = useState(0);

 if (!isOpen) return null;

 const steps: StepItem[] = [
 {
 id: 'welcome',
 badge: 'الترحيب والمقدمة',
 badgeColor: 'bg-peacock-pale text-peacock-indigo-deep dark:bg-peacock-ink-deep dark:text-peacock-teal-light border-peacock-sage dark:border-peacock-indigo-deep',
 title: `أهلاً بك${plan.clientName ? ` يا ${plan.clientName}` : ''} في تطبيق المتابعة الصحية`,
 subtitle: `نظام المتابعة بإشراف ${BRAND.doctorName}`,
 description: 'هذا التطبيق صُمم لمساعدتك على الالتزام بالخطة الغذائية اليومية، مع إمكانية استبدال الوجبات بالبدائل المعتمدة ومتابعة المؤشرات بانتظام.',
 icon: <Circle className="w-8 h-8 text-peacock-indigo dark:text-peacock-teal" />,
 details: [
 {
 title: 'خطة علاجية مخصصة لك',
 description: `مصممة لتناسب هدفك: ${plan.goal || 'الوصول للوزن المثالي والصحة العامة بأمان ومرونة.'}`,
 icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />,
 highlight: `${plan.targetCalories || 2000} سعرة حرارية`
 },
 {
 title: 'نظام الحصص والبدائل الذكية',
 description: 'كل وجبة محددة المكونات مع إمكانية تبديل أي صنف غير متوفر ببديل معتمد ومكافئ في السعرات.',
 icon: <BookOpen className="w-5 h-5 text-peacock-blue" />
 },
 {
 title: 'يعمل بدون إنترنت وبخصوصية كاملة',
 description: 'بياناتك، صورك، وتقدمك اليومي محفوظ تلقائياً على جهازك فقط لضمان الأمان والسرعة الفائقة.',
 icon: <Zap className="w-5 h-5 text-amber-500" />
 }
 ],
 proTip: 'في أي مكان بالتطبيق، ستجد زر علامة استفهام () بجانب كل ميزة ليفتح لك شرحاً تفصيلياً لطريقة استخدامها!'
 },
 {
 id: 'today_tab',
 badge: 'التبويب الأول: صفحة اليوم',
 badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
 title: 'متابعة الوجبات والمهام اليومية',
 subtitle: 'تسجيل الوجبات ومتابعة الالتزام بالخطة',
 description: 'شاشة "اليوم" هي الواجهة الرئيسية لمتابعة إنجاز الوجبات والعادات اليومية.',
 icon: <Calendar className="w-8 h-8 text-blue-600 dark:text-blue-400" />,
 details: [
 {
 title: 'مؤشر الالتزام وسلسلة الأيام (Streak )',
 description: 'كل وجبة أو عادة تسجلها ترفع نسبة التزامك حتى 100%. التزامك اليومي يحافظ على سلسلة أيامك المتتالية.',
 icon: <Flame className="w-5 h-5 text-amber-500" />,
 highlight: 'الهدف: 85%+'
 },
 {
 title: 'تسجيل الوجبات والبدائل (Checkmark )',
 description: 'اضغط على زر الالتزام عند تناول الوجبة، أو اضغط على ( البدائل) لاختيار صنف بديل معتمد.',
 icon: <Utensils className="w-5 h-5 text-peacock-blue" />
 },
 {
 title: 'عداد شرب الماء التفاعلي ',
 description: 'اضغط على (+250 مل) بعد كل كوب ماء لتصل لهدفك اليومي بسهولة وتنشط حرق الدهون.',
 icon: <Droplets className="w-5 h-5 text-sky-500" />,
 highlight: `${(plan.waterTargetLiters || 3)} لتر يومياً`
 },
 {
 title: 'متابعة النوم، المزاج، والعادات الصحية',
 description: 'سجل ساعات نومك، نشاطك الرياضي، وعاداتك الإيجابية لتكتمل نقاط تقييمك اليومي.',
 icon: <HeartPulse className="w-5 h-5 text-indigo-500" />
 }
 ],
 proTip: 'يوم الراحة (Free Day ): يمكنك تفعيله في الأيام المفتوحة للحفاظ على استمرارية سلسلتك دون التأثير على إحصائياتك!'
 },
 {
 id: 'body_tab',
 badge: 'التبويب الثاني: المقاسات والوزن',
 badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800',
 title: 'سجل القياسات والصور قبل وبعد',
 subtitle: 'نحت القوام والتطور الحقيقي بالسنتمترات',
 description: 'في تبويب "المقاسات"، تتابع نزول الدهون الحقيقي عبر مقاسات الخصر، الأرداف، ومنحنى الوزن وصور التقدم.',
 icon: <Scale className="w-8 h-8 text-amber-600 dark:text-amber-400" />,
 details: [
 {
 title: 'منحنى الوزن البياني ',
 description: 'سجل وزنك أسبوعياً لمتابعة مسار نزولك نحو الوزن المستهدف بدقة.',
 icon: <Scale className="w-5 h-5 text-amber-500" />
 },
 {
 title: 'سجل السنتيمترات ومحيط الجسم',
 description: 'متابعة محيط الخصر، البطن، والذراعين: المقاسات تعكس نزول الدهون حتى في أوقات ثبات الميزان.',
 icon: <Award className="w-5 h-5 text-peacock-blue" />,
 highlight: 'أدق مقياس للدهون'
 },
 {
 title: 'مقارنة الصور قبل وبعد (Photo Compare )',
 description: 'التقط صور تقدمك دورياً وقارنها جنباً إلى جنب: الصور تحفظ محلياً على جهازك وبسرية تامة.',
 icon: <Circle className="w-5 h-5 text-peacock-blue" />
 }
 ],
 proTip: 'قس مقاساتك ووزنك مرة أسبوعياً صباحاً على معدة فارغة للحصول على أدق نتيجة.'
 },
 {
 id: 'reports_tab',
 badge: 'التبويب الثالث: التقارير والواتساب',
 badgeColor: 'bg-peacock-pale text-peacock-indigo-deep dark:bg-peacock-ink-deep dark:text-peacock-teal-light border-peacock-sage dark:border-peacock-indigo-deep',
 title: brandCopy.shareProgress,
 subtitle: 'تقرير أسبوعي شامل بنقرة واحدة',
 description: 'صفحة التقارير ترسم لك صورة شاملة لمدى تقدمك في الالتزام، شرب الماء، والوزن خلال الأسبوع.',
 icon: <FileText className="w-8 h-8 text-peacock-indigo dark:text-peacock-teal" />,
 details: [
 {
 title: 'إحصائيات الالتزام الأسبوعية',
 description: 'ملخص واضح يوضح متوسط التزامك، أفضل أيامك، ومتوسط شرب الماء وساعات النوم.',
 icon: <CheckCircle2 className="w-5 h-5 text-peacock-blue" />
 },
 {
 title: 'بطاقة القصة المرئية (Story Card )',
 description: 'توليد بطاقة مصممة بشكل جذاب يمكنك حفظها أو مشاركتها للاحتفال بإنجازك الأسبوعي.',
 icon: <Circle className="w-5 h-5 text-blue-500" />
 },
 {
 title: 'زر مشاركة التقرير على واتساب ',
 description: `في يوم المتابعة، اضغط على زر "${brandCopy.reportWhatsApp}" ليقوم التطبيق بتجهيز رسالة منسقة وجاهزة لإرسالها مباشرة.`,
 icon: <Share2 className="w-5 h-5 text-peacock-blue" />,
 highlight: 'متابعة مباشرة مع العيادة'
 }
 ],
 proTip: brandCopy.weeklyReportTip
 },
 {
 id: 'pwa_and_help',
 badge: 'الخطوة الأخيرة: التثبيت والدليل السريع',
 badgeColor: 'bg-peacock-pale text-peacock-indigo-deep dark:bg-peacock-ink-deep dark:text-peacock-teal-light border-peacock-sage dark:border-peacock-indigo-deep',
 title: 'تثبيت التطبيق ومساعد الاستخدام ()',
 subtitle: 'افتحه كأي تطبيق أصلي بدون كتابة روابط',
 description: 'يمكنك إضافة التطبيق مباشرة لشاشة هاتفك وتفعيل الإشعارات لمواعيد الوجبات.',
 icon: <Smartphone className="w-8 h-8 text-peacock-indigo dark:text-peacock-teal" />,
 details: [
 {
 title: 'على هواتف أندرويد وآيفون',
 description: 'اضغط على زر المشاركة أو القائمة في المتصفح ثم اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).',
 icon: <Smartphone className="w-5 h-5 text-peacock-blue" />
 },
 {
 title: 'زر المساعدة بجانب كل ميزة ()',
 description: `ستجد علامة استفهام بجانب كل عنوان في التطبيق: اضغط عليها في أي وقت لمعرفة كل تفاصيل استخدام الميزة و${brandCopy.featureGuides}.`,
 icon: <HelpCircle className="w-5 h-5 text-peacock-blue" />,
 highlight: 'دليل مدمج في كل شاشة'
 },
 {
 title: 'التنبيهات والمواعيد ()',
 description: 'اضغط على أيقونة الجرس في الأعلى لتفعيل تنبيهات مواعيد الوجبات وشرب الماء في أوقاتها.',
 icon: <Bell className="w-5 h-5 text-amber-500" />
 }
 ],
 proTip: 'يمكنك إعادة فتح هذا الدليل التعريفي الشامل في أي وقت بالضغط على أيقونة ( دليل التطبيق) في الشريط العلوي!'
 }
 ];

 const currentStepData = steps[currentStep];
 const isLastStep = currentStep === steps.length - 1;

 const handleNext = () => {
 if (isLastStep) {
 onClose();
 } else {
 setCurrentStep((prev) => prev + 1);
 }
 };

 const handlePrev = () => {
 if (currentStep > 0) {
 setCurrentStep((prev) => prev - 1);
 }
 };

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-md overflow-y-auto" dir="rtl">
 <motion.div
 initial={{ opacity: 0, scale: 0.95, y: 15 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95, y: 15 }}
 className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl app-overlay-shadow overflow-hidden my-auto flex flex-col max-h-[92vh]"
 >
 {/* Header Bar */}
 <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 backdrop-blur-sm">
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-xl text-peacock-indigo dark:text-peacock-teal flex items-center justify-center font-bold text-sm">
 {currentStep + 1}/{steps.length}
 </div>
 <div>
 <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full border ${currentStepData.badgeColor}`}>
 {currentStepData.badge}
 </span>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <button
 onClick={onClose}
 className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
 >
 تخطي الدليل
 </button>
 <button
 onClick={onClose}
 className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
 aria-label="إغلاق"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 </div>

 {/* Step Progress Indicators */}
 <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 flex">
 {steps.map((step, idx) => (
 <button
 key={step.id}
 onClick={() => setCurrentStep(idx)}
 className={`h-full transition-all duration-150 flex-1 cursor-pointer ${
 idx === currentStep
? 'bg-peacock-blue'
: idx < currentStep
? 'bg-peacock-teal-light dark:bg-peacock-indigo-dark'
: 'bg-transparent'
 }`}
 title={step.badge}
 />
 ))}
 </div>

 {/* Modal Body with Animated Step Transition */}
 <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
 <AnimatePresence mode="wait">
 <motion.div
 key={currentStepData.id}
 initial={{ opacity: 0, x: 20 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: -20 }}
 transition={{ duration: 0.2 }}
 className="space-y-5"
 >
 {/* Title & Subtitle Card */}
 <div className="flex items-start gap-4 p-4 rounded-2xl bg-peacock-mist/80 dark:bg-peacock-ink-deep/30 border border-peacock-pale/80 dark:border-peacock-ink/50">
 <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-peacock-pale/50 dark:border-slate-700 shrink-0">
 {currentStepData.icon}
 </div>
 <div className="space-y-1">
 <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-snug">
 {currentStepData.title}
 </h3>
 <p className="text-xs sm:text-sm font-medium text-peacock-indigo-dark dark:text-peacock-teal">
 {currentStepData.subtitle}
 </p>
 <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
 {currentStepData.description}
 </p>
 </div>
 </div>

 {/* Step Key Feature Details */}
 <div className="space-y-2.5">
 <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
 أهم التفاصيل والميزات في هذه الخطوة:
 </h4>
 <div className="grid grid-cols-1 gap-2.5">
 {currentStepData.details.map((detail, dIdx) => (
 <div
 key={dIdx}
 className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-start gap-3 hover:border-peacock-sage dark:hover:border-peacock-indigo-deep/60 transition-colors"
 >
 <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700 shrink-0 mt-0.5">
 {detail.icon}
 </div>
 <div className="space-y-0.5 flex-1">
 <div className="flex items-center justify-between gap-2 flex-wrap">
 <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
 {detail.title}
 </span>
 {detail.highlight && (
 <span className="text-[12px] font-bold px-2 py-0.5 rounded-md bg-peacock-blue/10 text-peacock-indigo-dark dark:text-peacock-teal-light border border-peacock-blue/20">
 {detail.highlight}
 </span>
 )}
 </div>
 <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
 {detail.description}
 </p>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Pro Tip Box */}
 <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
 <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
 <div className="leading-relaxed">
 <strong className="font-bold">نصيحة ذهبية: </strong>
 {currentStepData.proTip}
 </div>
 </div>
 </motion.div>
 </AnimatePresence>
 </div>

 {/* Footer Navigation Buttons */}
 <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex items-center justify-between gap-3">
 <button
 onClick={handlePrev}
 disabled={currentStep === 0}
 className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer ${
 currentStep === 0
? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-800 text-slate-400'
: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
 }`}
 >
 <ChevronRight className="w-4 h-4" />
 السابق
 </button>

 <button
 onClick={handleNext}
 className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white transition-all cursor-pointer ${
 isLastStep
? 'bg-peacock-indigo hover:bg-peacock-indigo-dark'
: 'bg-slate-900 dark:bg-peacock-indigo hover:bg-slate-800 dark:hover:bg-peacock-indigo-dark'
 }`}
 >
 {isLastStep? (
 <>
 <span>بدء استخدام التطبيق</span>
 <Check className="w-4 h-4" />
 </>
 ): (
 <>
 <span>التالي ({currentStep + 2}/{steps.length})</span>
 <ChevronLeft className="w-4 h-4" />
 </>
 )}
 </button>
 </div>
 </motion.div>
 </div>
 );
};
