"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/components/providers/AuthProvider';
import { getClassrooms, getTeachers } from '@/lib/services/db';
import { getTeacherScheduleView } from '@/lib/services/schedule';
import { Classroom, Teacher } from '@/lib/types/user';
import TeacherScheduleGrid from '@/components/teacher-dashboard/TeacherScheduleGrid';

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
    <main className="min-h-screen bg-[#f8f7f2] flex flex-col p-6 space-y-6 overflow-hidden animate-fade-in">
      <Navbar pageTitle="老師個人專屬排程">
        <div className="flex flex-wrap items-center gap-4 scale-90 md:scale-100 origin-right transition-all animate-slide-right">
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

      <TeacherScheduleGrid
        viewMode={viewMode}
        currentDate={currentDate}
        weekRange={weekRange}
        classrooms={classrooms}
        teachers={teachers}
        lessons={lessons}
        timeSlots={timeSlots}
        isLoading={isLoading}
      />
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
