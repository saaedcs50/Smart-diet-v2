import React, { createContext, useContext, useState } from 'react';
import { HelpCircle, X, Circle, Lightbulb, CheckCircle2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BRAND, brandCopy } from '../config/brand';

export interface FeatureHelpInfo {
 id: string;
 title: string;
 badge?: string;
 summary: string;
 howToUse: string[];
 proTip?: string;
 doctorNote?: string;
}

// Built-in directory of all features and their explanations
export const FEATURE_GUIDES: Record<string, FeatureHelpInfo> = {
 scoreCard: {
 id: 'scoreCard',
 title: 'مؤشر الالتزام اليومي وسلسلة الأيام (Score & Streak)',
 badge: 'التقييم اليومي',
 summary: `يحسب لك التطبيق نسبة التزامك اليومية المئوية بناءً على إنجازك للوجبات، كمية الماء، التمارين، والمكملات المقررة من ${BRAND.specialistShort}.`,
 howToUse: [
 'كل وجبة أو عادة تسجلها تزيد من نقاط التزامك تلقائياً حتى 100%.',
 'سلسلة الأيام المتتالية (Streak ): تحسب لك عدد الأيام المتواصلة التي حققت فيها التزاماً يفوق 70% لتحفيز الاستمرارية.',
 'زر يوم الراحة (Free Day ): يمكنك استخدامه في أيام الإجازة المقررة للحفاظ على سلسلتك دون التأثير على تقييمك العام.'
 ],
 proTip: 'الوصول لنسبة 85%+ يومياً يضمن أفضل معدل نزول دهون مع المحافظة على الكتلة العضلية.',
 doctorNote: 'الاستمرارية أهم من المثالية: ركز على كسب النقاط اليومية باستمرار.'
 },
 mealsList: {
 id: 'mealsList',
 title: 'نظام الوجبات والبدائل المعتمدة',
 badge: 'الوجبات الغذائية',
 summary: 'قائمة وجباتك اليومية المصممة بعناية لتغطية احتياجاتك من البروتين والألياف والنشويات الصحية بدون حرمان.',
 howToUse: [
 'زر التزام (): اضغط عليه عند تناول الوجبة الأساسية المكتوبة.',
 'زر البدائل (): إذا لم يتوفر الصنف المكتوب في منزلك، اضغط على زر البدائل لاختيار صنف معتمد متكافئ في السعرات والقيمة الغذائية.',
 brandCopy.helpHunger
 ],
 proTip: 'إذا اخترت بديلاً، يمكنك كتابة تفاصيله وسيقوم التطبيق بحفظه في تقريرك الأسبوعي تلقائياً.',
 doctorNote: 'لا تحذف أي وجبة رئيسية، بل استبدلها ببديل خفيف إذا شعرت بامتلاء.'
 },
 waterTracker: {
 id: 'waterTracker',
 title: 'عداد شرب الماء التفاعلي (Hydration Tracker)',
 badge: 'الترطيب والماء',
 summary: 'متابعة كمية السوائل اليومية لرفع معدل الحرق، تحسين الهضم، وتجنب احتباس السوائل والصداع.',
 howToUse: [
 'اضغط على زر (+250 مل) أو (+500 مل) بعد كل كوب ماء تشربه.',
 'يمكنك أيضاً إنقاص الكمية بالضغط على زر (-) عند الخطأ.',
 'سيتحول مؤشر الماء إلى اللون الأخضر المكتمل عند بلوغك الهدف اليومي المحدد لك.'
 ],
 proTip: 'وزع شرب الماء على مدار اليوم واجعل كوباً كبيراً قبل كل وجبة بنصف ساعة.',
 doctorNote: 'الماء هو المحرك الأساسي لحرق الدهون وطرد السموم.'
 },
 sleepMood: {
 id: 'sleepMood',
 title: 'متابعة النوم، المزاج، والنشاط الرياضي',
 badge: 'نمط الحياة',
 summary: 'تسجيل ساعات وجودة النوم اليومية ومستوى النشاط البدني والحالة المزاجية.',
 howToUse: [
 'حدد ساعات النوم اليومية (الهدف المثالي: 7-8 ساعات).',
 'اختر مؤشر المزاج ومستوى الطاقة (مرتفع، معتدل، منخفض).',
 'علّم على ممارسة التمارين الرياضية أو المشي ومدة النشاط.'
 ],
 proTip: 'قلة النوم ترفع هرمون الكورتيزول والجوع، مما قد يسبب ثباتاً مؤقتاً في الوزن.',
 doctorNote: 'النوم الجيد ليلاً لا يقل أهمية عن الدايت والرياضة.'
 },
 habitsChecklist: {
 id: 'habitsChecklist',
 title: 'قائمة العادات الصحية والمكملات',
 badge: 'العادات اليومية',
 summary: 'متابعة العادات الإيجابية الموصوفة لك مثل المشي، شرب الأعشاب، أو المكملات الغذائية والفيتامينات.',
 howToUse: [
 'اضغط على الدائرة بجانب أي عادة لإتمامها.',
 'كل عادة مكتملة تضيف نقاطاً إضافية في مؤشر التزامك اليومي.'
 ],
 proTip: 'أخذ الفيتامينات مع الوجبات الرئيسية يعزز امتصاصها ويمنع اضطرابات المعدة.'
 },
 fastingTimer: {
 id: 'fastingTimer',
 title: 'مؤقت الصيام المتقطع (Intermittent Fasting)',
 badge: 'الصيام المتقطع',
 summary: 'مؤقت ذكي لحساب ساعات الصيام وتنبيهك عند بدء وانتهاء نافذة الأكل.',
 howToUse: [
 'اضغط على زر "بدء الصيام" بعد انتهاء آخر وجبة لتشغيل العداد التنازلي.',
 'يمكنك تعديل نظام الصيام (مثلاً 16/8 أو 14/10) حسب خطتك المعتمدة.'
 ],
 proTip: 'خلال ساعات الصيام مسموح بالماء، القهوة السادة، والشاي والأعشاب بدون سكر أو حليب.'
 },
 macrosTracker: {
 id: 'macrosTracker',
 title: 'حاسبة الماكروز والعناصر الغذائية (Macros)',
 badge: 'الماكروز اليومية',
 summary: 'تتبع نسب البروتين، النشويات، والدهون الصحية المستهلكة مقابل المستهدف اليومي.',
 howToUse: [
 'تُحسب تلقائياً مع تسجيل كل وجبة تلتزم بها.',
 'توضح لك المتبقي للوصول لأهداف الجرامات والسعرات اليومية.'
 ]
 },
 medicationsTracker: {
 id: 'medicationsTracker',
 title: 'سجل الأدوية والمكملات والتفاعلات الدوائية',
 badge: 'الأدوية والمكملات',
 summary: 'تنظيم مواعيد أخذ الأدوية الموصوفة طبياً ومراقبة أي تفاعلات غذائية مع وجباتك.',
 howToUse: [
 'علّم على كل دواء تم تناوله في وقته المحدد.',
 'انتبه لأي تنبيه دوائي مذكور بجانب الجرعة (مثل: يؤخذ على معدة فارغة أو بعد الأكل).'
 ]
 },
 cycleTracker: {
 id: 'cycleTracker',
 title: 'متابعة الدورة الشهرية والمراحل الهرمونية',
 badge: 'التتبع الهرموني',
 summary: 'ربط الشهية، احتباس السوائل، ومستويات الطاقة بمراحل الدورة لتفسير أي تغير طبيعي في الوزن.',
 howToUse: [
 'يوضح لك اليوم الحالي من الدورة والمرحلة (حيض، مرحلة جرابية، تبويض، أو طور أصفري).',
 'يقدم نصائح غذائية خاصة بنوع الأكلات المريحة لكل مرحلة.'
 ],
 proTip: 'زيادة الوزن الطفيفة قبل الدورة طبيعية جداً وتكون احتباس سوائل يزول تلقائياً.'
 },
 symptomsAndNotes: {
 id: 'symptomsAndNotes',
 title: brandCopy.symptomsTitle,
 badge: 'المتابعة الطبية',
 summary: 'تدوين أي أعراض (مثل الانتفاخ، الصداع، الخمول) أو كتابة ملاحظات خاصة لإرفاقها في تقرير المتابعة.',
 howToUse: [
 'اختر الأعراض التي شعرت بها اليوم إن وُجدت.',
 `اكتب في المربع النصي أي سؤال أو ملاحظة تود أن تقرأها ال${BRAND.doctorNameAlt} في تقريرك.`
 ]
 },
 bodyMeasurements: {
 id: 'bodyMeasurements',
 title: 'سجل قياسات الجسم ونزول السنتيمترات',
 badge: 'القياسات والوزن',
 summary: 'متابعة محيط الخصر، البطن، الأرداف، والذراعين مع منحنى الوزن البياني.',
 howToUse: [
 'سجل قياساتك مرة كل أسبوع إلى أسبوعين في نفس التوقيت صباحاً.',
 'المقاسات ونزول السنتيمترات هي أدق مقياس لحرق الدهون حتى لو ثبت رقم الميزان.'
 ],
 proTip: 'المقاسات تعكس نحت القوام بشكل أوضح من الميزان لأن العضلات أكثر كثافة من الدهون.'
 },
 photoCompare: {
 id: 'photoCompare',
 title: 'مقارنة الصور قبل وبعد (Photo Comparison)',
 badge: 'الصور والتطور',
 summary: 'التقاط وحفظ صور التقدم في مساحة مشفرة وآمنة تماماً على جهازك لمقارنة التغيير جنباً إلى جنب.',
 howToUse: [
 'ارفع أو التقط صورة في بداية كل شهر بنفس الإضاءة وزاوية التصوير.',
 'اختر صورتين للمقارنة وملاحظة التغير في قياسات وشكل الجسم.'
 ],
 doctorNote: 'جميع الصور تحفظ محلياً على هاتفك فقط لحفظ خصوصيتك التامة.'
 },
 whatsappReport: {
 id: 'whatsappReport',
 title: brandCopy.reportHelpTitle,
 badge: 'المتابعة الأسبوعية',
 summary: 'توليد تقرير احترافي منسق يلخص التزامك، وزنك، شرب الماء، والرياضة وإرساله بنقرة واحدة.',
 howToUse: [
 brandCopy.reportHelpStep,
 'سيفتح التطبيق محادثة الواتساب بنص جاهز ومنسق يتضمن كل إحصائياتك لمراجعتها معك.'
 ],
 proTip: brandCopy.reportHelpTip
 },
 importPlan: {
 id: 'importPlan',
 title: 'إدخال وتحديث الخطة الغذائية',
 badge: 'تحديث الخطة',
 summary: `استيراد خطتك الغذائية الجديدة المرسلة من عيادة ${BRAND.doctorName} بضغطة زر أو عبر رمز الاستجابة السريعة.`,
 howToUse: [
 'انسخ كود الخطة المرسل لك من العيادة والصقه في نافذة الاستيراد.',
 'سيتم تحديث الوجبات، الحصص، ومواعيد التنبيهات فوراً على هاتفك.'
 ]
 },
 smartReminders: {
 id: 'smartReminders',
 title: 'نظام التنبيهات والإشعارات الذكية',
 badge: 'التذكير بالمواعيد',
 summary: 'تنبيهات لطيفة على هاتفك تذكرك بمواعيد الوجبات، شرب الماء، وأخذ الأدوية والمكملات في وقتها.',
 howToUse: [
 'اضغط على أيقونة الجرس في الأعلى لتفعيل الإشعارات وتحديد مواعيد وجباتك المفضلة.',
 'سيعمل النظام كتنبيه منبه ذكي حتى لو كان التطبيق مغلقاً.'
 ]
 },
 // --- Clinical Coach & Doctor Guides ---
 coachPresets: {
 id: 'coachPresets',
 title: 'مكتبة القوالب الطبية الإكلينيكية الجاهزة',
 badge: 'قوالب الخطط ',
 summary: 'مكتبة متكاملة من الخطط العلاجية المجهزة مسبقاً (مقاومة الإنسولين، تكيس المبايض PCOS، الكيتو، الصيام المتقطع، كمال الأجسام، وحمية داش لضغط الدم).',
 howToUse: [
 'تصفحي القوالب المصنفة إكلينيكياً واختاري القالب المطابق لتشخيص وهدف المتدرب.',
 'اضغطي على "تطبيق هذا القالب" لملء السعرات، الماكروز، توزيع الوجبات، والمكملات تلقائياً.',
 'يمكنكِ التعديل على أي وجبة أو كمية حصص بعد تطبيق القالب لتخصيصها لحالة العميل الفردية.'
 ],
 proTip: 'استخدام القوالب يوفر 90% من وقت إعداد الخطة، مع الحفاظ على دقة المعايير الإكلينيكية.',
 doctorNote: 'تأكدي من مطابقة التاريخ المرضي للمتدرب مع موانع استخدام القالب قبل اعتماده.'
 },
 coachProfile: {
 id: 'coachProfile',
 title: 'الملف الشخصي وحساب السعرات والمستهدفات',
 badge: 'ملف المتدرب ',
 summary: 'إدخال بيانات المتدرب الأساسية (الطول، الوزن، الوزن المستهدف، محيط الخصر) وضبط السعرات والماكروز اليومية.',
 howToUse: [
 'سجلي اسم المتدرب وقياسات البداية والمستهدفات الواقعية لنزول الوزن.',
 'حددي السعرات الحرارية المستهدفة وجرامات البروتين، النشويات، والدهون الصحية.',
 'اضبطي أيام الراحة (Freeze Days) وساعات الصيام المتقطع الموصوفة.'
 ],
 proTip: 'تحديد وزن مستهدف واقعي وتدرجي يحفز المتدرب نفسياً ويضمن استدامة النتائج.',
 doctorNote: 'احرصي على ألا يقل البروتين عن 1.6 - 2.0 جم لكل كجم من وزن الجسم الخالي من الدهون.'
 },
 coachCalculators: {
 id: 'coachCalculators',
 title: 'الحاسبة الإكلينيكية ومعدل الحرق (BMR/TDEE & Macros)',
 badge: 'الحاسبة الإكلينيكية ',
 summary: 'حساب احتياج المتدرب من الطاقة بالمعادلات الطبية المعتمدة (Mifflin-St Jeor / Harris-Benedict / Katch-McArdle) وتحديد عجز أو فائض السعرات وتوزيع الماكروز.',
 howToUse: [
 'أدخلي بيانات الطول، الوزن، العمر، الجنس، ونسبة الدهون (إن توفرت).',
 'حددي مستوى النشاط البدني والهدف (تنشيف دهون، تثبيت، أو تضخيم عضلات).',
 'اختاري نسبة توزيع الماكروز (بروتين/كارب/دهون) ثم اضغطي على "تطبيق على الخطة".'
 ],
 proTip: 'عجز السعرات المعتدل (300-500 سعرة) هو الأمثل لمنع تباطؤ الأيض وهدم العضلات.',
 doctorNote: 'في حالات متلازمة الأيض أو خمول الغدة، يفضل البدء بعجز تدريجي لتجنب الشعور بالإجهاد.'
 },
 coachMedical: {
 id: 'coachMedical',
 title: 'سجل التشخيصات المرضية والأمراض المزمنة (Medical Conditions)',
 badge: 'الملف الإكلينيكي ',
 summary: 'توثيق الحالات الصحية (السكري، ضغط الدم، خمول الغدة، حساسية الجلوتين/اللاكتوز، مقاومة الإنسولين) وتوليد تنبيهات وقائية ذكية.',
 howToUse: [
 'أضيفي التشخيص الطبي وحددي درجة الحالة أو الملاحظات الطبية الخاصة بها.',
 'يقوم النظام بمطابقة الأطعمة الممنوعة والمسموحة تلقائياً لمنع أي تعارض غذائي.',
 'تظهر التنبيهات الإكلينيكية داخل واجهة المتدرب لتوجيهه أثناء اختيار الأطعمة.'
 ],
 proTip: 'تحديد الأمراض المزمنة يفعّل تنبيهات الصوديوم والبوتاسيوم ومؤشر السكر تلقائياً.',
 doctorNote: 'التاريخ الطبي هو حجر الأساس لأي تدخل تغذوي ناجح وآمن.'
 },
 coachMedications: {
 id: 'coachMedications',
 title: 'خطة الأدوية ومراقبة التعارضات والتفاعلات الغذائية (Drug-Nutrient Interactions)',
 badge: 'الصيدلة الإكلينيكية ',
 summary: 'إدارة جدول مواعيد أدوية المتدرب مع فحص ذكي لأي تفاعل كيميائي أو غذائي مع الوجبات والمكملات.',
 howToUse: [
 'سجلي الاسم العلمي أو التجاري للدواء، الجرعة، والتوقيت (قبل/بعد الوجبة، صباحاً/مساءً).',
 'حددي تعليمات الامتصاص والتنبيهات الخاصة (مثل: تجنب منتجات الألبان أو الجريب فروت مع الدواء).',
 'تصل هذه التعليمات كملاحظة إرشادية تنبيهية للمتدرب مع كل جرعة.'
 ],
 proTip: 'فصل مكملات الحديد عن الشاي والكالسيوم بساعتين على الأقل يرفع الامتصاص بنسبة 80%.',
 doctorNote: 'مراجعة أدوية السكري والضغط ضرورية جداً لتعديل الجرعات مع نزول الوزن.'
 },
 coachCycle: {
 id: 'coachCycle',
 title: 'تتبع الدورة الشهرية والمراحل الهرمونية (Cycle Syncing)',
 badge: 'التغذية الهرمونية ',
 summary: 'مزامنة النظام الغذائي والسعرات مع مراحل الدورة الشهرية الأربعة للمرأة لتفادي ثبات الوزن وتحسين المزاج.',
 howToUse: [
 'فعّلي ميزة التتبع وسجلي تاريخ آخر دورة شهرية ومتوسط طول الدورة.',
 'يوضح التطبيق تلقائياً المرحلة الحالية (حيض، جرابية، تبويض، أو طور أصفري).',
 'يوفر توجيهات غذائية لرفع المغنيسيوم والنشويات المعقدة في الطور الأصفري لتقليل نوبات اشتهاء السكريات.'
 ],
 proTip: 'تفسير احتباس الماء الطبيعي (1-2 كجم) قبل الدورة يحمي المتدربة من الإحباط النفسي.',
 doctorNote: 'التغذية المتوافقة مع الهرمونات تقلل أعراض متلازمة ما قبل الطمث (PMS) بشكل ملحوظ.'
 },
 coachLabs: {
 id: 'coachLabs',
 title: 'متابعة التحاليل المعملية والنطاقات الحيوية (Lab Tracking)',
 badge: 'التحاليل الطبية ',
 summary: 'تسجيل ومتابعة الفحوصات الدورية (HbA1c, الدهون، فيتامين D، مخزون الحديد Ferritin، إنزيمات الكبد والكلى) ومقارنة التطور زمنياً.',
 howToUse: [
 'أضيفي نتائج التحاليل مع التاريخ وقيمة النتيجة والوحدة.',
 'يصنف النظام النتيجة فوراً (طبيعي، مرتفع، منخفض) بلون مميز ويوضح النطاق المرجعي.',
 'يمكن تصدير ملخص التحاليل مباشرة لتقرير الواتساب بضغطة زر.'
 ],
 proTip: 'متابعة HbA1c والدهون الثلاثية كل 3 أشهر تعطي الدليل القاطع على نجاح الخطة العلاجية.',
 doctorNote: 'لا نعتمد فقط على الوزن؛ فالتحسن في الأرقام الحيوية هو المؤشر الحقيقي للصحة.'
 },
 coachMeals: {
 id: 'coachMeals',
 title: 'نظام الحصص والبدائل الإكلينيكية (ADA Exchange System)',
 badge: 'تخطيط الوجبات ',
 summary: 'توزيع الحصص التبادلية للوجبات (نشويات، بروتين خالي/متوسط/عالي الدهن، خضار، فواكه، دهون صحية، وألبان) وتحديد البدائل المعتمدة.',
 howToUse: [
 'حددي عدد الوجبات اليومية وأضيفي اسم وتوقيت كل وجبة.',
 'استخدمي أزرار الحصص (+ / -) لتوزيع حصص المجموعات الغذائية على الوجبات بدقة.',
 'أضيفي أصناف الأكلات المفضلة للمتدرب وبدائلها المتكافئة في السعرات والجرامات.'
 ],
 proTip: 'توزيع البروتين بالتساوي على 3-4 وجبات يحفز تخليق البروتين العضلي (MPS) على مدار اليوم.',
 doctorNote: 'المرونة في البدائل هي السر وراء التزام المتدرب لأشهر وسنوات دون انقطاع.'
 },
 coachHabits: {
 id: 'coachHabits',
 title: 'سجل العادات الصحية والمكملات الغذائية (Habits & Supplements)',
 badge: 'العادات والمكملات ',
 summary: 'تحديد العادات اليومية المستهدفة (المشي، شرب الماء، النوم، المكملات) وتخصيص نقاط التزام لكل منها.',
 howToUse: [
 'أضيفي أو عدلي العادات الموصوفة مثل (مشي 8000 خطوة، فيتامين د مع وجبة الغداء، شرب شاي أخضر).',
 'حددي وزن العادة في التقييم اليومي لتحفيز المتدرب على التركيز عليها.'
 ],
 proTip: 'البدء بعادتين إلى ثلاث عادات صغيرة يضمن الالتزام وتثبيت السلوكيات الجديدة.',
 doctorNote: 'العادات الصغيرة المتراكمة هي التي تبني النتائج المستدامة.'
 },
 coachWeights: {
 id: 'coachWeights',
 title: 'أوزان درجات التقييم اليومي (Daily Score Weights %)',
 badge: 'معادلة التقييم ',
 summary: 'تخصيص النسبة المئوية لتأثير كل عنصر (الوجبات، شرب الماء، التمارين الرياضية، العادات والمكملات) في النتيجة الإجمالية 100%.',
 howToUse: [
 'عدلي نسب الأوزان لتتناسب مع أولويات المتدرب (مثلاً: 50% وجبات، 20% ماء، 15% رياضة، 15% عادات).',
 'يجب أن يكون مجموع النسب 100% لضمان دقة المؤشر التراكمي.'
 ],
 proTip: 'للمبتدئين، ارفعي وزن الالتزام بالوجبات والماء لتسهيل الوصول لنسبة تفوق 80%.',
 doctorNote: 'التقييم العادل والمحفز يعطي المتدرب شعوراً مستمراً بالإنجاز.'
 },
 coachSections: {
 id: 'coachSections',
 title: 'تخصيص اللوحات وإخفاء/إظهار الأقسام (Section Visibility)',
 badge: 'تخصيص الواجهة ',
 summary: 'التحكم في الأقسام التي تظهر لواجهة المتدرب (مثل: إخفاء مؤقت الصيام، إظهار تتبع الدورة للسيدات فقط، أو إخفاء الماكروز لتفادي الهوس بالأرقام).',
 howToUse: [
 'علّمي على تفعيل أو تعطيل الأقسام حسب مرحلة المتدرب وجاهزيته النفسية.',
 'إلغاء تفعيل قسم غير مطلوب يبسط الواجهة ويمنع التشتت.'
 ],
 proTip: 'في بداية المشوار مع المتدرب القلق، إخفاء عداد الماكروز الدقيق والتركيز على الوجبات يقلل التوتر.',
 doctorNote: 'بساطة الواجهة تزيد من معدل الاستخدام اليومي بنسبة تزيد عن 40%.'
 },
 coachBackup: {
 id: 'coachBackup',
 title: 'النسخ الاحتياطي، كود الخطة، والمشاركة (Export & Sync)',
 badge: 'المشاركة السحابية ',
 summary: 'تصدير الخطة ككود مشفر للمتدرب، أو مشاركتها كرسالة واتساب منسقة، أو حفظ واسترجاع نسخ احتياطية للمراجعة.',
 howToUse: [
 'اضغطي على "نسخ كود الخطة" لإرساله للمتدرب ليقوم باستيراده في تطبيقه.',
 'أو اضغطي "مشاركة عبر واتساب" لإرسال جدول الوجبات والتعليمات منسقاً بالكامل كرسالة نصية.',
 'يمكنكِ أيضاً حفظ نسخة احتياطية JSON لكافة بيانات العيادة.'
 ],
 proTip: 'حفظ كود الخطة في سجل المريض بالعيادة يمكنكِ من استرجاع وتحديث الخطة في ثوانٍ.',
 doctorNote: 'التواصل المباشر عبر الواتساب يرفع من ثقة المريض والتزامه بالتعليمات.'
 }
};

