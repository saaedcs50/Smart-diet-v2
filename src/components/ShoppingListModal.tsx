import React, { useMemo, useState } from 'react';
import { ShoppingCart, RefreshCw, Share2, Plus, Trash2, Check } from 'lucide-react';
import { PlanConfig } from '../types';
import { BottomSheetModal } from './BottomSheetModal';
import {
  ShoppingItem,
  ShoppingListState,
  generateShoppingList,
  getWeekStartISO,
  loadShoppingList,
  saveShoppingList,
  mergeRegeneratedItems,
  buildShoppingShareText,
} from '../utils/shoppingList';
import { getTodayDateString } from '../utils/storage';
import { openWhatsAppShare } from '../utils/whatsapp';

interface ShoppingListModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PlanConfig;
  onNotify: (msg: string) => void;
}

/**
 * Batch 2.1 — قائمة التسوق الأسبوعية: توليد من الخطة، تعليم/حذف/إضافة
 * يدوية، حفظ أسبوعي مستقل، إعادة توليد بتأكيد، ومشاركة واتساب نصية.
 */
export const ShoppingListModal: React.FC<ShoppingListModalProps> = ({ isOpen, onClose, plan, onNotify }) => {
  const weekStartISO = useMemo(() => getWeekStartISO(getTodayDateString()), []);
  const [state, setState] = useState<ShoppingListState>(() => {
    const stored = loadShoppingList(weekStartISO);
    if (stored) return stored;
    return {
      weekStartISO,
      days: 7,
      people: 1,
      items: generateShoppingList(plan.meals, 7, 1),
      updatedAt: new Date().toISOString(),
    };
  });
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [manualName, setManualName] = useState('');

  const persist = (next: ShoppingListState) => {
    setState(next);
    saveShoppingList(next);
  };

  const updateItem = (id: string, patch: Partial<ShoppingItem>) => {
    persist({ ...state, items: state.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  };

  const handleRegenerate = () => {
    const fresh = generateShoppingList(plan.meals, state.days, state.people);
    persist({ ...state, items: mergeRegeneratedItems(state.items, fresh) });
    setShowRegenConfirm(false);
    onNotify('تمت إعادة توليد القائمة من الخطة الحالية 🛒');
  };

  const handleAddManual = () => {
    const name = manualName.trim();
    if (!name) return;
    const item: ShoppingItem = {
      id: `manual-${Date.now()}`,
      name,
      originalText: name,
      totalQuantity: null,
      sources: [],
      occurrencesPerWeek: 0,
      manual: true,
    };
    persist({ ...state, items: [...state.items, item] });
    setManualName('');
  };

  const handleSettingsChange = (days: number, people: number) => {
    // تغيير الأيام/الأفراد يعيد حساب الكميات المولّدة مع الحفاظ على اليدوي والتعليم
    const fresh = generateShoppingList(plan.meals, days, people);
    const byId = new Map<string, ShoppingItem>(state.items.map((i) => [i.id, i]));
    const merged = fresh.map((f) => {
      const old = byId.get(f.id);
      return old ? { ...f, checked: old.checked, deleted: old.deleted } : f;
    });
    const manual = state.items.filter((i) => i.manual);
    persist({ ...state, days, people, items: [...merged, ...manual] });
  };

  const visibleItems = state.items.filter((i) => !i.deleted);
  const checkedCount = visibleItems.filter((i) => i.checked).length;

  if (!isOpen) return null;

  return (
    <BottomSheetModal isOpen={isOpen} onClose={onClose} title="قائمة تسوق الأسبوع 🛒" maxWidth="max-w-2xl">
      <div dir="rtl" className="space-y-4">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
          أسبوع يبدأ {weekStartISO} • {checkedCount}/{visibleItems.length} تم شراؤها
        </p>

        {/* الإعدادات: أيام × أفراد */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-black text-slate-700 dark:text-slate-200">عدد الأيام</label>
          <input
            type="number"
            min={1}
            max={14}
            value={state.days}
            onChange={(e) => handleSettingsChange(Math.max(1, parseInt(e.target.value, 10) || 7), state.people)}
            className="w-16 text-center text-sm font-black p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          />
          <label className="text-xs font-black text-slate-700 dark:text-slate-200">عدد الأفراد</label>
          <input
            type="number"
            min={1}
            max={10}
            value={state.people}
            onChange={(e) => handleSettingsChange(state.days, Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-16 text-center text-sm font-black p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          />
        </div>

        {visibleItems.length === 0 ? (
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-300 dark:border-slate-600 text-center space-y-2">
            <ShoppingCart className="w-8 h-8 mx-auto text-slate-400" />
            <p className="text-sm font-black text-slate-700 dark:text-slate-200">القائمة فارغة</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              لا توجد عناصر في وجبات الخطة الحالية. أضِف عناصر من لوحة الأخصائية أو أضِف بنودًا يدوية هنا.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5 max-h-[45vh] overflow-y-auto pl-1">
            {visibleItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60"
              >
                <button
                  type="button"
                  onClick={() => updateItem(item.id, { checked: !item.checked })}
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                    item.checked
                      ? 'bg-peacock-blue border-peacock-blue text-white'
                      : 'border-slate-300 dark:border-slate-600 text-transparent'
                  }`}
                  aria-label={item.checked ? 'إلغاء تعليم' : 'تعليم كتم شراؤه'}
                >
                  <Check className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm font-bold block truncate ${
                      item.checked ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {item.name}
                    {item.totalQuantity != null && (
                      <span className="text-peacock-indigo dark:text-peacock-teal font-black">
                        {' '}
                        — {item.totalQuantity}
                        {item.unit ? ` ${item.unit}` : ''}
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 block truncate">
                    {item.manual ? 'إضافة يدوية' : `الأصل في الخطة: ${item.originalText}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => updateItem(item.id, { deleted: true })}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer shrink-0"
                  aria-label="حذف العنصر"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* إضافة يدوية */}
        <div className="flex gap-2">
          <input
            type="text"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddManual()}
            placeholder="إضافة بند يدوي… مثال: خبز بلدي"
            className="flex-1 text-sm font-bold p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={handleAddManual}
            className="px-3.5 rounded-xl bg-peacock-blue hover:bg-peacock-indigo text-white font-black text-sm flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> إضافة
          </button>
        </div>

        {/* إجراءات */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => openWhatsAppShare(buildShoppingShareText(state, plan.clientName))}
            className="flex-1 py-3 rounded-2xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-black text-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Share2 className="w-4 h-4" /> مشاركة واتساب
          </button>
          <button
            type="button"
            onClick={() => setShowRegenConfirm(true)}
            className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> إعادة توليد من الخطة
          </button>
        </div>

        {showRegenConfirm && (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 space-y-2.5">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
              إعادة التوليد تستبدل البنود المولّدة من الخطة وتُصفّر تعليماتها. البنود اليدوية تبقى كما هي.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRegenerate}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs cursor-pointer"
              >
                تأكيد إعادة التوليد
              </button>
              <button
                type="button"
                onClick={() => setShowRegenConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-black text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>
    </BottomSheetModal>
  );
};
