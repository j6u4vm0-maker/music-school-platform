import React from 'react';
import { Teacher } from '@/lib/types/user';
import { getTeacherColor } from '@/lib/constants/colors';

interface TeacherLessonCardProps {
  l: any;
  teachers: Teacher[];
}

export default function TeacherLessonCard({ l, teachers }: TeacherLessonCardProps) {
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
            <span className="text-[10px] font-bold text-[#c4a480] tracking-tighter opacity-80">{l.startTime}-{l.endTime}</span>
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
