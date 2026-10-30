import React, { useState } from 'react';
import { Download, Smartphone, Apple, Check, X, Share, PlusSquare } from 'lucide-react';

interface InstallGuideModalProps {
 onClose: () => void;
}

export const InstallGuideModal: React.FC<InstallGuideModalProps> = ({ onClose }) => {
 const [platform, setPlatform] = useState<'ios' | 'android'>('ios');

 return (
 <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
 <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 border border-slate-200 dark:border-slate-800 app-overlay-shadow animate-in zoom-in-95 duration-150 flex flex-col">
 <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3 shrink-0">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-xl dark: text-peacock-indigo flex items-center justify-center font-bold">
 <Download className="w-4 h-4" />
 </div>
 <div>
 <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
 تثبيت التطبيق على هاتفك 
 </h3>
 <p className="text-[12px] text-slate-400">للوصول السريع والعمل بدون إنترنت</p>
 </div>
 </div>
 <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Scrollable content */}
 <div className="space-y-3">
 {/* Platform Toggle */}
 <div className="grid grid-cols-2 gap-2">
 <button
 onClick={() => setPlatform('ios')}
 className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
 platform === 'ios'
? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
 }`}
 >
 <Apple className="w-4 h-4" />
 <span>آيفون (iPhone / iOS)</span>
 </button>
 <button
 onClick={() => setPlatform('android')}
 className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
 platform === 'android'
? 'bg-peacock-indigo text-white'
: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
 }`}
 >
 <Smartphone className="w-4 h-4" />
 <span>أندرويد (Android)</span>
 </button>
 </div>

 {/* Instructions Content */}
 {platform === 'ios'? (
 <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
 <div className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
 <span className="w-5 h-5 rounded-full bg-peacock-blue text-white flex items-center justify-center font-bold text-xs shrink-0">
 1
 </span>
 <div>
 <p className="font-bold text-slate-800 dark:text-slate-100">افتح الرابط في متصفح Safari</p>
 <p className="text-[12px] text-slate-400">التثبيت في آيفون يتطلب متصفح سفاري حصراً</p>
 </div>
 </div>

 <div className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
 <span className="w-5 h-5 rounded-full bg-peacock-blue text-white flex items-center justify-center font-bold text-xs shrink-0">
 2
 </span>
 <div>
 <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
 اضغط على زر المشاركة أسفل الشاشة <Share className="w-3.5 h-3.5 text-blue-500" />
 </p>
 </div>
 </div>

 <div className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
 <span className="w-5 h-5 rounded-full bg-peacock-blue text-white flex items-center justify-center font-bold text-xs shrink-0">
 3
 </span>
 <div>
 <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
 مرر للأسفل واضغط على <PlusSquare className="w-3.5 h-3.5 text-peacock-indigo" /> "إضافة للشاشة الرئيسية"
 </p>
 <p className="text-[12px] text-slate-400">(Add to Home Screen) ثم اضغط "إضافة"</p>
 </div>
 </div>
 </div>
 ): (
 <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
 <div className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
 <span className="w-5 h-5 rounded-full bg-peacock-blue text-white flex items-center justify-center font-bold text-xs shrink-0">
 1
 </span>
 <div>
 <p className="font-bold text-slate-800 dark:text-slate-100">افتح الرابط في متصفح Chrome</p>
 </div>
 </div>

 <div className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
 <span className="w-5 h-5 rounded-full bg-peacock-blue text-white flex items-center justify-center font-bold text-xs shrink-0">
 2
 </span>
 <div>
 <p className="font-bold text-slate-800 dark:text-slate-100">
 اضغط على الثلاث نقاط (⋮) في أعلى المتصفح
 </p>
 </div>
 </div>

 <div className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
 <span className="w-5 h-5 rounded-full bg-peacock-blue text-white flex items-center justify-center font-bold text-xs shrink-0">
 3
 </span>
 <div>
 <p className="font-bold text-slate-800 dark:text-slate-100">
 اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية"
 </p>
 </div>
 </div>
 </div>
 )}
 </div>

 <button
 onClick={onClose}
 className="w-full mt-4 py-2.5 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo-dark text-white font-bold text-xs transition-colors shrink-0"
 >
 فهمت ذلك، تم
 </button>
 </div>
 </div>
 );
};
