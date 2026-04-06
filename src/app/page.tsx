"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStudents, getTeachers, getClassrooms } from '@/lib/services/db';
import { getLessonsByDateRange } from '@/lib/services/schedule';
import { multiSheetExport } from '@/lib/utils/excel';
import { useAuth } from '@/components/providers/AuthProvider';
import { logout } from '@/lib/services/auth';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableModuleCard({ module, onActionClick }: { module: any, onActionClick?: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.href });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  const CardContent = (
    <>
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 duration-300
          ${module.featured ? 'bg-white/10' : 'bg-white shadow-sm'}`}
        style={{ color: module.featured ? 'white' : module.accent }}
      >
        {module.icon}
      </div>

      <p className={`text-[10px] font-black tracking-[0.35em] uppercase mb-2
        ${module.featured ? 'text-white/50' : 'text-[#4a4238]/40'}`}>
        {module.label}
      </p>

      <h3 className={`font-serif text-2xl font-black tracking-[0.1em] mb-3
        ${module.featured ? 'text-white' : 'text-[#4a4238]'}`}>
        {module.title}
      </h3>

      <p className={`text-sm leading-relaxed flex-1
        ${module.featured ? 'text-white/70' : 'text-[#4a4238]/60'}`}>
        {module.desc}
      </p>

      <div className={`mt-6 flex items-center gap-2 text-xs font-black tracking-widest
        ${module.featured ? 'text-white/80' : 'text-[#4a4238]/40'}`}>
        <span>{module.isAction ? '開啟功能' : '進入模組'}</span>
        <span className="group-hover:translate-x-1 transition-transform">→</span>
      </div>

      {module.featured && (
        <div className="absolute top-5 right-5 bg-[#c4a484] text-white text-[9px] font-black tracking-widest px-2.5 py-1 rounded-full">
          CORE
        </div>
      )}
    </>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group flex flex-col rounded-[28px] p-8 border-2 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl cursor-pointer
        ${module.featured
          ? 'bg-[#4a4238] border-[#4a4238] text-white shadow-xl shadow-[#4a4238]/20'
          : `bg-gradient-to-br ${module.bg} border-white/80 hover:border-white shadow-sm`
        } ${isDragging ? 'opacity-50 shadow-2xl scale-105' : ''}`}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging) e.preventDefault();
      }}
    >
      {module.isAction ? (
        <div onClick={() => !isDragging && onActionClick?.()} className="w-full h-full flex flex-col">
          {CardContent}
        </div>
      ) : (
        <Link href={module.href} onClick={(e) => isDragging && e.preventDefault()} className="w-full h-full flex flex-col">
          {CardContent}
        </Link>
      )}
    </div>
  );
}

const modules = [
  {
    href: '/schedule',
    label: 'Schedule',
    title: '課程排程',
    desc: '教室與教師一覽，防撞堂自動配置',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    accent: '#6d9ab5',
    bg: 'from-[#eef4f8] to-[#ddeaf3]',
    permissionKey: 'schedule',
  },
  {
    href: '/database',
    label: 'Database',
    title: '師生資料庫',
    desc: '學生帳戶、教師檔案與教室設備管理',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    accent: '#7a9e7e',
    bg: 'from-[#eef5ef] to-[#ddeedd]',
    permissionKey: 'database',
  },
  {
    href: '/finance',
    label: 'Finance',
    title: '財務與核銷',
    desc: '課程儲值、薪資撥款與月營運分析',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    accent: '#c4a484',
    bg: 'from-[#f8f4ef] to-[#f0e8de]',
    featured: true,
    permissionKey: 'finance',
  },
  {
    href: '/ledger',
    label: 'Ledger',
    title: '每日對帳單',
    desc: '自動摘要現金匯款與教師薪資抽成',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    accent: '#9b7cc8',
    bg: 'from-[#f3eff8] to-[#e8e0f2]',
    permissionKey: 'ledger',
  },
  {
    href: '/holidays',
    label: 'Holidays',
    title: '老師排休管理',
    desc: '連假設定、每週重複排休與衝突偵測',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 18v-5l-4 4m4-4l4 4" />
      </svg>
    ),
    accent: '#f43f5e',
    bg: 'from-[#fff1f2] to-[#ffe4e6]',
    permissionKey: 'holidays',
  },
  {
    href: '/settings',
    id: 'settings',
    label: 'Settings',
    title: '系統設定',
    desc: '帳號權限管理與系統備份',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    bg: 'from-[#ece4d9] to-[#dcd4c9]',
    permissionKey: 'settings',
  },
  {
    href: '/teacher-dashboard/schedule',
    label: 'Portal',
    title: '我的老師課表',
    desc: '老師專用視圖：自有課程詳細呈現，他人佔用遮蔽顯示',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    accent: '#3b82f6',
    bg: 'from-[#eff6ff] to-[#dbeafe]',
    permissionKey: 'portal',
  },
];

