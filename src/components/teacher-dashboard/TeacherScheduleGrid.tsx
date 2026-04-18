import React from 'react';
import { Classroom, Teacher } from '@/lib/types/user';
import TeacherLessonCard from './TeacherLessonCard';

interface TeacherScheduleGridProps {
  viewMode: 'ROOM' | 'WEEK';
  currentDate: string;
  weekRange: { monday: string; sunday: string; all: string[] };
  classrooms: Classroom[];
  teachers: Teacher[];
  lessons: any[];
  timeSlots: string[];
  isLoading: boolean;
}

export default function TeacherScheduleGrid({
  viewMode,
  currentDate,
  weekRange,
  classrooms,
  teachers,
  lessons,
  timeSlots,
  isLoading
}) {
  return (
    <div className="flex-grow bg-white/40 backdrop-blur-md rounded-[40px] border border-[#ece4d9] shadow-inner overflow-hidden flex flex-col">
      <div className="overflow-auto flex-grow custom-scrollbar relative">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-[#f8f7f2]/50 backdrop-blur-sm">
            <div className="w-12 h-12 border-4 border-[#ece4d9] border-t-[#c4a484] rounded-full animate-spin mb-4"></div>
            <p className="font-serif font-bold text-[#4a4238]/60 tracking-widest">載入專屬課表中...</p>
          </div>
        ) : (
          <div className="min-w-[1000px] flex flex-col h-[1800px]">
            {/* Header */}
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

            {/* Grid Body */}
            <div className="flex-grow flex relative">
              {/* Time Column */}
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

              {/* Day/Room Columns */}
              <div className="flex-grow flex relative">
                {/* Horizontal Guide Lines */}
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
                      {lessons.filter(l => l.classroomId === room.id).map(l => <TeacherLessonCard key={l.id} l={l} teachers={teachers} />)}
                    </div>
                  ))
                ) : (
                  weekRange.all.map(d => (
                    <div key={d} className="flex-1 relative border-r border-[#ece4d9]/30 last:border-r-0">
                      {lessons.filter(l => l.date === d).map(l => <TeacherLessonCard key={l.id} l={l} teachers={teachers} />)}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ece4d9; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #c4a484; }
      `}</style>
    </div>
  );
}
