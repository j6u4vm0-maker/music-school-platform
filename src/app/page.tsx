"use client";

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import Navbar from '@/components/layout/Navbar';
import { usePinnedModules } from '@/hooks/usePinnedModules';
import { useDashboard } from '@/hooks/useDashboard';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableModuleCard({ module, onActionClick }: { module: any, onActionClick?: () => void }) {
  const { pinnedHrefs, togglePin } = usePinnedModules();
  const isPinned = pinnedHrefs.includes(module.href);

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
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  const cardStyles = `w-full h-full p-8 rounded-[40px] flex flex-col justify-between transition-all duration-500 border-2 border-white/50 shadow-sm hover:shadow-2xl relative overflow-hidden bg-gradient-to-br ${module.bg}`;

  const CardVisuals = (
    <>
      <div className="absolute top-[-10%] right-[-10%] w-32 h-32 rounded-full bg-white opacity-20 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
      <div className="relative z-10">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-inner transition-transform group-hover:scale-110 group-hover:rotate-3 duration-500`} style={{ backgroundColor: 'white' }}>
          <div style={{ color: module.accent }}>{module.icon}</div>
        </div>
        <h3 className="text-xl font-black mb-2 text-[#4a4238] tracking-widest">{module.title}</h3>
        <p className="text-xs font-bold text-[#4a4238]/60 leading-relaxed tracking-wide min-h-[3em]">{module.desc}</p>
      </div>
      <div className="flex items-center gap-2 mt-6 relative z-10 group-hover:translate-x-1 transition-transform">
        <span className="text-[10px] font-black tracking-[0.3em] text-[#4a4238] uppercase">Explore Module</span>
        <svg className="w-4 h-4 text-[#4a4238]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </div>
      {module.featured && <div className="absolute bottom-[68px] left-8 bg-[#c4a484] text-white text-[9px] font-black tracking-widest px-2.5 py-1 rounded-full z-20">CORE</div>}
    </>
  );

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="h-full relative group">
      {module.isAction ? (
        <div onClick={onActionClick} role="button" className={`${cardStyles} text-left cursor-pointer`}>{CardVisuals}</div>
      ) : (
        <Link href={module.href} className={`block ${cardStyles}`}>{CardVisuals}</Link>
      )}
      <button 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(module.href); }}
        className={`absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center transition-all z-20 ${isPinned ? 'bg-amber-100 text-amber-500' : 'bg-white/50 text-[#4a4238]/20'}`}
      >
        <svg className={`w-5 h-5 ${isPinned ? 'fill-current' : 'fill-none'}`} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      </button>
    </div>
  );
}

export default function Home() {
  const { profile, hasPermission } = useAuth();
  const dashboard = useDashboard();
  
  const {
    isExportModalOpen, setIsExportModalOpen,
    selectedModules, setSelectedModules,
    isExporting,
    orderedModules,
    handleDragEnd,
    exportOptions,
    handleSelectAll,
    handleExport
  } = dashboard;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  return (
    <main className="min-h-screen flex flex-col bg-[#f8f7f2] relative overflow-hidden animate-fade-in">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none -z-10">
        <div className="absolute top-[-15%] right-[-5%] w-[45vw] h-[45vw] rounded-full bg-[#ece4d9] blur-[140px] opacity-60" />
        <div className="absolute bottom-[-5%] left-[-10%] w-[35vw] h-[35vw] rounded-full bg-[#c4a484]/15 blur-[110px] opacity-50" />
      </div>

      <Navbar />

      <div className="flex-1 flex flex-col w-full max-w-7xl mx-auto px-6 pb-8 pt-6">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-[11px] font-black tracking-[0.3em] text-[#c4a484] mb-1 uppercase">Dashboard</p>
            <h2 className="font-serif text-3xl font-black text-[#4a4238] tracking-[0.1em]">核心功能模組</h2>
          </div>
          <p className="text-[#4a4238]/40 text-xs font-bold tracking-widest hidden md:block">第七樂章藝術學院 · The Seventh Movement</p>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedModules.map(m => m.href)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 flex-1">
              {orderedModules
                .filter(m => {
                  const pk = (m as any).permissionKey;
                  if (!pk) return true;
                  if (pk === 'portal' && profile?.role === 'TEACHER') return true;
                  return hasPermission(pk as any, 'VIEW');
                })
                .map(m => (
                <SortableModuleCard key={m.href} module={m} />
              ))}
              
              {hasPermission('settings', 'VIEW') && (
                <SortableModuleCard 
                  module={{
                    id: 'backup', href: '#backup', title: '一鍵系統備份', desc: '批次匯出學員、老師與全年度課表資料至 Excel',
                    icon: (
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    ),
                    bg: 'from-amber-50 to-orange-50', accent: '#d97706', isAction: true, permissionKey: 'settings'
                  }}
                  onActionClick={() => setIsExportModalOpen(true)}
                />
              )}
            </div>
          </SortableContext>
        </DndContext>

        <div className="mt-6 flex items-center justify-center gap-6 text-[11px] font-bold tracking-widest text-[#4a4238]/30">
          <span>第七樂章藝術學院管理系統</span>
          <span>·</span>
          <Link href="/login" className="hover:text-[#c4a484] transition-colors">系統登入</Link>
          <span>·</span>
          <span>© 2026 All Rights Reserved</span>
        </div>

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
                       <span className="font-bold text-[#4a4238] text-sm">欲匯出的模組資料</span>
                       <button onClick={handleSelectAll} className="text-[10px] font-black text-[#c4a484] hover:text-[#4a4238] tracking-widest uppercase">
                          {selectedModules.length === exportOptions.length ? '全部取消' : '全部選取'}
                       </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {exportOptions.map(opt => (
                        <label key={opt.id} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedModules.includes(opt.id) ? 'border-[#4a4238] bg-[#4a4238]/5' : 'border-[#ece4d9] bg-white opacity-60'}`}>
                           <span className={`font-black tracking-widest ${selectedModules.includes(opt.id) ? 'text-[#4a4238]' : 'text-[#4a4238]/40'}`}>{opt.label}</span>
                           <input 
                              type="checkbox" checked={selectedModules.includes(opt.id)}
                              onChange={() => {
                                if (selectedModules.includes(opt.id)) setSelectedModules(selectedModules.filter(id => id !== opt.id));
                                else setSelectedModules([...selectedModules, opt.id]);
                              }}
                              className="w-5 h-5 accent-[#4a4238]"
                           />
                        </label>
                      ))}
                    </div>

                    <button onClick={handleExport} disabled={isExporting || selectedModules.length === 0} className="w-full bg-[#4a4238] text-white py-5 rounded-[20px] font-black tracking-[0.3em] shadow-xl flex items-center justify-center gap-3">
                       {isExporting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <span>🚀 一鍵匯出已選項目</span>}
                    </button>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