export default function Home() {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedModules, setSelectedModules] = useState<string[]>(['students', 'teachers', 'classrooms', 'lessons']);
  const [isExporting, setIsExporting] = useState(false);
  
  const { profile, hasPermission } = useAuth();
  const router = useRouter();

  const [orderedModules, setOrderedModules] = useState(modules);

  useEffect(() => {
    const saved = localStorage.getItem('7th_dashboard_order');
    if (saved) {
      try {
        const orderArray = JSON.parse(saved);
        const newModules = orderArray.map((id: string) => modules.find(m => m.href === id)).filter(Boolean);
        if (newModules.length === modules.length) {
          setOrderedModules(newModules);
        }
      } catch (e) {}
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setOrderedModules((items) => {
        const oldIndex = items.findIndex((item) => item.href === active.id);
        const newIndex = items.findIndex((item) => item.href === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem('7th_dashboard_order', JSON.stringify(newOrder.map(m => m.href)));
        return newOrder;
      });
    }
  };

  const exportOptions = [
    { id: 'students', label: '學員資料', get: getStudents },
    { id: 'teachers', label: '教師資料', get: getTeachers },
    { id: 'classrooms', label: '教室資料', get: getClassrooms },
    { id: 'lessons', label: '預約紀錄 (全年度)', get: async () => {
        const now = new Date();
        return await getLessonsByDateRange(`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`);
      } 
    },
  ];

  const handleSelectAll = () => {
    if (selectedModules.length === exportOptions.length) setSelectedModules([]);
    else setSelectedModules(exportOptions.map(o => o.id));
  };

  const handleExport = async () => {
    if (selectedModules.length === 0) return;
    setIsExporting(true);
    try {
      const sheets: { [key: string]: any[] } = {};
      for (const opt of exportOptions) {
        if (selectedModules.includes(opt.id)) {
          const data = await opt.get();
          sheets[opt.label] = data;
        }
      }
      multiSheetExport(sheets, `第七樂章_系統資料備份_${new Date().toISOString().split('T')[0]}`);
      setIsExportModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("匯出失敗，請查看控制台。");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-[#f8f7f2] relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none -z-10">
        <div className="absolute top-[-15%] right-[-5%] w-[45vw] h-[45vw] rounded-full bg-[#ece4d9] blur-[140px] opacity-60" />
        <div className="absolute bottom-[-5%] left-[-10%] w-[35vw] h-[35vw] rounded-full bg-[#c4a484]/15 blur-[110px] opacity-50" />
      </div>

      {/* ── Navbar ── */}
      <div className="w-full max-w-7xl mx-auto px-6 pt-6 z-50">
        <nav className="glass-nav px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full border border-[#4a4238] flex items-center justify-center font-serif text-lg font-bold text-[#4a4238]">7th</div>
            <div>
              <h1 className="font-serif font-bold text-base tracking-widest text-[#4a4238] leading-tight">第七樂章</h1>
              <p className="text-[#c4a484] text-[10px] tracking-[0.25em] font-bold uppercase">智能營運管理系統</p>
            </div>
          </div>

          {/* Quick-nav pills */}
          <div className="hidden md:flex items-center gap-2 bg-[#ece4d9]/30 p-1.5 rounded-full border border-[#ece4d9]">
            {modules.map(m => (
              <Link
                key={m.href}
                href={m.href}
                className="px-5 py-2 rounded-full text-xs font-black tracking-widest text-[#4a4238] hover:bg-white hover:shadow-sm transition-all"
              >
                {m.title}
              </Link>
            ))}
          </div>

          {profile ? (
            <button
              onClick={async () => { await logout(); router.push('/login'); }}
              className="bg-[#ece4d9] hover:bg-[#c4a484] text-[#4a4238] cursor-pointer hover:text-white px-6 py-2.5 rounded-full text-xs font-black tracking-widest transition-all duration-300 shadow-sm hover:shadow-xl"
            >
              系統登出 →
            </button>
          ) : (
            <Link
              href="/login"
              className="bg-[#4a4238] hover:bg-[#c4a484] text-white px-6 py-2.5 rounded-full text-xs font-black tracking-widest transition-all duration-300 shadow-md hover:shadow-xl"
            >
              系統登入 →
            </Link>
          )}
        </nav>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex flex-col w-full max-w-7xl mx-auto px-6 pb-8 pt-6">

        {/* Page header — compact */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-[11px] font-black tracking-[0.3em] text-[#c4a484] mb-1 uppercase">Dashboard</p>
            <h2 className="font-serif text-3xl font-black text-[#4a4238] tracking-[0.1em]">選擇功能模組</h2>
          </div>
          <p className="text-[#4a4238]/40 text-xs font-bold tracking-widest hidden md:block">
            第七樂章藝術學院 · The Seventh Movement
          </p>
        </div>

        {/* ── Module Cards Grid ── */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={orderedModules.map(m => m.href)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 flex-1">
              {orderedModules
                .filter(m => {
                  const pk = (m as any).permissionKey;
                  if (!pk) return true;
                  // 特殊處理：如果是 TEACHER，PORTAL 永遠顯示
                  if (pk === 'portal' && profile?.role === 'TEACHER') return true;
                  return hasPermission(pk as any, 'VIEW');
                })
                .map(m => (
                <SortableModuleCard 
                  key={m.href} 
                  module={m} 
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* ── Bottom quick links ── */}
        <div className="mt-6 flex items-center justify-center gap-6 text-[11px] font-bold tracking-widest text-[#4a4238]/30">
          <span>第七樂章藝術學院管理系統</span>
          <span>·</span>
          <Link href="/login" className="hover:text-[#c4a484] transition-colors">系統登入</Link>
          <span>·</span>
          <span>© 2026 All Rights Reserved</span>
        </div>
        {/* ── Export Settings Modal ── */}
        {isExportModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#4a4238]/40 backdrop-blur-md" onClick={() => setIsExportModalOpen(false)}></div>
            <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden border border-[#ece4d9] animate-in fade-in zoom-in duration-300">
               <div className="p-8 md:p-10">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="font-serif text-3xl font-black text-[#4a4238] tracking-widest mb-2">批次資料匯出</h3>
                      <p className="text-xs font-bold text-[#c4a484] tracking-[0.2em]">BACKUP & DATA EXPORT</p>
                    </div>
                    <button onClick={() => setIsExportModalOpen(false)} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">✕</button>
                  </div>

                  <div className="space-y-6">
                    <div className="flex justify-between items-center bg-[#f8f7f2] p-4 rounded-2xl border border-[#ece4d9]">
                       <span className="font-bold text-[#4a4238] text-sm">選擇要匯出的模組資料</span>
                       <button onClick={handleSelectAll} className="text-[10px] font-black text-[#c4a484] hover:text-[#4a4238] tracking-widest uppercase">
                          {selectedModules.length === exportOptions.length ? '全部取消 Deselect All' : '全部選擇 Select All'}
                       </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {exportOptions.map(opt => (
                        <label key={opt.id} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedModules.includes(opt.id) ? 'border-[#4a4238] bg-[#4a4238]/5' : 'border-[#ece4d9] bg-white opacity-60'}`}>
                           <span className={`font-black tracking-widest ${selectedModules.includes(opt.id) ? 'text-[#4a4238]' : 'text-[#4a4238]/40'}`}>
                              {opt.label}
                           </span>
                           <input 
                              type="checkbox" 
                              checked={selectedModules.includes(opt.id)}
                              onChange={() => {
                                if (selectedModules.includes(opt.id)) setSelectedModules(selectedModules.filter(id => id !== opt.id));
                                else setSelectedModules([...selectedModules, opt.id]);
                              }}
                              className="w-5 h-5 accent-[#4a4238]"
                           />
                        </label>
                      ))}
                    </div>

                    <button 
                      onClick={handleExport}
                      disabled={isExporting || selectedModules.length === 0}
                      className="w-full bg-[#4a4238] hover:bg-[#c4a484] disabled:bg-gray-300 text-white py-5 rounded-[20px] font-black tracking-[0.3em] shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-3"
                    >
                       {isExporting ? (
                         <>
                           <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                           <span>封裝資料中...</span>
                         </>
                       ) : (
                         <>
                           <span>🚀 一鍵匯出所選資料</span>
                         </>
                       )}
                    </button>
                  </div>
               </div>
               <div className="bg-[#f8f7f2] px-8 py-4 text-center border-t border-[#ece4d9]">
                  <p className="text-[9px] font-bold text-[#4a4238]/30 tracking-widest uppercase">系統將自動產生含多個分頁的 Excel 報表文件</p>
               </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
