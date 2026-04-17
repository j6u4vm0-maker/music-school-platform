"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/components/providers/AuthProvider';
import { getClassrooms, getTeachers, Classroom, Teacher } from '@/lib/services/db';
import { getTeacherScheduleView } from '@/lib/services/schedule';
import { getTeacherColor } from '@/lib/constants/colors';

// ── 子組件：渲染單個課表色塊 ──────────────────────────────────────────────
function LessonCard({ l, teachers }: { l: any, teachers: Teacher[] }) {
  const startH = parseInt(l.startTime.split(':')[0]);
  const startM = parseInt(l.startTime.split(':')[1]);
  const endH = parseInt(l.endTime.split(':')[0]);
  const endM = parseInt(l.endTime.split(':')[1]);
  
  const top = ((startH - 8) + startM/60) * 120;
  const height = ((endH - startH) + (endM - startM)/60) * 120;
  
  const tColor = getTeacherColor(l.teacherId, teachers);
  const isOthers = l.isOthers;

  return (
    <div 
      className={`absolute left-1 right-1 p-3 rounded-2xl border-l-[6px] shadow-lg flex flex-col justify-center transition-all group overflow-hidden force-gpu
        ${isOthers 
          ? 'bg-white/40 backdrop-blur-md border-gray-300 opacity-60 grayscale-[0.5]' 
          : 'bg-white'}`}
      style={{ 
        top: `${top + 4}px`, 
        height: `${height - 8}px`,
        borderLeftColor: isOthers ? '#CBD5E1' : tColor.bg,
        boxShadow: isOthers ? 'none' : `0 10px 25px -5px ${tColor.bg}30`
      }}
    >
      {isOthers ? (
        <div className="flex flex-col items-center justify-center gap-1.5 opacity-60">
          <span className="text-[10px] font-black text-gray-500 tracking-[0.2em] uppercase">Occupied</span>
          <span className="text-xs font-serif font-black text-gray-400">教室使用中</span>
          <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{l.startTime} - {l.endTime}</span>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-start mb-1.5">
            <span className="text-xs font-black text-[#4a4238] tracking-widest bg-[#f8f7f2] px-2 py-0.5 rounded-lg border border-[#ece4d9]">{l.courseName}</span>
            <span className="text-[10px] font-bold text-[#c4a484] tracking-tighter opacity-80">{l.startTime}-{l.endTime}</span>
          </div>
          <h4 className="font-serif text-lg font-black text-[#4a4238] tracking-widest truncate mb-0.5">{l.studentName} 同學</h4>
          <div className="flex items-center gap-2">
             <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tColor.bg }}></span>
             <span className="text-[10px] font-bold text-[#4a4238]/40 truncate">{l.classroomName}</span>
          </div>
          {l.remark && (
            <div className="mt-2 text-[9px] font-bold text-[#4a4238]/30 italic truncate border-t border-[#ece4d9]/50 pt-1">
              📌 {l.remark}
            </div>
          )}
        </>
      )}
      {!isOthers && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
      )}
    </div>
  );
}

