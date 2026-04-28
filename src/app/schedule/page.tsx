"use client";

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import BookingModal from '@/components/schedule/BookingModal';
import { useAuth } from '@/components/providers/AuthProvider';
import { TEACHER_COLORS, getTeacherColor } from '@/lib/constants/colors';
import { useSchedule } from '@/hooks/useSchedule';
import { Lesson } from '@/lib/types/lesson';

export default function SchedulePage() {
  const { hasPermission, profile } = useAuth();
  const canEdit = hasPermission('schedule', 'EDIT');
  const canView = hasPermission('schedule', 'VIEW');

  const schedule = useSchedule(canEdit);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Combobox 搜尋狀態
  const [studentQuery, setStudentQuery] = useState('');

  const handleImportExcelUI = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await schedule.handleImportExcel(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const {
    date, setDate,
    lessons, setLessons,
    viewMode, setViewMode,
    students, teachers, classrooms,
    isLoading,
    isModalOpen, setIsModalOpen,
    isSubmitting,
    selectedRoomIds, toggleRoom, toggleAllRooms,
    selectedTeacherIds, toggleTeacher, toggleAllTeachers,
    editingLessonId, setEditingLessonId,
    draggedLesson,
    formState, setFormState,
    visibleRooms, filteredLessons, hiddenCount, timeSlots,
    shiftDate, getWeekRange, getOverlappingLayout,
    handleDragStart, handleDragEnd, handleDrop,
    openBookingModal, openEditModal,
    handleDeleteLesson, handleBook,
    handleExportExcel
  } = schedule;

  return (
    <main className="flex min-h-screen flex-col items-center pb-24 relative overflow-x-hidden bg-[#f8f7f2]">
      <div className="absolute top-[10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#ece4d9] blur-[150px] opacity-70 -z-10"></div>

      <Navbar pageTitle={profile ? "智能排程管理" : "琴房開放狀態查詢"} />

      {!canView && profile ? (
        <div className="flex-grow flex items-center justify-center p-20">
          <div className="bg-white p-12 rounded-[40px] shadow-2xl border-2 border-red-50/50 text-center">
            <h3 className="text-4xl mb-4">🚫</h3>
            <p className="font-black text-[#4a4238] tracking-[0.2em]">抱歉，您的帳號目前無權限訪問排程模組。</p>
            <p className="text-xs mt-4 opacity-40">請聯繫系統管理員以取得授權。</p>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-7xl px-4 z-10 flex flex-col items-center">
          <div className="elegant-card w-full p-8 md:p-12 min-h-[70vh] flex flex-col relative overflow-visible">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b-2 border-[#ece4d9] pb-6 gap-6 relative z-10">
              <div className="absolute left-0 bottom-0 w-full h-[2px] bg-gradient-to-r from-[#c4a484] to-transparent"></div>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-serif text-3xl md:text-4xl font-extrabold tracking-[0.15em] text-[#4a4238]">
                    {viewMode === 'ROOM' ? '直向矩陣日曆表' : '標準週課表視圖'}
                  </h3>
                  <div className="flex items-center gap-2 ml-2">
                    <button
                      onClick={() => shiftDate(-1)}
                      className="w-10 h-10 rounded-full bg-[#ece4d9] hover:bg-[#c4a484] hover:text-white flex items-center justify-center text-[#4a4238] font-bold transition-all"
                    >◄</button>
                    <input
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="bg-white/80 border-2 border-[#ece4d9] rounded-2xl px-5 py-3 font-black text-lg text-[#c4a484]"
                    />
                    <button
                      onClick={() => shiftDate(1)}
                      className="w-10 h-10 rounded-full bg-[#ece4d9] hover:bg-[#c4a484] hover:text-white flex items-center justify-center text-[#4a4238] font-bold transition-all"
                    >►</button>
                  </div>
                  {hiddenCount > 0 && (
                    <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-200 px-4 py-2 rounded-xl animate-pulse text-rose-600 ml-4">
                      <span className="text-xs font-black tracking-widest">⚠️ 有 {hiddenCount} 筆預約因篩選隱藏</span>
                      <button onClick={() => { toggleAllRooms(); toggleAllTeachers(); }} className="bg-rose-500 text-white text-[10px] px-3 py-1.5 rounded-lg font-bold">全部顯示</button>
                    </div>
                  )}
                </div>

                <div className="flex bg-[#ece4d9]/30 p-1 rounded-full border border-[#ece4d9] w-max shadow-inner">
                  <button onClick={() => setViewMode('ROOM')} className={`px-6 py-2 rounded-full text-sm font-black tracking-widest transition-all ${viewMode === 'ROOM' ? 'bg-[#4a4238] text-white shadow-md' : 'text-[#4a4238] hover:bg-white'}`}>琴房配置</button>
                  <button onClick={() => setViewMode('WEEK')} className={`px-6 py-2 rounded-full text-sm font-black tracking-widest transition-all ${viewMode === 'WEEK' ? 'bg-[#c4a484] text-white shadow-md' : 'text-[#4a4238] hover:bg-white'}`}>週課表</button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {canEdit && (
                  <>
                    <button onClick={handleExportExcel} className="bg-white hover:bg-gray-50 text-[#4a4238] px-6 py-3 border-2 border-[#ece4d9] rounded-full text-sm font-bold tracking-[0.1em] shadow-sm transition-all hover:-translate-y-1">📤 匯出</button>
                    <button onClick={() => fileInputRef.current?.click()} className="bg-white hover:bg-gray-50 text-[#4a4238] px-6 py-3 border-2 border-[#ece4d9] rounded-full text-sm font-bold tracking-[0.1em] shadow-sm transition-all hover:-translate-y-1">📥 匯入</button>
                    <input type="file" ref={fileInputRef} onChange={handleImportExcelUI} hidden accept=".xlsx, .xls" />
                    <button onClick={() => {
                      if (classrooms.length > 0) openBookingModal(0, '10:00', date);
                      else alert("⚠️ 請先建立教室！");
                    }} className="bg-[#4a4238] hover:bg-[#c4a484] text-white px-10 py-4 border border-white rounded-full text-base font-bold tracking-[0.2em] shadow-2xl transition-all duration-300 hover:-translate-y-1 whitespace-nowrap">+ 新增預約</button>
                  </>
                )}
              </div>
            </div>

            {classrooms.length > 0 && (() => {
              const sortedClassrooms = [...classrooms].sort((a, b) => {
                const pKeywords = ['線上', 'Online'];
                const aIsP = pKeywords.some(k => a.name.includes(k));
                const bIsP = pKeywords.some(k => b.name.includes(k));
                if (aIsP && !bIsP) return 1;
                if (!aIsP && bIsP) return -1;
                return 0;
              });
              return (
                <div className="flex flex-col gap-4 mb-6 px-1 z-10">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black tracking-[0.25em] text-[#4a4238]/40 uppercase mr-1">教室</span>
                    <button onClick={toggleAllRooms} className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest border-2 transition-all ${selectedRoomIds.size === classrooms.length ? 'bg-[#4a4238] text-white border-[#4a4238]' : 'bg-white text-[#4a4238]/50 border-[#ece4d9]'}`}>全部</button>
                    {sortedClassrooms.map(room => (
                      <button key={room.id} onClick={() => toggleRoom(room.id!)} className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest border-2 transition-all ${selectedRoomIds.has(room.id!) ? 'bg-[#c4a484] text-white border-[#c4a484]' : 'bg-white text-[#4a4238]/50 border-[#ece4d9]'}`}>{room.name}</button>
                    ))}
                  </div>

                  {teachers.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black tracking-[0.25em] text-[#4a4238]/40 uppercase mr-1">老師</span>
                      <button onClick={toggleAllTeachers} className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest border-2 transition-all ${selectedTeacherIds.size === teachers.length ? 'bg-[#4a4238] text-white border-[#4a4238]' : 'bg-white text-[#4a4238]/50 border-[#ece4d9]'}`}>全部老師</button>
                      {teachers.map(t => {
                        const tColor = getTeacherColor(t.id, teachers);
                        const isSelected = selectedTeacherIds.has(t.id!);
                        return (
                          <button key={t.id} onClick={() => toggleTeacher(t.id!)} className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest border-2 transition-all ${isSelected ? 'text-white' : 'bg-white text-[#4a4238]/50 border-[#ece4d9]'}`} style={{ backgroundColor: isSelected ? tColor.bg : 'white', borderColor: isSelected ? tColor.border : '#ece4d9' }}>{t.name} 老師</button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex-grow w-full overflow-auto max-h-[calc(100vh-280px)] md:max-h-[calc(100vh-200px)] pb-8 z-10 custom-scrollbar rounded-[30px]">
              {isLoading ? (
                <div className="animate-pulse flex flex-col items-center justify-center h-64 text-[#4a4238]/40 font-black tracking-widest text-xl">
                  <div className="w-12 h-12 rounded-full border-4 border-[#ece4d9] border-t-[#c4a484] animate-spin mb-4"></div>
                  運算當日課表中...
                </div>
              ) : classrooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 text-[#4a4238]/50 font-sans tracking-widest bg-white/40 rounded-3xl border-2 border-dashed border-[#ece4d9] shadow-sm w-full mx-auto my-8">
                  <p className="font-extrabold text-lg">💡 請先建立教室，才能開始排課喔！</p>
                </div>
              ) : (
                <div className="min-w-[1000px] border-2 border-[#ece4d9] rounded-[30px] bg-white/70 backdrop-blur-md shadow-sm flex flex-col relative">
                  <div className="flex border-b-2 border-[#ece4d9] bg-[#f8f7f2] sticky top-0 z-[60] shadow-md rounded-t-[28px] isolate">
                    <div className="w-24 shrink-0 border-r-2 border-[#ece4d9] p-5 font-black text-[#4a4238]/50 flex items-center justify-center tracking-[0.2em] text-sm bg-[#f8f7f2] z-[60]">時間</div>
                    {viewMode === 'ROOM' ? (
                      visibleRooms.map(room => (
                        <div key={room.id} className="flex-1 p-5 text-center flex flex-col items-center justify-center border-r-2 border-[#ece4d9]/30 last:border-r-0 bg-[#f8f7f2] z-[60]">
                          <span className="font-black text-xl text-[#4a4238] tracking-widest mb-1">{room.name}</span>
                          <span className="text-xs font-bold text-[#c4a484] tracking-[0.2em]">{room.capacity} 人</span>
                        </div>
                      ))
                    ) : (
                      getWeekRange(date).all.map((d, i) => {
                        const dayNames = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
                        const dayNum = new Date(d).getDay();
                        const isToday = d === new Date().toISOString().split('T')[0];
                        return (
                          <div key={d} className={`flex-1 p-5 text-center flex flex-col items-center justify-center border-r-2 border-[#ece4d9]/30 last:border-r-0 transition-colors z-[60] bg-[#f8f7f2] ${isToday ? 'bg-[#ece4d9]/40' : ''}`}>
                            <span className={`font-black text-xl tracking-widest mb-1 ${isToday ? 'text-[#4a4238]' : 'text-[#4a4238]/60'}`}>{dayNames[dayNum]}</span>
                            <span className={`text-xs font-bold tracking-[0.2em] ${isToday ? 'text-[#c4a484]' : 'text-[#c4a484]/50'}`}>{d.split('-').slice(1).join('/')}</span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="flex relative bg-white/30" style={{ height: '1920px' }}>
                    <div className="w-24 shrink-0 border-r-2 border-[#ece4d9] relative z-20 bg-white/50 shadow-sm">
                      {timeSlots.map(time => {
                        const [h, m] = time.split(':').map(Number);
                        const isHour = m === 0;
                        const relativeHours = (h - 8) + (m / 60);
                        return (
                          <div key={time} className={`absolute w-full text-center tracking-wider pointer-events-none transition-all ${isHour ? 'text-[#4a4238] font-black' : 'text-[#c4a484]/50 font-bold text-xs'}`} style={{ top: `${relativeHours * 120 - (isHour ? 10 : 8)}px` }}>{time}</div>
                        )
                      })}
                    </div>

                    <div className="flex-grow flex relative shadow-inner">
                      <div className="absolute inset-0 z-0 pointer-events-none">
                        {timeSlots.map(time => {
                          const [h, m] = time.split(':').map(Number);
                          const relativeHours = (h - 8) + (m / 60);
                          const isHour = m === 0;
                          return (
                            <div key={time} className={`absolute w-full border-t ${isHour ? 'border-[#ece4d9]/80' : 'border-[#ece4d9]/30 border-dashed'}`} style={{ top: `${relativeHours * 120}px` }}></div>
                          )
                        })}
                      </div>

                      {viewMode === 'ROOM' ? (
                        visibleRooms.map((room) => (
                          <div key={room.id} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, room.id)} className="flex-1 relative z-10 border-r-2 border-[#ece4d9]/30 last:border-r-0 hover:bg-[#4a4238]/5 transition-colors group">
                            {timeSlots.map((time, tIdx) => {
                              if (tIdx === timeSlots.length - 1) return null;
                              const [h, m] = time.split(':').map(Number);
                              const relativeHours = (h - 8) + (m / 60);
                              return (
                                <div key={time} onClick={() => canEdit && openBookingModal(classrooms.indexOf(room), time, date)} className={`absolute w-full h-[60px] transition-all z-10 group/cell ${canEdit ? 'cursor-pointer hover:bg-[#c4a484]/20' : 'cursor-not-allowed'}`} style={{ top: `${relativeHours * 120}px` }}></div>
                              );
                            })}
                            {filteredLessons.filter(l => l.classroomId === room.id).map(lesson => {
                              const startParts = lesson.startTime.split(':');
                              const endParts = lesson.endTime.split(':');
                              const startDecimal = parseInt(startParts[0]) + parseInt(startParts[1]) / 60;
                              const endDecimal = parseInt(endParts[0]) + parseInt(endParts[1]) / 60;
                              const top = (startDecimal - 8) * 120;
                              const height = (endDecimal - startDecimal) * 120;
                              return (
                                <div key={lesson.id} draggable={canEdit} onDragStart={(e) => handleDragStart(e, lesson)} onDragEnd={handleDragEnd} className={`absolute left-1 right-1 rounded-2xl p-3 md:p-4 overflow-hidden hover:scale-[1.02] hover:z-30 hover:shadow-2xl transition-all cursor-grab active:cursor-grabbing flex flex-col z-20 group border-l-4 shadow-lg`} style={{ top: `${top + 3}px`, height: `${height - 6}px`, backgroundColor: lesson.type === 'RENTAL' ? '#c4a484' : getTeacherColor(lesson.teacherId, teachers).bg, borderLeftColor: lesson.type === 'RENTAL' ? '#a0825a' : getTeacherColor(lesson.teacherId, teachers).border }}>
                                  <div className="font-black text-base md:text-lg truncate tracking-wide text-white leading-tight">{lesson.type === 'RENTAL' ? '🏢 ' + lesson.courseName : lesson.studentName}{lesson.type === 'LESSON' && <span className="text-[11px] bg-white/25 px-2 py-0.5 rounded-full ml-1 font-semibold">{lesson.courseName}</span>}</div>
                                  {lesson.type === 'LESSON' && <div className="text-sm text-white/80 font-bold truncate mt-1">{lesson.teacherName} 老師</div>}
                                  <div className="text-xs mt-auto flex justify-between items-end opacity-90 font-black text-white"><span>{lesson.startTime} - {lesson.endTime}</span></div>
                                  {canEdit && (
                                    <div className="absolute top-2 right-2 flex gap-1 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={(e) => { e.stopPropagation(); openEditModal(lesson); }} className="bg-white/90 shadow-sm w-6 h-6 rounded flex items-center justify-center text-[#4a4238] text-xs transition-colors">✎</button>
                                      <button onClick={(e) => handleDeleteLesson(e, lesson.id!)} className="bg-red-400/90 shadow-sm w-6 h-6 rounded flex items-center justify-center text-white text-xs transition-colors">✕</button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))
                      ) : (
                        getWeekRange(date).all.map((d) => {
                          const dayLessons = filteredLessons.filter(l => l.date === d);
                          const layouts = getOverlappingLayout(dayLessons);
                          return (
                            <div key={d} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, undefined, d)} className="flex-1 relative z-10 border-r-2 border-[#ece4d9]/30 last:border-r-0 hover:bg-[#4a4238]/5 transition-colors group">
                              {timeSlots.map((time, tIdx) => {
                                if (tIdx === timeSlots.length - 1) return null;
                                const [h, m] = time.split(':').map(Number);
                                const relativeHours = (h - 8) + (m / 60);
                                return (
                                  <div key={time} onClick={() => canEdit && openBookingModal(0, time, d)} className={`absolute w-full h-[60px] transition-all z-10 ${canEdit ? 'cursor-pointer hover:bg-[#c4a484]/20' : 'cursor-not-allowed'}`} style={{ top: `${relativeHours * 120}px` }}></div>
                                );
                              })}
                              {dayLessons.map(lesson => {
                                const startParts = lesson.startTime.split(':');
                                const endParts = lesson.endTime.split(':');
                                const startDecimal = parseInt(startParts[0]) + parseInt(startParts[1]) / 60;
                                const endDecimal = parseInt(endParts[0]) + parseInt(endParts[1]) / 60;
                                const top = (startDecimal - 8) * 120;
                                const height = (endDecimal - startDecimal) * 120;
                                const layout = (layouts as any).get(lesson.id!);
                                return (
                                  <div key={lesson.id} draggable={canEdit} onDragStart={(e) => handleDragStart(e, lesson)} onDragEnd={handleDragEnd} className={`absolute rounded-xl p-2 md:p-3 overflow-hidden hover:scale-[1.02] hover:z-30 hover:shadow-2xl transition-all cursor-grab active:cursor-grabbing flex flex-col z-20 group border-l-4 shadow-md`} style={{ top: `${top + 2}px`, height: `${height - 4}px`, left: layout?.left || '2px', width: `calc(${layout?.width || '100%'} - 4px)`, backgroundColor: lesson.type === 'RENTAL' ? '#c4a484' : getTeacherColor(lesson.teacherId, teachers).bg, borderLeftColor: lesson.type === 'RENTAL' ? '#a0825a' : getTeacherColor(lesson.teacherId, teachers).border }}>
                                    <div className="font-black text-xs md:text-sm truncate tracking-wide text-white leading-tight flex flex-col"><span>{lesson.type === 'RENTAL' ? '🏢 ' + lesson.courseName : lesson.studentName}</span>{lesson.type === 'LESSON' && <span className="text-[10px] text-white/70 font-bold truncate">{lesson.courseName} / {lesson.teacherName}</span>}</div>
                                    <div className="text-[9px] mt-auto opacity-80 text-white font-mono font-bold">{lesson.startTime}</div>
                                    {canEdit && (
                                      <div className="absolute top-1 right-1 flex flex-col gap-1 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); openEditModal(lesson); }} className="bg-white/90 shadow-sm w-4 h-4 rounded flex items-center justify-center text-[#4a4238] text-[8px] transition-colors">✎</button>
                                        <button onClick={(e) => handleDeleteLesson(e, lesson.id!)} className="bg-red-400/90 shadow-sm w-4 h-4 rounded flex items-center justify-center text-white text-[8px] transition-colors">✕</button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <BookingModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSave={handleBook}
            editingLessonId={editingLessonId}
            initialFormState={formState}
            students={students}
            teachers={teachers}
            classrooms={classrooms}
            timeSlots={timeSlots}
            canEdit={canEdit}
          />
        </div>
      )}
    </main>
  );
}