// Context for managing the active feature help modal
interface FeatureHelpContextType {
 openHelp: (featureId: string) => void;
 closeHelp: () => void;
 activeFeature: FeatureHelpInfo | null;
}

const FeatureHelpContext = createContext<FeatureHelpContextType>({
 openHelp: () => {},
 closeHelp: () => {},
 activeFeature: null,
});

export const useFeatureHelp = () => useContext(FeatureHelpContext);

export const FeatureHelpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
 const [activeFeature, setActiveFeature] = useState<FeatureHelpInfo | null>(null);

 const openHelp = (featureId: string) => {
 const guide = FEATURE_GUIDES[featureId];
 if (guide) {
 setActiveFeature(guide);
 } else {
 console.warn(`No guide found for feature: ${featureId}`);
 }
 };

 const closeHelp = () => {
 setActiveFeature(null);
 };

 return (
 <FeatureHelpContext.Provider value={{ openHelp, closeHelp, activeFeature }}>
 {children}
 <FeatureHelpModal isOpen={!!activeFeature} onClose={closeHelp} guide={activeFeature} />
 </FeatureHelpContext.Provider>
 );
};

// Help button component to place beside ANY feature header
interface HelpButtonProps {
 featureId: string;
 className?: string;
 size?: 'sm' | 'md';
}