// ── 子組件：老師專屬日程表內容 ──────────────────────────────────────────────
function TeacherScheduleContent() {
  const { profile, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  // 狀態管理
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'ROOM' | 'WEEK'>('WEEK'); 
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);

  const getWeekRange = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const days = [];
    for (let i = 0; i < 7; i++) {
        const next = new Date(monday);
        next.setDate(monday.getDate() + i);
        days.push(next.toISOString().split('T')[0]);
    }
    return { monday: days[0], sunday: days[6], all: days };
  };

  const weekRange = useMemo(() => getWeekRange(currentDate), [currentDate]);

  useEffect(() => {
    const fetchBaseData = async () => {
        const [cData, tData] = await Promise.all([getClassrooms(), getTeachers()]);
        setClassrooms(cData);
        setTeachers(tData);
    };
    fetchBaseData();
  }, []);

  useEffect(() => {
    if (!profile?.teacherId) {
        setIsLoading(false);
        return;
    }

    const fetchSchedule = async () => {
        setIsLoading(true);
        const start = viewMode === 'ROOM' ? currentDate : weekRange.monday;
        const end = viewMode === 'ROOM' ? currentDate : weekRange.sunday;
        
        try {
            const data = await getTeacherScheduleView(start, end, profile.teacherId!);
            setLessons(data);
        } catch (err) {
            console.error("Fetch schedule error:", err);
        }
        setIsLoading(false);
    };

    fetchSchedule();
  }, [currentDate, viewMode, weekRange, profile?.teacherId]);

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 8; h <= 22; h++) {
        slots.push(`${h.toString().padStart(2, '0')}:00`);
        if (h < 22) slots.push(`${h.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }, []);

  const { hasPermission } = useAuth();
  const canView = hasPermission('portal', 'VIEW');

  if (authLoading) return null;

  if (!canView) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f2]">
          <div className="text-center p-12 bg-white rounded-[40px] shadow-xl border-2 border-[#ece4d9]">
              <h1 className="text-4xl mb-4">🚫</h1>
              <h2 className="font-serif text-2xl font-black text-[#4a4238] tracking-widest">權限不足</h2>
              <p className="text-[#4a4238]/60 mt-4 font-bold">此頁面僅供授權老師或系統管理員使用。</p>
          </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f7f2] flex flex-col p-6 space-y-6 overflow-hidden">
      <Navbar pageTitle="老師個人專屬排程">
        <div className="flex flex-wrap items-center gap-4 scale-90 md:scale-100 origin-right transition-all">
           <div className="flex bg-[#ece4d9]/50 p-1.5 rounded-2xl border border-[#ece4d9] shadow-inner">
              <button 
                onClick={() => setViewMode('WEEK')}
                className={`px-4 py-1.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${viewMode === 'WEEK' ? 'bg-white text-[#4a4238] shadow-sm' : 'text-[#4a4238]/40 hover:text-[#4a4238]'}`}
              >
                WEEK
              </button>
              <button 
                onClick={() => setViewMode('ROOM')}
                className={`px-4 py-1.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${viewMode === 'ROOM' ? 'bg-white text-[#4a4238] shadow-sm' : 'text-[#4a4238]/40 hover:text-[#4a4238]'}`}
              >
                ROOM
              </button>
           </div>

           <div className="flex items-center gap-2">
              <button onClick={() => {
                const d = new Date(currentDate);
                d.setDate(d.getDate() - (viewMode === 'WEEK' ? 7 : 1));
                setCurrentDate(d.toISOString().split('T')[0]);
              }} className="w-10 h-10 flex items-center justify-center bg-white border border-[#ece4d9] rounded-xl text-[#4a4238] hover:bg-[#ece4d9] transition-all shadow-sm">←</button>
              
              <div className="px-4 py-2 bg-white border border-[#ece4d9] rounded-xl font-mono font-black text-[#4a4238] tracking-widest text-xs min-w-[140px] text-center shadow-inner">
                {viewMode === 'WEEK' ? `${weekRange.monday.substring(5)} ~ ${weekRange.sunday.substring(5)}` : currentDate}
              </div>

              <button onClick={() => {
                const d = new Date(currentDate);
                d.setDate(d.getDate() + (viewMode === 'WEEK' ? 7 : 1));
                setCurrentDate(d.toISOString().split('T')[0]);
              }} className="w-10 h-10 flex items-center justify-center bg-white border border-[#ece4d9] rounded-xl text-[#4a4238] hover:bg-[#ece4d9] transition-all shadow-sm">→</button>

              <button onClick={() => setCurrentDate(new Date().toISOString().split('T')[0])} className="px-4 py-2.5 bg-[#4a4238] text-white rounded-xl text-[10px] font-black tracking-widest hover:bg-[#c4a480] transition-all shadow-md">TODAY</button>
           </div>
        </div>
      </Navbar>

      {!profile?.teacherId && (
        <div className="flex-grow flex items-center justify-center">
            <div className="bg-orange-50 border-2 border-orange-200 p-8 rounded-3xl text-center max-w-md">
                <span className="text-4xl mb-4 block">⚠️</span>
                <p className="text-orange-800 font-bold tracking-widest leading-relaxed">
                    您的帳號尚未關聯至老師資料。<br/>
                    請聯繫系統管理員，在「資料庫 - 帳號管理」中將您的帳號與具體的教師名稱進行綁定。
                </p>
            </div>
        </div>
      )}

      <div className="flex-grow bg-white/40 backdrop-blur-md rounded-[40px] border border-[#ece4d9] shadow-inner overflow-hidden flex flex-col">
        <div className="overflow-auto flex-grow custom-scrollbar relative">
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-[#f8f7f2]/50 backdrop-blur-sm">
                <div className="w-12 h-12 border-4 border-[#ece4d9] border-t-[#c4a484] rounded-full animate-spin mb-4"></div>
                <p className="font-serif font-bold text-[#4a4238]/60 tracking-widest">載入專屬課表中...</p>
            </div>
          ) : (
            <div className="min-w-[1000px] flex flex-col h-[1800px]">
              <div className="flex border-b border-[#ece4d9] bg-[#f8f7f2] sticky top-0 z-40 isolate shadow-sm">
                <div className="w-24 shrink-0 border-r border-[#ece4d9] p-5 font-black text-[#4a4238]/40 text-center text-xs tracking-widest bg-[#f8f7f2]">
                  時間
                </div>
                {viewMode === 'ROOM' ? (
                  classrooms.map(room => (
                    <div key={room.id} className="flex-1 p-5 text-center border-r border-[#ece4d9]/30 last:border-r-0 bg-[#f8f7f2]">
                      <span className="font-black text-lg text-[#4a4238] tracking-widest">{room.name}</span>
                    </div>
                  ))
                ) : (
                  weekRange.all.map(d => {
                    const isToday = d === new Date().toISOString().split('T')[0];
                    const dayName = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][new Date(d).getDay()];
                    return (
                      <div key={d} className={`flex-1 p-5 text-center border-r border-[#ece4d9]/30 last:border-r-0 bg-[#f8f7f2] transition-colors ${isToday ? 'bg-[#ece4d9]/40 border-b-2 border-b-[#c4a484]' : ''}`}>
                         <span className={`block font-black text-lg tracking-widest ${isToday ? 'text-[#4a4238]' : 'text-[#4a4238]/60'}`}>{dayName}</span>
                         <span className={`text-[10px] font-bold tracking-widest ${isToday ? 'text-[#c4a484]' : 'text-[#c4a484]/40'}`}>{d.split('-').slice(1).join('/')}</span>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex-grow flex relative">
                <div className="w-24 shrink-0 border-r border-[#ece4d9] bg-white/50 relative">
                  {timeSlots.map(time => {
                    const [h, m] = time.split(':').map(Number);
                    const isHour = m === 0;
                    const top = ((h - 8) + m / 60) * 120;
                    return (
                      <div key={time} className={`absolute w-full text-center transition-opacity ${isHour ? 'text-[#4a4238] font-black text-sm' : 'text-[#c4a484]/40 text-[10px] font-bold'}`} style={{ top: `${top - (isHour ? 10 : 8)}px` }}>
                        {time}
                      </div>
                    );
                  })}
                </div>

                <div className="flex-grow flex relative">
                  <div className="absolute inset-0 pointer-events-none">
                    {timeSlots.map(time => {
                        const [h, m] = time.split(':').map(Number);
                        const isHour = m === 0;
                        const top = ((h - 8) + m / 60) * 120;
                        return (
                          <div key={time} className={`absolute w-full border-t ${isHour ? 'border-[#ece4d9]/80' : 'border-[#ece4d9]/30 border-dashed'}`} style={{ top: `${top}px` }}></div>
                        );
                    })}
                  </div>

                  {viewMode === 'ROOM' ? (
                    classrooms.map(room => (
                      <div key={room.id} className="flex-1 relative border-r border-[#ece4d9]/30 last:border-r-0">
                         {lessons.filter(l => l.classroomId === room.id).map(l => <LessonCard key={l.id} l={l} teachers={teachers} />)}
                      </div>
                    ))
                  ) : (
                    weekRange.all.map(d => (
                      <div key={d} className="flex-1 relative border-r border-[#ece4d9]/30 last:border-r-0">
                        {lessons.filter(l => l.date === d).map(l => <LessonCard key={l.id} l={l} teachers={teachers} />)}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ece4d9; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #c4a484; }
      `}</style>
    </main>
  );
}

export default function TeacherPortalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f8f7f2] font-serif font-black text-[#4a4238] tracking-widest uppercase animate-pulse">載入老師系統介面中 Loading Teacher Portal...</div>}>
      <TeacherScheduleContent />
    </Suspense>
  );
}
