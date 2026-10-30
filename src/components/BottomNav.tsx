import React from 'react';
import { ClipboardList, Ruler, BarChart3 } from 'lucide-react';
import { ActiveTab, PlanConfig } from '../types';
import { isSectionVisible } from '../utils/storage';

interface BottomNavProps {
  plan?: PlanConfig;
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ plan, activeTab, onChangeTab }) => {
  const showBody = isSectionVisible(plan, 'bodyTab');
  const showReports = isSectionVisible(plan, 'reportsTab');

  const allNavItems: { id: ActiveTab; label: string; icon: React.ReactNode; show: boolean }[] = [
    {
      id: 'today',
      label: 'اليوميات',
      icon: <ClipboardList className="w-5 h-5" />,
      show: true,
    },
    {
      id: 'body',
      label: 'الجسم والقياسات',
      icon: <Ruler className="w-5 h-5" />,
      show: showBody,
    },
    {
      id: 'reports',
      label: 'التقارير والإحصاء',
      icon: <BarChart3 className="w-5 h-5" />,
      show: showReports,
    },
  ];

  const visibleItems = allNavItems.filter((i) => i.show);

  // If only 1 tab is visible, don't show navigation bar
  if (visibleItems.length <= 1) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-0 right-0 z-40 px-4 pointer-events-none flex justify-center">
      <nav className="pointer-events-auto w-full max-w-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800/80 rounded-full shadow-lg shadow-slate-900/5 dark:shadow-black/30 p-1.5 transition-all">
        <div 
          className="grid h-12 items-center"
          style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}
        >
          {visibleItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeTab(item.id)}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-full transition-all duration-200 cursor-pointer relative ${
                  isActive
                    ? 'bg-peacock-blue text-white font-black shadow-md shadow-peacock-blue/25 scale-[1.02]'
                    : 'text-slate-500 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                }`}
              >
                {item.icon}
                <span className="text-xs tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
