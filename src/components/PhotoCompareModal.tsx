import React, { useState } from 'react';
import { Columns, X, ArrowLeftRight } from 'lucide-react';
import { PhotoRecord } from '../types';

interface PhotoCompareModalProps {
 photos: PhotoRecord[];
 onClose: () => void;
}

export const PhotoCompareModal: React.FC<PhotoCompareModalProps> = ({ photos, onClose }) => {
 const [beforeIdx, setBeforeIdx] = useState(photos.length > 1? photos.length - 1: 0); // oldest by default
 const [afterIdx, setAfterIdx] = useState(0); // newest by default
 const [sliderPos, setSliderPos] = useState(50);

 const beforePhoto = photos[beforeIdx];
 const afterPhoto = photos[afterIdx];

 if (!beforePhoto ||!afterPhoto) {
 return null;
 }

 return (
 <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
 <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-5 border border-slate-200 dark:border-slate-800 app-overlay-shadow max-h-[90vh] flex flex-col">
 {/* Header */}
 <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-xl dark: text-peacock-indigo flex items-center justify-center font-bold">
 <Columns className="w-4 h-4" />
 </div>
 <div>
 <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
 مقارنة صور التطور الجسدي
 </h3>
 <p className="text-[12px] text-slate-400">اسحب الشريط لملاحظة الفرق بين الصورتين</p>
 </div>
 </div>
 <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Photo Selectors */}
 <div className="grid grid-cols-2 gap-3 mb-3">
 <div>
 <label className="block text-[12px] font-bold text-slate-400 mb-1">
 صورة البداية (قبل):
 </label>
 <select
 value={beforeIdx}
 onChange={(e) => setBeforeIdx(parseInt(e.target.value, 10))}
 className="w-full text-xs font-semibold p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
 >
 {photos.map((p, idx) => (
 <option key={p.id || idx} value={idx}>
 {p.date}
 </option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-[12px] font-bold text-peacock-indigo dark:text-peacock-teal mb-1">
 الصورة الحالية (بعد):
 </label>
 <select
 value={afterIdx}
 onChange={(e) => setAfterIdx(parseInt(e.target.value, 10))}
 className="w-full text-xs font-semibold p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
 >
 {photos.map((p, idx) => (
 <option key={p.id || idx} value={idx}>
 {p.date}
 </option>
 ))}
 </select>
 </div>
 </div>

 {/* Interactive Comparison Slider */}
 <div className="relative w-full aspect-3/4 max-h-[380px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 select-none my-auto">
 {/* After image (full background) */}
 <img
 src={afterPhoto.data}
 alt="بعد"
 className="absolute inset-0 w-full h-full object-contain"
 />
 <div className="absolute top-2 left-2 bg-peacock-indigo text-white text-[12px] font-bold px-2 py-0.5 rounded-full">
 بعد ({afterPhoto.date})
 </div>

 {/* Before image (clipped by slider percentage) */}
 <div
 className="absolute inset-0 overflow-hidden"
 style={{ width: `${sliderPos}%` }}
 >
 <img
 src={beforePhoto.data}
 alt="قبل"
 className="absolute inset-0 w-full h-full object-contain max-w-none"
 style={{ width: '100%', height: '100%' }}
 />
 <div className="absolute top-2 right-2 bg-slate-800 text-white text-[12px] font-bold px-2 py-0.5 rounded-full">
 قبل ({beforePhoto.date})
 </div>
 </div>

 {/* Divider Line */}
 <div
 className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none"
 style={{ left: `${sliderPos}%` }}
 >
 <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full text-slate-800 flex items-center justify-center text-xs font-bold pointer-events-none">
 <ArrowLeftRight className="w-3.5 h-3.5" />
 </div>
 </div>

 {/* Range input for touch/mouse sliding */}
 <input
 type="range"
 min="0"
 max="100"
 value={sliderPos}
 onChange={(e) => setSliderPos(parseInt(e.target.value, 10))}
 className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10"
 />
 </div>

 <p className="text-[12px] text-slate-400 text-center mt-3">
 اسحب الخط يميناً ويساراً لمقارنة تفاصيل خسارة الدهون وتناسق القوام
 </p>
 </div>
 </div>
 );
};
