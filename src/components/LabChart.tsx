import React from 'react';
import { LabEntry } from '../types';
import { LabTestCatalogItem } from '../utils/labTracking';

interface LabChartProps {
 entries: LabEntry[];
 meta: LabTestCatalogItem;
 height?: number;
}

export const LabChart: React.FC<LabChartProps> = ({ entries, meta, height = 180 }) => {
 // Sort chronologically ascending
 const sorted = [...entries].sort((a, b) => {
 const cmp = a.date.localeCompare(b.date);
 if (cmp !== 0) return cmp;
 return (a.createdAt || '').localeCompare(b.createdAt || '');
 });

 // Limit to last 12 points for visual clarity
 const data = sorted.slice(-12);

 if (data.length === 0) {
 return (
 <div className="h-28 flex items-center justify-center text-xs text-slate-400">
 لا توجد قراءات كافية لرسم المنحنى
 </div>
 );
 }

 const values = data.map((d) => d.value);
 let minVal = Math.min(...values);
 let maxVal = Math.max(...values);

 // If normal guidance range exists, factor it into scale limits
 if (meta.rangeGuidance.min !== undefined) {
 minVal = Math.min(minVal, meta.rangeGuidance.min * 0.9);
 }
 if (meta.rangeGuidance.max !== undefined) {
 maxVal = Math.max(maxVal, meta.rangeGuidance.max * 1.1);
 }

 // Add padding to range
 const range = maxVal - minVal || 1;
 const chartMin = Math.max(0, minVal - range * 0.15);
 const chartMax = maxVal + range * 0.15;
 const fullRange = chartMax - chartMin || 1;

 // Chart dimensions
 const paddingX = 40;
 const paddingTop = 25;
 const paddingBottom = 35;
 const width = 480; // viewBox width

 const getY = (val: number) => {
 const norm = (val - chartMin) / fullRange;
 return height - paddingBottom - norm * (height - paddingTop - paddingBottom);
 };

 const getX = (index: number) => {
 if (data.length === 1) return width / 2;
 return paddingX + (index / (data.length - 1)) * (width - paddingX * 2);
 };

 const points = data.map((d, i) => ({
 x: getX(i),
 y: getY(d.value),
 val: d.value,
 date: d.date,
 addedBy: d.addedBy,
 }));

 const polylineStr = points.map((p) => `${p.x},${p.y}`).join(' ');

 // Normal range band coordinates if applicable
 const hasMinRange = meta.rangeGuidance.min !== undefined;
 const hasMaxRange = meta.rangeGuidance.max !== undefined;

 let bandTop = paddingTop;
 let bandBottom = height - paddingBottom;

 if (hasMaxRange) {
 bandTop = Math.max(paddingTop, getY(meta.rangeGuidance.max!));
 }
 if (hasMinRange) {
 bandBottom = Math.min(height - paddingBottom, getY(meta.rangeGuidance.min!));
 }

 const showRangeBand = (hasMinRange || hasMaxRange) && bandBottom > bandTop;

 // Format date helper (e.g. "15/08")
 const formatDateLabel = (dateStr: string) => {
 try {
 const parts = dateStr.split('-');
 if (parts.length === 3) {
 return `${parts[2]}/${parts[1]}`;
 }
 } catch {
 // fallback
 }
 return dateStr;
 };

 return (
 <div className="w-full overflow-hidden">
 <svg
 viewBox={`0 0 ${width} ${height}`}
 className="w-full h-auto overflow-visible select-none"
 >
 <defs>
 <linearGradient id={`grad-${meta.id}`} x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stopColor={meta.color.dot} stopOpacity="0.25" />
 <stop offset="100%" stopColor={meta.color.dot} stopOpacity="0.0" />
 </linearGradient>
 </defs>

 {/* Normal Guidance Range Shaded Band */}
 {showRangeBand && (
 <g>
 <rect
 x={paddingX - 10}
 y={bandTop}
 width={width - paddingX * 2 + 20}
 height={Math.max(4, bandBottom - bandTop)}
 fill="currentColor"
 className="text-peacock-blue/10 dark:text-peacock-teal/10"
 rx="4"
 />
 {hasMaxRange && (
 <line
 x1={paddingX - 10}
 y1={bandTop}
 x2={width - paddingX + 10}
 y2={bandTop}
 stroke="currentColor"
 className="text-peacock-blue/40 dark:text-peacock-teal/30 stroke-dasharray-[3_3]"
 strokeWidth="1"
 />
 )}
 {hasMinRange && (
 <line
 x1={paddingX - 10}
 y1={bandBottom}
 x2={width - paddingX + 10}
 y2={bandBottom}
 stroke="currentColor"
 className="text-peacock-blue/40 dark:text-peacock-teal/30 stroke-dasharray-[3_3]"
 strokeWidth="1"
 />
 )}
 <text
 x={width - paddingX + 6}
 y={(bandTop + bandBottom) / 2 + 3}
 className="text-[12px] font-bold fill-peacock-indigo dark:fill-peacock-teal"
 textAnchor="start"
 >
 نطاق إرشادي
 </text>
 </g>
 )}

 {/* Baseline grid */}
 <line
 x1={paddingX - 10}
 y1={height - paddingBottom}
 x2={width - paddingX + 10}
 y2={height - paddingBottom}
 stroke="currentColor"
 className="text-slate-200 dark:text-slate-700/60"
 strokeWidth="1"
 />

 {/* Area fill under the line */}
 {points.length > 1 && (
 <polygon
 points={`${points[0].x},${height - paddingBottom} ${polylineStr} ${
 points[points.length - 1].x
 },${height - paddingBottom}`}
 fill={`url(#grad-${meta.id})`}
 />
 )}

 {/* Main Line */}
 {points.length > 1 && (
 <polyline
 points={polylineStr}
 fill="none"
 stroke={meta.color.dot}
 strokeWidth="3"
 strokeLinecap="round"
 strokeLinejoin="round"
 />
 )}

 {/* Data points and labels */}
 {points.map((p, i) => (
 <g key={i}>
 {/* Vertical connector guide */}
 <line
 x1={p.x}
 y1={p.y}
 x2={p.x}
 y2={height - paddingBottom}
 stroke="currentColor"
 className="text-slate-300/40 dark:text-slate-700/40 stroke-dasharray-[2_2]"
 strokeWidth="1"
 />

 {/* Outer Circle Ring */}
 <circle
 cx={p.x}
 y={p.y}
 r={i === points.length - 1 ? '6' : '4.5'}
 fill="#ffffff"
 stroke={meta.color.dot}
 strokeWidth={i === points.length - 1 ? '3' : '2.5'}
 className="dark:fill-slate-900"
 />

 {/* Value label above point */}
 <g transform={`translate(${p.x}, ${p.y - 9})`}>
 <text
 textAnchor="middle"
 className={`text-[12px] font-extrabold ${
 i === points.length - 1
 ? 'fill-slate-900 dark:fill-white font-black'
 : 'fill-slate-700 dark:fill-slate-300'
 }`}
 >
 {p.val}
 </text>
 </g>

 {/* Date label under x-axis */}
 <text
 x={p.x}
 y={height - paddingBottom + 16}
 textAnchor="middle"
 className="text-[9.5px] font-medium fill-slate-400 dark:fill-slate-500"
 >
 {formatDateLabel(p.date)}
 </text>
 </g>
 ))}
 </svg>
 </div>
 );
};
