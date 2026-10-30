import React, { useState, useRef } from 'react';
import { 
  FileDown, 
  Printer, 
  Download, 
  Eye, 
  Check, 
  X, 
  Copy, 
  Share2, 
  User, 
  Heart, 
  Utensils, 
  Pill, 
  Stethoscope, 
  Droplets, 
  Flame, 
  Activity, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles,
  Sliders,
  Calendar,
  Phone,
  FileText,
  AlertCircle,
  Lightbulb,
  QrCode,
  Loader2
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PlanConfig } from '../types';
import { BRAND, brandCopy, adjustColor } from '../config/brand';
import { generatePlanSyncCode } from '../utils/planShare';
import {
  PlanPdfTemplateId,
  PLAN_PDF_TEMPLATES,
  resolveBrandHeader,
} from '../utils/pdfTemplates';

interface PlanPDFExportModalProps {
  plan: PlanConfig;
  isOpen: boolean;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

type PDFTheme = 'emerald' | 'sapphire' | 'purple' | 'monochrome';

export const PlanPDFExportModal: React.FC<PlanPDFExportModalProps> = ({
  plan,
  isOpen,
  onClose,
  onNotify,
}) => {
  const [theme, setTheme] = useState<PDFTheme>('emerald');
  // Batch 3.2: قالب التصدير (كلاسيك / هوية ملونة / مختصر صفحة واحدة)
  const [pdfTemplate, setPdfTemplate] = useState<PlanPdfTemplateId>('classic');
  const isBrandTemplate = pdfTemplate === 'brand';
  const isCompact = pdfTemplate === 'compact';
  const brandHeader = resolveBrandHeader(BRAND);
  const [isGenerating, setIsGenerating] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  
  // Customization Toggles
  const [includeMacros, setIncludeMacros] = useState(true);
  const [includeAlternatives, setIncludeAlternatives] = useState(true);
  const [includeMedicalConditions, setIncludeMedicalConditions] = useState(true);
  const [includeMedications, setIncludeMedications] = useState(true);
  const [includeHabits, setIncludeHabits] = useState(true);
  const [includeTips, setIncludeTips] = useState(true);
  const [includeStamp, setIncludeStamp] = useState(true);
  const [includeSyncCode, setIncludeSyncCode] = useState(true);
  
  // Additional Doctor Details
  const [doctorCustomNote, setDoctorCustomNote] = useState<string>('');
  const [followUpDate, setFollowUpDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14); // Next check-up in 2 weeks
    return d.toISOString().slice(0, 10);
  });
  const [issueDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const printAreaRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen) return null;

  // Calculations for PDF
  const weight = plan.startWeight || null;
  const height = plan.heightCm || null;
  const bmi = (weight && height) ? (weight / Math.pow(height / 100, 2)).toFixed(1) : null;
  const bmiNum = bmi ? parseFloat(bmi) : 0;
  
  let bmiCategory = '';
  let bmiColorClass = 'text-slate-700';
  if (bmiNum > 0) {
    if (bmiNum < 18.5) {
      bmiCategory = 'نقص وزن';
      bmiColorClass = 'text-amber-600';
    } else if (bmiNum < 25) {
      bmiCategory = 'وزن طبيعي مثالي';
      bmiColorClass = 'text-peacock-indigo';
    } else if (bmiNum < 30) {
      bmiCategory = 'زيادة وزن';
      bmiColorClass = 'text-amber-700';
    } else if (bmiNum < 35) {
      bmiCategory = 'سمنة درجة أولى';
      bmiColorClass = 'text-rose-600';
    } else {
      bmiCategory = 'سمنة درجة ثانية / مفرطة';
      bmiColorClass = 'text-rose-700';
    }
  }

  // Theme palettes
  const classicThemeStyles = {
    emerald: {
      primary: '#059669',
      primaryDark: '#047857',
      primaryLight: '#ecfdf5',
      accent: '#10b981',
      border: '#a7f3d0',
      badgeBg: '#d1fae5',
      badgeText: '#065f46',
      titleGrad: 'from-peacock-indigo-deep to-peacock-ink',
    },
    sapphire: {
      primary: '#0284c7',
      primaryDark: '#0369a1',
      primaryLight: '#f0f9ff',
      accent: '#38bdf8',
      border: '#bae6fd',
      badgeBg: '#e0f2fe',
      badgeText: '#075985',
      titleGrad: 'from-sky-900 to-blue-950',
    },
    purple: {
      primary: '#7c3aed',
      primaryDark: '#6d28d9',
      primaryLight: '#faf5ff',
      accent: '#a855f7',
      border: '#e9d5ff',
      badgeBg: '#f3e8ff',
      badgeText: '#581c87',
      titleGrad: 'from-peacock-ink to-indigo-950',
    },
    monochrome: {
      primary: '#1e293b',
      primaryDark: '#0f172a',
      primaryLight: '#f8fafc',
      accent: '#475569',
      border: '#cbd5e1',
      badgeBg: '#f1f5f9',
      badgeText: '#1e293b',
      titleGrad: 'from-slate-900 to-black',
    },
  }[theme];

  // Batch 3.2: قالب «هوية ملونة» يستبدل الباليتة بألوان علامة هذه النسخة (brand.json)
  const themeStyles = isBrandTemplate
    ? {
        primary: brandHeader.primary,
        primaryDark: adjustColor(brandHeader.primary, -45),
        primaryLight: adjustColor(brandHeader.primary, 205),
        accent: brandHeader.accent,
        border: adjustColor(brandHeader.primary, 150),
        badgeBg: adjustColor(brandHeader.primary, 205),
        badgeText: adjustColor(brandHeader.primary, -60),
        titleGrad: classicThemeStyles.titleGrad,
      }
    : classicThemeStyles;

  // 1. Direct PDF Download with jsPDF + html2canvas
  const handleDownloadDirectPDF = async () => {
    if (!printAreaRef.current) return;
    setIsGenerating(true);
    onNotify('جاري تجهيز وتوليد ملف الـ PDF عالي الدقة...');

    try {
      const element = printAreaRef.current;
      
      // Temporarily scale container for crisp high-dpi capture
      const canvas = await html2canvas(element, {
        scale: 2, // 2x for retina quality print
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1024,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // First page
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;

      // Subsequent pages if long document
      while (heightLeft > 0) {
        position = position - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;
      }

      const clientCleanName = (plan.clientName || 'متدرب').replace(/\s+/g, '_');
      const doctorCleanName = (BRAND.doctorName || '').trim().replace(/\s+/g, '_');
      const filename = `الخطة_العلاجية_${clientCleanName}${doctorCleanName ? `_${doctorCleanName}` : ''}_${issueDate}.pdf`;
      pdf.save(filename);
      onNotify('تم تنزيل ملف الـ PDF بنجاح ');
    } catch (err) {
      console.error('PDF generation error:', err);
      onNotify('حدث خطأ أثناء تنزيل الـ PDF، يمكنك استخدام خيار الطباعة المباشرة');
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. High-DPI Vector Browser Print (Save as PDF)
  const handleBrowserPrint = () => {
    if (!printAreaRef.current) return;
    
    // Create an isolated printable iframe for pure vector rendering without UI clutter
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const htmlContent = printAreaRef.current.innerHTML;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>خطة ${plan.clientName || 'المتدرب'} - ${BRAND.clinicName}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 12mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: 'Cairo', 'Tajawal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              direction: rtl;
              text-align: right;
              background-color: #ffffff;
              color: #1e293b;
              font-size: 11pt;
              line-height: 1.5;
            }
            .page-break-inside-avoid {
              break-inside: avoid;
              page-break-inside: avoid;
            }
            /* Tailwind utility mimics for iframe printing */
            ${document.querySelector('style')?.innerHTML || ''}
          </style>
        </head>
        <body>
          <div style="width: 100%; max-width: 210mm; margin: 0 auto;">
            ${htmlContent}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
                setTimeout(function() {
                  window.frameElement.parentNode.removeChild(window.frameElement);
                }, 1000);
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();
    onNotify('جاري فتح نافذة الطباعة / حفظ كـ PDF...');
  };

  // WhatsApp quick sharing with instructions
  const handleShareWhatsApp = () => {
    const text = `أهلاً بك ${plan.clientName || 'عزيزي'}، مرفق خطتك الغذائية العلاجية بإشراف ${BRAND.doctorName}.\n\nالهدف: ${plan.targetCalories || 0} ك.س\nتاريخ المتابعة: ${followUpDate}\n\nيرجى فتح ملف الـ PDF المرسل والالتزام بالبدائل المحددة.`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-6xl 2xl:max-w-7xl rounded-3xl border border-slate-200 dark:border-slate-800 app-overlay-shadow h-[94vh] flex flex-col overflow-hidden text-right dir-rtl">
        
        {/* Top Header Bar */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-peacock-blue/10 text-peacock-indigo dark:text-peacock-teal flex items-center justify-center font-bold shrink-0">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                  تصدير الخطة كملف PDF رسمي (Medical Prescription)
                </h3>
                <span className="text-[12px] font-black px-2 py-0.5 rounded-full bg-peacock-pale text-peacock-indigo-deep dark:bg-peacock-ink-deep dark:text-peacock-teal-light border border-peacock-teal-light dark:border-peacock-indigo-deep">
                  {BRAND.doctorName}
                </span>
              </div>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">
                روشتة ونظام غذائي علاجي احترافي جاهز للطباعة أو الإرسال للمتدرب
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={handleBrowserPrint}
              type="button"
              className="min-h-[40px] px-3.5 sm:px-4 py-2 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors text-xs font-black flex items-center gap-1.5 cursor-pointer"
              title="طباعة مباشرة أو حفظ كـ PDF عالي الدقة"
            >
              <Printer className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>طباعة / حفظ PDF عالي الدقة</span>
            </button>

            <button
              onClick={handleDownloadDirectPDF}
              disabled={isGenerating}
              type="button"
              className="min-h-[40px] px-4 py-2 rounded-2xl bg-peacock-indigo hover:bg-peacock-indigo-dark text-white transition-all text-xs font-black flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التحميل...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>تحميل PDF مباشر</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              type="button"
              className="w-10 h-10 rounded-2xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Workspace Body: Split Controls & Live Preview */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Controls Panel (Sidebar) */}
          <div className="w-full lg:w-80 2xl:w-96 p-4 sm:p-5 border-b lg:border-b-0 lg:border-l border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 overflow-y-auto space-y-5 shrink-0 text-xs">

            {/* Batch 3.2: Template Selector + Mini HTML Previews */}
            <div className="space-y-2">
              <label className="font-black text-slate-800 dark:text-slate-200 block">
                قالب التصدير (Template):
              </label>
              <div className="space-y-2">
                {PLAN_PDF_TEMPLATES.map((t) => {
                  const barColor = t.id === 'brand' ? brandHeader.primary : t.id === 'compact' ? '#334155' : '#059669';
                  const selected = pdfTemplate === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPdfTemplate(t.id)}
                      className={`w-full p-2.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all text-right ${
                        selected
                          ? 'border-peacock-indigo bg-white dark:bg-slate-800 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 hover:bg-white'
                      }`}
                    >
                      {/* معاينة مصغرة HTML للقالب */}
                      <span className="w-14 shrink-0 rounded-md border border-slate-200 dark:border-slate-700 bg-white p-1 space-y-1" aria-hidden="true">
                        <span className="block h-1.5 rounded-full" style={{ backgroundColor: barColor }} />
                        <span className="block h-1 rounded-full bg-slate-300" />
                        <span className="block h-1 rounded-full bg-slate-200 w-4/5" />
                        {t.id !== 'compact' && <span className="block h-1 rounded-full bg-slate-200 w-3/5" />}
                        {t.id === 'brand' && (
                          <span className="block h-1 rounded-full w-2/5" style={{ backgroundColor: brandHeader.accent }} />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-[12px] ${selected ? 'font-black text-slate-800 dark:text-slate-100' : 'font-bold text-slate-600 dark:text-slate-300'}`}>
                          {t.label}
                        </span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                          {t.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {isCompact && (
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  القالب المختصر ثابت المحتوى: الوجبات + التنبيهات الطبية الأساسية فقط، ويتجاهل مفاتيح المحتوى بالأسفل.
                </p>
              )}
            </div>

            {/* Color Palette Selector — يُخفى في قالب الهوية لأن الألوان من brand */}
            {!isBrandTemplate && (
            <div className="space-y-2">
              <label className="font-black text-slate-800 dark:text-slate-200 block">
                نمط وهوية الروشتة (Theme):
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'emerald', label: 'زمردي صحي (طبيعي)', color: '#059669' },
                  { id: 'sapphire', label: 'أزرق سريري (عيادة)', color: '#0284c7' },
                  { id: 'purple', label: 'بنفسجي ملكي (العيادة)', color: '#7c3aed' },
                  { id: 'monochrome', label: 'أبيض وأسود (موفر حبر)', color: '#334155' },
                ].map((th) => (
                  <button
                    key={th.id}
                    onClick={() => setTheme(th.id as PDFTheme)}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      theme === th.id
                        ? 'border-peacock-indigo bg-white dark:bg-slate-800 font-black shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-white'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: th.color }} />
                    <span className="truncate text-[12px]">{th.label}</span>
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* Customization Checkboxes */}
            <div className="space-y-2.5">
              <label className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-peacock-indigo" />
                <span>عناصر محتوى الـ PDF:</span>
              </label>

              <div className="space-y-1.5 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                {[
                  { label: 'السعرات ونسب الماكروز', state: includeMacros, set: setIncludeMacros },
                  { label: 'بدائل الوجبات المعتمدة', state: includeAlternatives, set: setIncludeAlternatives },
                  { label: 'التشخيصات والمحاذير الطبية', state: includeMedicalConditions, set: setIncludeMedicalConditions },
                  { label: 'خطة الأدوية والمكملات', state: includeMedications, set: setIncludeMedications },
                  { label: 'التعليمات والعادات اليومية', state: includeHabits, set: setIncludeHabits },
                  { label: `نصائح وإرشادات ${BRAND.doctorName}`, state: includeTips, set: setIncludeTips },
                  { label: 'ختم وتوقيع الطبيبة الإلكتروني', state: includeStamp, set: setIncludeStamp },
                  { label: 'كود تفعيل التطبيق الذكي للمتدرب', state: includeSyncCode, set: setIncludeSyncCode },
                ].map((item, idx) => (
                  <label key={idx} className="flex items-center justify-between p-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-lg cursor-pointer">
                    <span className="text-slate-700 dark:text-slate-300 font-bold">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={item.state}
                      onChange={(e) => item.set(e.target.checked)}
                      className="w-4 h-4 accent-peacock-indigo rounded cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Clinical Dates & Custom Note */}
            <div className="space-y-3 bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  موعد المتابعة والاستشارة القادمة:
                </label>
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-xl">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  ملاحظة سريرية مخصصة في الترويسة:
                </label>
                <textarea
                  rows={2}
                  placeholder="مثال: يرجى التركيز على شرب الماء الدافئ صباحاً وموافاة العيادة بوزن يوم الإثنين..."
                  value={doctorCustomNote}
                  onChange={(e) => setDoctorCustomNote(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium resize-none outline-none focus:ring-1 focus:ring-peacock-blue"
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full py-2.5 px-3 rounded-xl bg-peacock-blue/10 hover:bg-peacock-blue/20 text-peacock-indigo-dark dark:text-peacock-teal-light border border-peacock-blue/30 font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>إرسال إشعار للمتدرب عبر واتساب</span>
              </button>
            </div>
          </div>

          {/* Live A4 Print Preview Viewport */}
          <div className="flex-1 bg-slate-200/70 dark:bg-slate-950 p-4 sm:p-6 overflow-y-auto flex flex-col items-center">
            
            {/* Zoom Controls */}
            <div className="sticky top-0 z-10 mb-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-300 dark:border-slate-800 shadow-sm flex items-center gap-3 text-xs">
              <span className="font-black text-slate-600 dark:text-slate-300">معاينة ورقة A4:</span>
              <button
                onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                className="px-2 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
              >
                -
              </button>
              <span className="font-black text-peacock-indigo min-w-[45px] text-center">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                className="px-2 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
              >
                +
              </button>
              <button
                onClick={() => setZoomLevel(100)}
                className="text-[12px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border-r border-slate-200 dark:border-slate-700 pr-2 mr-1"
              >
                إعادة ضبط
              </button>
            </div>

            {/* A4 Paper Canvas */}
            <div 
              style={{ 
                transform: `scale(${zoomLevel / 100})`, 
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out'
              }}
              className="w-full max-w-[210mm] transition-all duration-150"
            >
              <div 
                ref={printAreaRef}
                id="clinical-plan-pdf-document"
                className={`bg-white text-slate-900 shadow-2xl rounded-sm border border-slate-200/90 text-right dir-rtl leading-relaxed font-sans ${isCompact ? 'p-5 sm:p-6' : 'p-8 sm:p-10'}`}
                style={{
                  minHeight: isCompact ? 'auto' : '297mm',
                  color: '#0f172a',
                  backgroundColor: '#ffffff'
                }}
              >
                {/* 1. OFFICIAL CLINIC HEADER */}
                <div 
                  className="pb-5 mb-6 border-b-2 flex flex-row items-center justify-between gap-4"
                  style={{ borderColor: themeStyles.primary }}
                >
                  <div className="flex items-center gap-3.5">
                    {isBrandTemplate && brandHeader.showLogo ? (
                      <img
                        src={brandHeader.logoSrc || ''}
                        alt={brandHeader.fallbackLabel}
                        className="w-16 h-16 rounded-2xl object-cover shadow-sm shrink-0"
                      />
                    ) : (
                      <div 
                        className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-sm shrink-0"
                        style={{ backgroundColor: themeStyles.primary }}
                      >
                        {isBrandTemplate ? brandHeader.fallbackLabel.charAt(0) : '⚕️'}
                      </div>
                    )}
                    <div>
                      <h1 className="text-xl font-black tracking-tight" style={{ color: themeStyles.primaryDark }}>
                        {BRAND.clinicName || 'Smart Diet Clinic'}
                      </h1>
                      <p className="text-xs font-bold text-slate-700 mt-0.5">
                        عيادة التغذية العلاجية وإدارة الوزن والحالات الأيضية
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[12px] font-bold text-slate-500">
                        <span>إشراف: {BRAND.doctorName} ({BRAND.specialistTitle})</span>
                        <span>•</span>
                        <span>واتساب: {BRAND.whatsapp}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[12px] min-w-[140px]">
                    <div className="font-bold text-slate-500">تاريخ الإصدار:</div>
                    <div className="font-black text-slate-800">{issueDate}</div>
                    <div className="font-bold text-slate-500 mt-1">المتابعة القادمة:</div>
                    <div className="font-black" style={{ color: themeStyles.primary }}>{followUpDate}</div>
                  </div>
                </div>

                {/* Optional Custom Doctor Banner */}
                {doctorCustomNote && (
                  <div 
                    className="p-3 mb-5 rounded-xl border text-xs font-bold leading-relaxed flex items-start gap-2"
                    style={{ 
                      backgroundColor: themeStyles.badgeBg, 
                      borderColor: themeStyles.border, 
                      color: themeStyles.badgeText 
                    }}
                  >
                    <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black">توجيه خاص من {BRAND.doctorName}: </span>
                      <span>{doctorCustomNote}</span>
                    </div>
                  </div>
                )}

                {/* 2. CLIENT CLINICAL PROFILE & BIOMETRICS */}
                {isCompact ? (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 mb-5 text-xs font-bold text-slate-700 flex flex-wrap gap-x-4 gap-y-1">
                    <span>المتدرب: <strong className="text-slate-900">{plan.clientName || 'غير محدد'}</strong></span>
                    <span>الوزن: {weight ? `${weight} كجم` : '—'}</span>
                    <span>الهدف: {plan.targetWeight ? `${plan.targetWeight} كجم` : '—'}</span>
                    <span>السعرات: {plan.targetCalories || 1600} ك.س</span>
                    <span>الماء: {plan.dailyWaterGoalMl ? `${(plan.dailyWaterGoalMl / 1000).toFixed(1)} لتر` : '3.0 لتر'}</span>
                  </div>
                ) : (<>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 mb-6 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" style={{ color: themeStyles.primary }} />
                      <span className="font-black text-sm text-slate-900">
                        الملف الصحي للمتدرب: {plan.clientName || 'غير محدد'}
                      </span>
                    </div>
                    <span 
                      className="text-[12px] font-black px-2.5 py-0.5 rounded-full"
                      style={{ backgroundColor: themeStyles.badgeBg, color: themeStyles.badgeText }}
                    >
                      خطة علاجية مخصصة
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[12px] text-slate-500 block">الوزن الحالي / البداية:</span>
                      <strong className="text-sm font-black text-slate-800">
                        {weight ? `${weight} كجم` : '—'}
                      </strong>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[12px] text-slate-500 block">الوزن المستهدف:</span>
                      <strong className="text-sm font-black" style={{ color: themeStyles.primary }}>
                        {plan.targetWeight ? `${plan.targetWeight} كجم` : '—'}
                      </strong>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[12px] text-slate-500 block">الطول ومؤشر BMI:</span>
                      <strong className="text-sm font-black text-slate-800">
                        {height ? `${height} سم ` : ''} 
                        {bmi ? `(${bmi} - ${bmiCategory})` : '—'}
                      </strong>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[12px] text-slate-500 block">احتياج الماء اليومي:</span>
                      <strong className="text-sm font-black text-cyan-700">
                        {plan.dailyWaterGoalMl ? `${(plan.dailyWaterGoalMl / 1000).toFixed(1)} لتر` : '3.0 لتر'}
                      </strong>
                    </div>
                  </div>
                </div>

                </>)}

                {/* 3. TARGET CALORIES & MACROS DISTRIBUTION */}
                {includeMacros && !isCompact && (
                  <div className="mb-6 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-amber-500" />
                        <span>مخصص الطاقة اليومية وتوزيع الماكروز:</span>
                      </h4>
                      <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
                        السعرات الكلية: {plan.targetCalories || 1600} ك.س / يوم
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 text-xs text-center">
                      <div className="p-2.5 rounded-xl bg-peacock-mist/80 border border-peacock-sage">
                        <span className="text-[12px] font-bold text-peacock-indigo-deep block">البروتين المستهدف</span>
                        <strong className="text-sm font-black text-peacock-ink-deep">
                          {plan.targetProtein || 110} جرام
                        </strong>
                      </div>

                      <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200">
                        <span className="text-[12px] font-bold text-blue-800 block">الكربوهيدرات الصحية</span>
                        <strong className="text-sm font-black text-blue-950">
                          {plan.targetCarbs || 140} جرام
                        </strong>
                      </div>

                      <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200">
                        <span className="text-[12px] font-bold text-amber-800 block">الدهون النافعة</span>
                        <strong className="text-sm font-black text-amber-950">
                          {plan.targetFats || 45} جرام
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. MEDICAL DIAGNOSES & ALLERGIES */}
                {includeMedicalConditions && plan.medicalConditions && (
                  <div className="mb-6 p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200/90 text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-black text-rose-900">
                      <Stethoscope className="w-4 h-4 text-rose-600" />
                      <span>المحاذير الطبية والتشخيصات المعتمدة في تصميم الخطة:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {plan.medicalConditions.conditions?.length ? (
                        plan.medicalConditions.conditions.map((c) => (
                          <span key={c.id} className="px-2.5 py-0.5 rounded-md bg-white border border-rose-200 text-rose-800 font-bold">
                            • {c.label} {c.notes ? `(${c.notes})` : ''}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-600 font-medium">حالة عامة صحية - لا توجد تشخيصات استثنائية مسجلة</span>
                      )}
                    </div>
                    {plan.medicalConditions.allergies && plan.medicalConditions.allergies.length > 0 && (
                      <div className="text-[12px] text-rose-700 font-bold pt-1">
                        حساسيات وممنوعات: {plan.medicalConditions.allergies.join('، ')}
                      </div>
                    )}
                  </div>
                )}

                {/* 5. SCHEDULED MEALS & APPROVED ALTERNATIVES TABLE */}
                <div className="mb-6 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <h4 className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                      <Utensils className="w-4 h-4" style={{ color: themeStyles.primary }} />
                      <span>جدول الوجبات الغذائية اليومية والبدائل المعتمدة:</span>
                    </h4>
                    <span className="text-[12px] text-slate-500 font-bold">
                      عدد الوجبات: {plan.meals?.length || 0}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {plan.meals?.map((meal, idx) => (
                      <div 
                        key={meal.id || idx}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 page-break-inside-avoid space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between font-black">
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[12px] text-white"
                              style={{ backgroundColor: themeStyles.primary }}
                            >
                              {idx + 1}
                            </span>
                            <span className="text-sm text-slate-900">{meal.name}</span>
                          </div>

                          {(meal.calories || meal.proteinGrams) && (
                            <div className="text-[12px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                              {meal.calories ? `${meal.calories} ك.س ` : ''} 
                              {meal.proteinGrams ? `| ${meal.proteinGrams}g بروتين` : ''}
                            </div>
                          )}
                        </div>

                        {/* Meal Contents */}
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-slate-800 leading-relaxed font-medium">
                          <strong className="text-slate-900 font-black">المحتوى الأساسي: </strong>
                          {meal.items}
                        </div>

                        {/* Approved Alternatives */}
                        {includeAlternatives && !isCompact && meal.alternatives && meal.alternatives.length > 0 && (
                          <div className="p-2 rounded-xl bg-peacock-mist/60 border border-peacock-sage/80 text-[12px] text-peacock-ink space-y-1">
                            <div className="font-black flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>البدائل الإكلينيكية المسموحة في حال عدم التوفر:</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pr-2">
                              {meal.alternatives.map((alt, aidx) => (
                                <div key={aidx} className="font-medium">• {alt}</div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 6. MEDICATIONS & SUPPLEMENTS PLAN */}
                {includeMedications && !isCompact && (
                  (plan.medicationPlan?.items && plan.medicationPlan.items.length > 0) ||
                  (plan.supplements && plan.supplements.length > 0)
                ) && (
                  <div className="mb-6 p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/90 text-xs space-y-2.5 page-break-inside-avoid">
                    <h4 className="font-black text-indigo-950 flex items-center gap-1.5">
                      <Pill className="w-4 h-4 text-indigo-600" />
                      <span>خطة الأدوية والمكملات الغذائية المعتمدة:</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {plan.medicationPlan?.items?.map((med) => (
                        <div key={med.id} className="p-2 bg-white rounded-xl border border-indigo-200 flex items-center justify-between">
                          <div>
                            <strong className="text-slate-900 font-bold block">{med.name} ({med.dose})</strong>
                            <span className="text-[12px] text-slate-500">
                              {med.timings?.map((t) => t.label).join(' • ') || 'حسب التوجيه'}
                            </span>
                          </div>
                          {med.foodInteractionNote && (
                            <span className="text-[12px] bg-indigo-50 text-indigo-800 px-1.5 py-0.5 rounded font-bold">
                              {med.foodInteractionNote}
                            </span>
                          )}
                        </div>
                      ))}

                      {plan.supplements?.map((supp) => (
                        <div key={supp.id} className="p-2 bg-white rounded-xl border border-indigo-200 flex items-center justify-between">
                          <div>
                            <strong className="text-slate-900 font-bold block">{supp.name}</strong>
                            <span className="text-[12px] text-slate-500">{supp.time || 'مع الطعام'}</span>
                          </div>
                          <span className="text-[12px] text-peacock-indigo-dark bg-peacock-mist px-1.5 py-0.5 rounded font-bold">
                            مكمل
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 7. DAILY HABITS & INSTRUCTIONS CHECKLIST */}
                {includeHabits && !isCompact && plan.checklist && plan.checklist.length > 0 && (
                  <div className="mb-6 space-y-2 page-break-inside-avoid text-xs">
                    <h4 className="font-black text-slate-900 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-peacock-indigo" />
                      <span>العادات والالتزامات اليومية الإلزامية:</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {plan.checklist.map((chk) => (
                        <div key={chk.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-bold flex items-center gap-2">
                          <div className="w-3.5 h-3.5 rounded border border-peacock-indigo bg-peacock-mist shrink-0" />
                          <span>{chk.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 8. DOCTOR CLINICAL TIPS */}
                {includeTips && !isCompact && plan.tips && plan.tips.length > 0 && (
                  <div className="mb-6 p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs space-y-2 page-break-inside-avoid">
                    <h4 className="font-black text-amber-950 flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4 text-amber-600" />
                      <span>توجيهات وإرشادات {BRAND.doctorName} السريرية:</span>
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-slate-800 font-medium">
                      {plan.tips.map((tip, tidx) => (
                        <li key={tidx}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 9. OFFICIAL FOOTER WITH SIGNATURE, STAMP & APP SYNC CODE */}
                <div 
                  className="pt-5 mt-6 border-t-2 flex flex-col sm:flex-row items-center justify-between gap-4 page-break-inside-avoid"
                  style={{ borderColor: themeStyles.border }}
                >
                  {/* Stamp & Signature */}
                  {includeStamp && !isCompact && (
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-20 h-20 rounded-full border-2 border-dashed flex flex-col items-center justify-center p-1 text-center"
                        style={{ borderColor: themeStyles.primary, color: themeStyles.primaryDark }}
                      >
                        <ShieldCheck className="w-5 h-5 mb-0.5" />
                        <span className="text-[8px] font-black leading-tight">معتمد سريرياً</span>
                        <span className="text-[7px] font-bold leading-none">{BRAND.doctorName}</span>
                      </div>
                      <div className="text-xs">
                        <span className="font-black text-slate-900 block">
                          توقيع واستشارة: {BRAND.doctorName}
                        </span>
                        <span className="text-[12px] text-slate-500 block">
                          أخصائية التغذية العلاجية وإدارة السمنة
                        </span>
                        <span className="text-[12px] text-peacock-indigo-dark font-bold block mt-0.5">
                          تاريخ الاعتماد: {issueDate}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* App Sync Code */}
                  {includeSyncCode && !isCompact && (
                    <div className="text-left bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[12px] max-w-[260px]">
                      <div className="flex items-center gap-1 text-slate-700 font-black mb-0.5">
                        <QrCode className="w-3.5 h-3.5 text-peacock-indigo" />
                        <span>كود تفعيل الخطة بالتطبيق:</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight mb-1">
                        يمكن للمتدرب نسخ كود الخطة لتطبيق Smart Diet لتسجيل الوجبات تلقائياً
                      </p>
                      <code className="block bg-white p-1 rounded border text-[9px] text-peacock-indigo-deep font-mono select-all truncate">
                        {generatePlanSyncCode(plan).slice(0, 38)}...
                      </code>
                    </div>
                  )}
                </div>

                {/* Medical Disclaimer */}
                <div className="mt-4 pt-2 text-center text-[10px] text-slate-400 font-medium">
                  هذه الخطة الغذائية العلاجية مصممة خصيصاً للمتدرب المذكور أعلاه وفق قياساته وأهدافه الصحية، ولا يجوز تداولها لحالات أخرى دون استشارة طبية.
                </div>

              </div>
            </div>

          </div>

        </div>

        {/* Bottom Actions Bar */}
        <div className="p-3 sm:p-4 bg-slate-50/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
          >
            إغلاق
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBrowserPrint}
              type="button"
              className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الروشتة (Print / Save as PDF)</span>
            </button>

            <button
              onClick={handleDownloadDirectPDF}
              disabled={isGenerating}
              type="button"
              className="py-2.5 px-5 rounded-xl bg-peacock-indigo hover:bg-peacock-indigo-dark text-white font-black text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-md disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التصدير...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>تنزيل ملف PDF الآن</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