export const HelpButton: React.FC<HelpButtonProps> = ({ featureId, className = '', size = 'md' }) => {
 const { openHelp } = useFeatureHelp();

 return (
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 openHelp(featureId);
 }}
 title="كيف استخدم هذه الميزة؟ (دليل توضيحي)"
 className={`inline-flex items-center justify-center rounded-full text-slate-400 hover:text-peacock-indigo dark:hover:text-peacock-teal hover:bg-peacock-mist dark:hover:bg-peacock-ink-deep/60 transition-all cursor-pointer ${
 size === 'sm'? 'w-6 h-6 p-0.5': 'w-7 h-7 p-1'
 } ${className}`}
 aria-label="مساعدة وتوضيح الميزة"
 >
 <HelpCircle className={size === 'sm'? 'w-4 h-4': 'w-4.5 h-4.5'} />
 </button>
 );
};

// Modal for displaying the feature explanation
interface FeatureHelpModalProps {
 isOpen: boolean;
 onClose: () => void;
 guide: FeatureHelpInfo | null;
}

export const FeatureHelpModal: React.FC<FeatureHelpModalProps> = ({ isOpen, onClose, guide }) => {
 if (!isOpen ||!guide) return null;

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto" dir="rtl">
 <motion.div
 initial={{ opacity: 0, scale: 0.95, y: 15 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95, y: 15 }}
 className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl app-overlay-shadow overflow-hidden my-auto flex flex-col max-h-[90vh]"
 >
 {/* Header */}
 <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-peacock-mist/80 dark:bg-peacock-ink-deep/30">
 <div className="flex items-center gap-2.5">
 <div className="w-9 h-9 rounded-2xl text-peacock-indigo dark:text-peacock-teal flex items-center justify-center shrink-0">
 <HelpCircle className="w-5 h-5" />
 </div>
 <div>
 {guide.badge && (
 <span className="text-[12px] font-extrabold px-2.5 py-0.5 rounded-full bg-peacock-pale text-peacock-indigo-deep dark:bg-peacock-ink-deep dark:text-peacock-teal-light border border-peacock-sage dark:border-peacock-indigo-deep">
 {guide.badge}
 </span>
 )}
 <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-tight mt-0.5">
 {guide.title}
 </h3>
 </div>
 </div>

 <button
 onClick={onClose}
 className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Content */}
 <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-slate-700 dark:text-slate-200 text-xs sm:text-sm leading-relaxed flex-1">
 {/* Summary */}
 <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
 <p className="font-medium text-slate-800 dark:text-slate-100">
 {guide.summary}
 </p>
 </div>

 {/* How to use steps */}
 <div className="space-y-2">
 <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">
 طريقة الاستخدام والتطبيق:
 </h4>
 <div className="space-y-2">
 {guide.howToUse.map((step, idx) => (
 <div
 key={idx}
 className="flex items-start gap-2.5 p-3 rounded-xl bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
 >
 <div className="w-5 h-5 rounded-full text-peacock-indigo dark:text-peacock-teal flex items-center justify-center font-black text-[12px] shrink-0 mt-0.5">
 {idx + 1}
 </div>
 <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
 {step}
 </p>
 </div>
 ))}
 </div>
 </div>

 {/* Pro Tip */}
 {guide.proTip && (
 <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-300/60 dark:border-amber-700/50 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
 <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
 <div>
 <strong className="font-bold">نصيحة ذهبية: </strong>
 <span>{guide.proTip}</span>
 </div>
 </div>
 )}

 {/* Doctor Note */}
 {guide.doctorNote && (
 <div className="p-3.5 rounded-2xl bg-peacock-blue/10 dark:bg-peacock-blue/15 border border-peacock-teal-light/60 dark:border-peacock-indigo-dark/50 flex items-start gap-2.5 text-xs text-peacock-ink dark:text-peacock-sage">
 <Circle className="w-4 h-4 text-peacock-indigo dark:text-peacock-teal shrink-0 mt-0.5" />
 <div>
 <strong className="font-bold">توجيه {BRAND.doctorName}: </strong>
 <span>{guide.doctorNote}</span>
 </div>
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex items-center justify-end">
 <button
 onClick={onClose}
 className="px-6 py-2.5 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo-dark text-white font-bold text-xs sm:text-sm transition-all"
 >
 فهمت، شكراً
 </button>
 </div>
 </motion.div>
 </div>
 );
};
