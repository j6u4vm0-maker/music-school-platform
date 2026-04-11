"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getLessonsByDate, getLessonsByDateRange, addLesson, checkConflict, updateLessonStatus, deleteLesson, Lesson } from '@/lib/services/schedule';
import { getStudents, getTeachers, getClassrooms, Student, Teacher, Classroom } from '@/lib/services/db';
import { getDailyClosingStatus, unsettleLessonTransaction, settleLessonTransaction } from '@/lib/services/finance';
import { getPricing } from '@/lib/services/pricing';
import { exportToExcel, importFromExcel } from '@/lib/utils/excel';
import { useAuth } from '@/components/providers/AuthProvider';
import { logout } from '@/lib/services/auth';
import { useRouter } from 'next/navigation';
import { Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption } from '@headlessui/react';

import { TEACHER_COLORS, getTeacherColor } from '@/lib/constants/colors';

export default function SchedulePage() {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [viewMode, setViewMode] = useState<'ROOM' | 'WEEK'>('ROOM');

  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { hasPermission, profile } = useAuth();
  const router = useRouter();

  const canEdit = hasPermission('schedule', 'EDIT');
  const canView = hasPermission('schedule', 'VIEW');

  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  // Combobox 搜尋狀態
  const [studentQuery, setStudentQuery] = useState('');
  const [draggedLesson, setDraggedLesson] = useState<Lesson | null>(null);

  const handleDragStart = (e: React.DragEvent, lesson: Lesson) => {
    if (!canEdit) return;
    setDraggedLesson(lesson);
    e.dataTransfer.setData('text/plain', lesson.id!);
    e.dataTransfer.effectAllowed = 'move';
    // 設置一個半透明的預覽圖
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '0.4';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
    setDraggedLesson(null);
  };

  const handleDrop = async (e: React.DragEvent, targetRoomId?: string, targetDate?: string) => {
    e.preventDefault();
    if (!canEdit || !draggedLesson) return;

    try {
      const isSourceLocked = await getDailyClosingStatus(draggedLesson.date);
      if (isSourceLocked) {
        alert("🚫 原始日期已入帳鎖定，無法被移動。");
        return;
      }
      const newDate = targetDate || draggedLesson.date;
      const isTargetLocked = await getDailyClosingStatus(newDate);
      if (isTargetLocked) {
        alert("🚫 目標日期已入帳鎖定，移入失敗。");
        return;
      }

      const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const offsetY = Math.max(0, e.clientY - rect.top);

    // 計算落點時間 (每 30 分鐘為 60px, 每小時 120px)
    // 精度對齊至 30 分鐘 (吸附功能)
    const slotHeight = 60; // 30 min
    const units = Math.floor(offsetY / slotHeight);
    let startHour = 8 + Math.floor(units / 2);
    let startMin = (units % 2) * 30;

    // 邊界檢查
    if (startHour >= 24) { startHour = 23; startMin = 30; }

    const startTime = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`;

    // 計算結束時間 (保持原本時長)
    const [origStartH, origStartM] = draggedLesson.startTime.split(':').map(Number);
    const [origEndH, origEndM] = draggedLesson.endTime.split(':').map(Number);
    const durationMin = (origEndH * 60 + origEndM) - (origStartH * 60 + origStartM);

    const startTotalMin = startHour * 60 + startMin;
    const endTotalMin = startTotalMin + durationMin;
    const endHour = Math.floor(endTotalMin / 60);
    const endMin = endTotalMin % 60;
    const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;

    if (endHour > 24 || (endHour === 24 && endMin > 0)) {
      alert(`⚠️ 課程時長 (${durationMin} min) 超出了營業時間 (24:00)！`);
      return;
    }

    const newRoomId = targetRoomId || draggedLesson.classroomId;
    const newDate = targetDate || draggedLesson.date;

    // 取得新的教室名稱
    const newRoom = classrooms.find(c => c.id === newRoomId);

    // 防撞檢核 (與資料庫連動)
    const conflict = await checkConflict(
      newDate,
      startTime,
      endTime,
      newRoomId,
      draggedLesson.teacherId,
      draggedLesson.studentId,
      draggedLesson.type,
      draggedLesson.id
    );

    if (conflict) {
      alert(`🚫 無法移動：${conflict}`);
      return;
    }

    try {
      setIsLoading(true);
      await updateLessonStatus(draggedLesson.id!, {
        date: newDate,
        startTime,
        endTime,
        classroomId: newRoomId,
        classroomName: newRoom?.name || draggedLesson.classroomName
      });
      await fetchData();
    } catch (err) {
      console.error(err);
      alert("❌ 資料同步失敗，請檢查網路。");
    } finally {
      setIsLoading(false);
    }
  };

  // 控制表單狀態
  const [formState, setFormState] = useState({
    type: 'LESSON' as 'LESSON' | 'RENTAL',
    studentIdx: 0,
    teacherIdx: 0,
    classroomIdx: 0,
    bookingDate: date,
    startTime: '10:00',
    endTime: '11:00',
    courseName: '鋼琴',
    lessonsCount: 1,
    payoutLessonsCount: 1,
    unitPrice: 800,
    teacherPayout: 480,
    payoutRate: 0.6, // 快取抽成比例以便動態計算
    recurringType: 'NONE' as 'NONE' | 'WEEK' | 'TWO_WEEKS',
    recurringCount: 4,
    status: 'NORMAL' as 'NORMAL' | 'LEAVE' | 'CANCELLED',
    remark: ''
  });

  // Keep selectedRoomIds/selectedTeacherIds in sync when data loads
  // Fix: Automatically add new items encountered in the data to the selected set
  useEffect(() => {
    if (classrooms.length > 0) {
      setSelectedRoomIds(prev => {
        const next = new Set(prev);
        let changed = false;
        classrooms.forEach(r => {
          if (!prev.has(r.id!)) {
            next.add(r.id!);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [classrooms]);

  useEffect(() => {
    if (teachers.length > 0) {
      setSelectedTeacherIds(prev => {
        const next = new Set(prev);
        let changed = false;
        teachers.forEach(t => {
          if (!prev.has(t.id!)) {
            next.add(t.id!);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [teachers]);

  const toggleRoom = (id: string) => {
    setSelectedRoomIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); } // keep at least 1
      else next.add(id);
      return next;
    });
  };

  const toggleAllRooms = () => {
    if (selectedRoomIds.size === classrooms.length)
      setSelectedRoomIds(new Set([classrooms[0]?.id!]));
    else
      setSelectedRoomIds(new Set(classrooms.map(r => r.id!)));
  };

  const toggleTeacher = (id: string) => {
    setSelectedTeacherIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); }
      else next.add(id);
      return next;
    });
  };

  const toggleAllTeachers = () => {
    if (selectedTeacherIds.size === teachers.length)
      setSelectedTeacherIds(new Set([teachers[0]?.id!]));
    else
      setSelectedTeacherIds(new Set(teachers.map(t => t.id!)));
  };

  const visibleRooms = classrooms
    .filter(r => selectedRoomIds.has(r.id!))
    .sort((a, b) => {
      const pKeywords = ['線上', 'Online'];
      const aIsP = pKeywords.some(k => a.name.includes(k));
      const bIsP = pKeywords.some(k => b.name.includes(k));
      if (aIsP && !bIsP) return 1;
      if (!aIsP && bIsP) return -1;
      return 0;
    });

  const filteredLessons = lessons.filter(l => {
    const roomMatch = selectedRoomIds.has(l.classroomId);

    // 如果是租借，不檢查老師篩選
    if (l.type === 'RENTAL') return roomMatch;

    // 老師篩選邏輯優化：
    // 1. 如果該老師根本不在目前的老師列表中 (可能還在載入中或被刪除)，我們預設顯示，避免資料「暫時消失」
    const teacherExists = teachers.some(t => t.id === l.teacherId);
    if (!teacherExists) return roomMatch;

    // 2. 如果老師存在，則檢查是否有被使用者勾選
    const teacherSelected = l.teacherId && selectedTeacherIds.has(l.teacherId);
    return roomMatch && teacherSelected;
  });

  const hiddenCount = lessons.length - filteredLessons.length;

  const timeSlots: string[] = [];
  for (let i = 8; i <= 24; i++) {
    timeSlots.push(`${i.toString().padStart(2, '0')}:00`);
    if (i < 24) timeSlots.push(`${i.toString().padStart(2, '0')}:30`);
  }

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (viewMode === 'ROOM') {
        setLessons(await getLessonsByDate(date));
      } else {
        const { start, end } = getWeekRange(date);
        setLessons(await getLessonsByDateRange(start, end));
      }

      if (students.length === 0) {
        setStudents(await getStudents());
        setTeachers(await getTeachers());
        setClassrooms(await getClassrooms());
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [date, viewMode]);

  // 工具：取得該日期所在的週一到週日
  const getWeekRange = (d: string) => {
    const current = new Date(d);
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(current.setDate(diff));
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const next = new Date(monday);
      next.setDate(monday.getDate() + i);
      dates.push(next.toISOString().split('T')[0]);
    }
    return { start: dates[0], end: dates[6], all: dates };
  };

  // 日期切換：日視圖按天，週視圖按週
  const shiftDate = (direction: 1 | -1) => {
    const d = new Date(date);
    const delta = viewMode === 'WEEK' ? 7 * direction : direction;
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split('T')[0]);
  };

  // 工具：處理週視圖重疊事件排版
  const getOverlappingLayout = (dayLessons: Lesson[]) => {
    if (dayLessons.length === 0) return [];

    // 按開始時間、堂數排序
    const sorted = [...dayLessons].sort((a, b) => a.startTime.localeCompare(b.startTime) || b.lessonsCount - a.lessonsCount);
    const groups: Lesson[][] = [];

    // 分組：只要有重疊就歸為一組
    sorted.forEach(lesson => {
      let placed = false;
      for (const group of groups) {
        const isOverlapping = group.some(gl => (lesson.startTime < gl.endTime && lesson.endTime > gl.startTime));
        if (isOverlapping) {
          group.push(lesson);
          placed = true;
          break;
        }
      }
      if (!placed) groups.push([lesson]);
    });

    const layouts = new Map<string, { width: string, left: string }>();

    groups.forEach(group => {
      // 算出組內最大並行數
      const columns: Lesson[][] = [];
      group.forEach(lesson => {
        let colIdx = 0;
        while (columns[colIdx] && columns[colIdx].some(cl => (lesson.startTime < cl.endTime && lesson.endTime > cl.startTime))) {
          colIdx++;
        }
        if (!columns[colIdx]) columns[colIdx] = [];
        columns[colIdx].push(lesson);
      });

      const totalCols = columns.length;
      columns.forEach((col, colIdx) => {
        col.forEach(lesson => {
          layouts.set(lesson.id!, {
            width: `${100 / totalCols}%`,
            left: `${(colIdx * 100) / totalCols}%`
          });
        });
      });
    });

    return layouts;
  };

  const openBookingModal = async (roomIdx: number, timeString: string, targetDate?: string) => {
    if (classrooms.length === 0) {
      alert("⚠️ 請先至資料庫建立至少一間教室！");
      return;
    }

    const sIdx = timeSlots.indexOf(timeString);
    let eIdx = sIdx + 2;
    let lCount = 1;
    if (eIdx >= timeSlots.length) { eIdx = timeSlots.length - 1; lCount = 0.5; }

    const defaultTeacher = teachers[0];
    const defaultInstrument = '鋼琴';
    let initialPrice = 800;
    let initialPayout = 480;
    let initialPayoutRate = 0.6;

    if (defaultTeacher) {
      const pricing = await getPricing(defaultTeacher.id!, defaultInstrument);
      initialPayoutRate = pricing?.payoutRate ?? 0.6;
      if (pricing && pricing.tiers.length > 0) {
        initialPrice = pricing.tiers[0].rate;
        initialPayout = Math.round(initialPrice * initialPayoutRate);
      } else {
        initialPrice = defaultTeacher.hourlyRate;
        initialPayout = Math.round(defaultTeacher.hourlyRate * initialPayoutRate);
      }
    }

    setEditingLessonId(null);
    setFormState({
      type: 'LESSON',
      studentIdx: 0,
      teacherIdx: 0,
      classroomIdx: roomIdx,
      bookingDate: targetDate || date,
      startTime: timeString,
      endTime: timeSlots[eIdx],
      courseName: defaultInstrument,
      lessonsCount: lCount,
      payoutLessonsCount: lCount,
      unitPrice: initialPrice,
      teacherPayout: initialPayout,
      payoutRate: initialPayoutRate,
      recurringType: 'NONE',
      recurringCount: 4,
      status: 'NORMAL',
      remark: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (lesson: Lesson) => {
    setEditingLessonId(lesson.id!);
    const cIdx = classrooms.findIndex(c => c.id === lesson.classroomId);
    const sIdx = students.findIndex(s => s.id === lesson.studentId);
    const tIdx = teachers.findIndex(t => t.id === lesson.teacherId);

    setFormState({
      type: lesson.type,
      studentIdx: sIdx >= 0 ? sIdx : 0,
      teacherIdx: tIdx >= 0 ? tIdx : 0,
      classroomIdx: cIdx >= 0 ? cIdx : 0,
      bookingDate: lesson.date,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      courseName: lesson.courseName,
      lessonsCount: lesson.lessonsCount || 1,
      payoutLessonsCount: lesson.payoutLessonsCount || lesson.lessonsCount || 1,
      unitPrice: lesson.unitPrice || 0,
      teacherPayout: lesson.teacherPayout || 0,
      payoutRate: (lesson.teacherPayout && lesson.unitPrice) ? lesson.teacherPayout / (lesson.unitPrice * (lesson.payoutLessonsCount || 1)) : 0.6,
      recurringType: 'NONE',
      recurringCount: 1,
      status: lesson.status || 'NORMAL',
      remark: lesson.remark || ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteLesson = async (e: React.MouseEvent, lessonId: string) => {
    e.stopPropagation();
    const oldLesson = lessons.find(l => l.id === lessonId);
    if (!oldLesson) return;
    
    try {
      const isLocked = await getDailyClosingStatus(oldLesson.date);
      if (isLocked) {
        alert("🚫 該日期已入帳鎖定，無法刪除預約！");
        return;
      }

      if (oldLesson.isSettled) {
        if (!confirm('⚠️ 此課已產生帳務細節，刪除將會同時沖銷相關的財務紀錄與學生堂數餘額。\n\n確定真的要刪除嗎？')) {
          return;
        }
        await unsettleLessonTransaction(oldLesson);
      }

      await deleteLesson(lessonId);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('刪除或沖銷失敗，請檢查權限或網路狀態');
    }
  };

  const handleFormChange = async (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;

    // 預先產生下一個狀態的副本，方便同步處理所有欄位變更
    let nextState = { ...formState, [name]: (name === 'lessonsCount' || name === 'payoutLessonsCount' || name === 'unitPrice') ? parseFloat(value) : (name === 'studentIdx' || name === 'teacherIdx' || name === 'classroomIdx') ? parseInt(value) : value };

    // 1. 自動連動邏輯 (時間與堂數)
    if (name === 'startTime' || name === 'endTime') {
      const sIdx = timeSlots.indexOf(nextState.startTime);
      if (name === 'startTime') {
        if (sIdx !== -1 && sIdx + 2 < timeSlots.length) {
          nextState.endTime = timeSlots[sIdx + 2];
        } else if (sIdx + 1 < timeSlots.length) {
          nextState.endTime = timeSlots[sIdx + 1];
        }
      }

      const [h1, m1] = nextState.startTime.split(':').map(Number);
      const [h2, m2] = nextState.endTime.split(':').map(Number);
      const diffMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diffMinutes > 0) {
        const hours = diffMinutes / 60;
        nextState.lessonsCount = hours;
        nextState.payoutLessonsCount = hours;
      }
    }

    // 2. 自動連動邏輯 (課程類型切換)
    if (name === 'type' && value === 'RENTAL') {
      nextState.courseName = '教室租借';
      nextState.teacherPayout = 0;
      nextState.unitPrice = 200;
    } else if (name === 'type' && value === 'LESSON' && formState.type === 'RENTAL') {
      nextState.courseName = '鋼琴';
    }

    // 3. 自動連動邏輯 (學生切換) - 帶入預設配置
    if (name === 'studentIdx') {
      const student = students[nextState.studentIdx as number];
      if (student && student.enrollments && student.enrollments.length > 0) {
        const en = student.enrollments[0];
        nextState.courseName = en.instrument;
        const foundTIdx = teachers.findIndex(t => t.id === en.teacherId);
        if (foundTIdx !== -1) {
          nextState.teacherIdx = foundTIdx;
          nextState.payoutRate = en.payoutRate || 0.6;
        }
      }
    }

    // 更新基礎狀態，維持介面反應速度
    setFormState(nextState);

    // 4. 非同步定價與教練抽成更新
    if (nextState.type === 'LESSON' && (
      name === 'studentIdx' ||
      name === 'teacherIdx' ||
      name === 'courseName' ||
      name === 'lessonsCount' ||
      name === 'payoutLessonsCount' ||
      name === 'unitPrice' ||
      name === 'startTime' ||
      name === 'endTime' ||
      name === 'type'
    )) {
      const teacher = teachers[nextState.teacherIdx as number];
      if (teacher) {
        let pRate = nextState.payoutRate;
        let finalUnitPrice = typeof nextState.unitPrice === 'string' ? parseFloat(nextState.unitPrice as string) : (nextState.unitPrice as number);

        // 如果改變了影響計價基礎的欄位，需要重新從資料庫取得定價 (若非手動修改單價)
        if (name !== 'unitPrice' && name !== 'lessonsCount' && name !== 'payoutLessonsCount') {
          const pricing = await getPricing(teacher.id!, nextState.courseName);
          if (pricing) {
            pRate = pricing.payoutRate ?? pRate;
            finalUnitPrice = pricing.tiers?.[0]?.rate || teacher.hourlyRate;
          } else {
            // 回退到老師預設時薪
            finalUnitPrice = teacher.hourlyRate;
          }

          // 如果是切換學生，需確保抽成比例優先採用學生 enrollments 裡的自訂比例
          if (name === 'studentIdx') {
            const student = students[nextState.studentIdx as number];
            if (student && student.enrollments && student.enrollments.length > 0) {
              const en = student.enrollments[0];
              if (en.payoutRate) pRate = en.payoutRate;
            }
          }
        }

        const calculatedPayout = Math.round(finalUnitPrice * (nextState.payoutLessonsCount as number) * pRate);

        setFormState(prev => ({
          ...prev,
          unitPrice: finalUnitPrice,
          payoutRate: pRate,
          teacherPayout: calculatedPayout
        }));
      }
    }
  };

  const handleBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { type, studentIdx, teacherIdx, classroomIdx, bookingDate, startTime, endTime, courseName, lessonsCount, payoutLessonsCount, unitPrice, teacherPayout, recurringType, recurringCount, status, remark } = formState;

    if (startTime >= endTime) {
      alert("結束時間必須晚於開始時間！");
      setIsSubmitting(false);
      return;
    }

    const student = type === 'LESSON' ? students[studentIdx as any] : null;
    const teacher = type === 'LESSON' ? teachers[teacherIdx as any] : null;
    const classroom = classrooms[classroomIdx as any];

    // 週期性預約日期準備
    const datesToBook = [bookingDate];
    if (recurringType !== 'NONE' && !editingLessonId) {
      const interval = recurringType === 'WEEK' ? 7 : 14;
      for (let i = 1; i < (recurringCount || 1); i++) {
        const d = new Date(bookingDate);
        d.setDate(d.getDate() + (i * interval));
        datesToBook.push(d.toISOString().split('T')[0]);
      }
    }

    // 衝突驗證
    for (const d of datesToBook) {
      const conflict = await checkConflict(d, startTime, endTime, classroom.id!, teacher?.id, student?.id, type, editingLessonId || undefined);
      if (conflict) {
        alert(`${d} 衝突警報：\n${conflict}\n\n週期預約中斷，請調整後再試。`);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      if (editingLessonId) {
        const oldLesson = lessons.find(l => l.id === editingLessonId);
        
        // 檢查目標日期或原始日期是否被鎖定
        const originLocked = oldLesson ? await getDailyClosingStatus(oldLesson.date) : false;
        const targetLocked = await getDailyClosingStatus(bookingDate);
        if (originLocked || targetLocked) {
           alert("🚫 該日期已入帳鎖定，無法修改預約！");
           setIsSubmitting(false);
           return;
        }

        if (oldLesson?.isSettled) {
          if (!confirm('⚠️ 此課已產生帳務細節，修改將自動啟動以下機制：\n1. 沖銷原本的財務紀錄\n2. 歸還學生扣款堂數\n\n如果新的狀態仍正常上課，系統會再自動重新結算。\n\n確定要修改嗎？')) {
            setIsSubmitting(false);
            return;
          }
          await unsettleLessonTransaction(oldLesson);
        }

        const payload = {
          type,
          studentId: student?.id || '',
          studentName: student?.name || '',
          teacherId: teacher?.id || '',
          teacherName: teacher?.name || '',
          classroomId: classroom.id!,
          classroomName: classroom.name,
          date: bookingDate,
          startTime, endTime, courseName,
          lessonsCount: Number(lessonsCount),
          payoutLessonsCount: Number(payoutLessonsCount),
          unitPrice: Number(unitPrice),
          teacherPayout: Number(teacherPayout),
          status: status as 'NORMAL' | 'LEAVE' | 'CANCELLED',
          remark: String(remark)
        };
        await updateLessonStatus(editingLessonId, payload);

        // 如果修改前是已結算，且修改後仍是正常課程，則自動重新結算
        if (oldLesson?.isSettled) {
          if (payload.status === 'NORMAL' && payload.type === 'LESSON') {
             await settleLessonTransaction({ id: editingLessonId, ...payload } as Lesson);
          } else {
             await updateLessonStatus(editingLessonId, { isSigned: false, isSettled: false });
          }
        }
      } else {
        // 批次新增 (檢查所有目標日期是否被鎖定)
        for (const d of datesToBook) {
           if (await getDailyClosingStatus(d)) {
              alert(`🚫 日期 ${d} 已入帳鎖定，無法新增預約至該日期！`);
              setIsSubmitting(false);
              return;
           }
        }
        for (const d of datesToBook) {
          const payload: any = {
            type,
            studentId: student?.id || '',
            studentName: student?.name || '',
            teacherId: teacher?.id || '',
            teacherName: teacher?.name || '',
            classroomId: classroom.id!,
            classroomName: classroom.name,
            date: d,
            startTime, endTime, courseName,
            lessonsCount: Number(lessonsCount),
            payoutLessonsCount: Number(payoutLessonsCount),
            unitPrice: Number(unitPrice),
            teacherPayout: Number(teacherPayout),
            status: status as 'NORMAL' | 'LEAVE' | 'CANCELLED',
            remark: String(remark),
            paymentMethod: 'UNPAID',
            accountSuffix: '',
            isPaid: false,
            isSigned: false
          };
          await addLesson(payload as Lesson);
        }
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      alert('儲存寫入失敗，請確認網路連線。');
    }
    setIsSubmitting(false);
  };

  const handleExportExcel = () => {
    const exportData = lessons.map(l => ({
      '日期': l.date,
      '開始時間': l.startTime,
      '結束時間': l.endTime,
      '類型': l.type === 'LESSON' ? '課程' : '租借',
      '學生姓名': l.studentName,
      '老師姓名': l.teacherName,
      '教室': l.classroomName,
      '項目名稱': l.courseName,
      '堂數(學員)': l.lessonsCount,
      '堂數(教師)': l.payoutLessonsCount || l.lessonsCount,
      '學員單價': l.unitPrice,
      '教師鐘點': l.teacherPayout,
      '備註': l.remark
    }));
    exportToExcel(exportData, `排程匯出_${date}`);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const data = await importFromExcel(file);
      for (const row of data) {
        // Find matching IDs if possible, or use names
        const student = students.find(s => s.name === row['學生姓名']);
        const teacher = teachers.find(t => t.name === row['老師姓名']);
        const classroom = classrooms.find(c => c.name === row['教室']) || classrooms[0];

        await addLesson({
          date: row['日期'] || date,
          startTime: row['開始時間'] || '10:00',
          endTime: row['結束時間'] || '11:00',
          type: row['類型'] === '租借' ? 'RENTAL' : 'LESSON',
          studentId: student?.id || '',
          studentName: row['學生姓名'] || '',
          teacherId: teacher?.id || '',
          teacherName: row['老師姓名'] || '',
          classroomId: classroom.id!,
          classroomName: classroom.name,
          courseName: row['項目名稱'] || '鋼琴',
          lessonsCount: Number(row['堂數']) || 1,
          unitPrice: 0,
          teacherPayout: 0,
          paymentMethod: 'UNPAID',
          accountSuffix: '',
          isPaid: false,
          isSigned: false,
          remark: row['備註'] || ''
        });
      }
      fetchData();
      alert(`成功匯入 ${data.length} 筆排程資料`);
    } catch (err) {
      alert('Excel 載入失敗，格式不符。');
    }
    setIsLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  return (
    <main className="flex min-h-screen flex-col items-center pb-24 relative overflow-x-hidden bg-[#f8f7f2]">
      <div className="absolute top-[10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#ece4d9] blur-[150px] opacity-70 -z-10"></div>

      <div className="w-full max-w-7xl px-4 pt-6 z-40 mb-12">
        <nav className="glass-nav px-8 py-5 flex justify-between items-center shadow-sm">
          <div className="flex gap-8 items-center">
            <Link href="/" className="flex items-center gap-4 cursor-pointer hover:-translate-y-1 transition-transform">
              <div className="w-12 h-12 rounded-full border-2 border-[#4a4238] flex items-center justify-center font-serif text-xl font-bold text-[#4a4238]">7th</div>
              <h1 className="font-serif font-black text-xl tracking-[0.2em] text-[#4a4238]">
                {profile ? '返回控制台' : '第七樂章'}
              </h1>
            </Link>
            {profile ? (
              <button onClick={async () => { await logout(); router.push('/login'); }} className="text-[10px] font-black tracking-widest text-[#4a4238]/40 hover:text-red-400 transition-colors uppercase">
                [ Secure Logout ⎋ ]
              </button>
            ) : (
              <Link href="/login" className="text-[10px] font-black tracking-widest text-[#c4a484] hover:text-[#4a4238] transition-colors uppercase">
                [ 管理員登入 → ]
              </Link>
            )}
          </div>
          <h2 className="font-serif font-black text-2xl md:text-3xl tracking-[0.15em] text-[#c4a484] drop-shadow-sm">
            {profile ? '智能排程管理' : '琴房開放狀態查詢'}
          </h2>
        </nav>
      </div>

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
                  {/* 日期切換導航 */}
                  <div className="flex items-center gap-2 ml-2">
                    <button
                      onClick={() => shiftDate(-1)}
                      className="w-10 h-10 rounded-full bg-[#ece4d9] hover:bg-[#c4a484] hover:text-white flex items-center justify-center text-[#4a4238] font-bold transition-all hover:scale-110 active:scale-95 shadow-sm"
                      title={viewMode === 'WEEK' ? '上一週' : '前一天'}
                    >
                      ◄
                    </button>
                    <input
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="bg-white/80 backdrop-blur-sm border-2 border-[#ece4d9] rounded-2xl px-5 py-3 font-black text-lg tracking-widest text-[#c4a484] focus:outline-none focus:border-[#4a4238] transition-all shadow-inner"
                    />
                    <button
                      onClick={() => shiftDate(1)}
                      className="w-10 h-10 rounded-full bg-[#ece4d9] hover:bg-[#c4a484] hover:text-white flex items-center justify-center text-[#4a4238] font-bold transition-all hover:scale-110 active:scale-95 shadow-sm"
                      title={viewMode === 'WEEK' ? '下一週' : '下一天'}
                    >
                      ►
                    </button>
                  </div>
                  {hiddenCount > 0 && (
                    <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-200 px-4 py-2 rounded-xl animate-pulse text-rose-600 ml-4">
                      <span className="text-xs font-black tracking-widest">⚠️ 有 {hiddenCount} 筆預約因篩選隱藏</span>
                      <button
                        onClick={() => { toggleAllRooms(); toggleAllTeachers(); }}
                        className="bg-rose-500 text-white text-[10px] px-3 py-1.5 rounded-lg font-bold hover:bg-rose-600 transition-all shadow-sm"
                      >
                        全部顯示
                      </button>
                    </div>
                  )}
                </div>

                {/* View Switcher Tabs */}
                <div className="flex bg-[#ece4d9]/30 p-1 rounded-full border border-[#ece4d9] w-max shadow-inner">
                  <button
                    onClick={() => setViewMode('ROOM')}
                    className={`px-6 py-2 rounded-full text-sm font-black tracking-widest transition-all ${viewMode === 'ROOM' ? 'bg-[#4a4238] text-white shadow-md' : 'text-[#4a4238] hover:bg-white'}`}>
                    琴房配置
                  </button>
                  <button
                    onClick={() => setViewMode('WEEK')}
                    className={`px-6 py-2 rounded-full text-sm font-black tracking-widest transition-all ${viewMode === 'WEEK' ? 'bg-[#c4a484] text-white shadow-md' : 'text-[#4a4238] hover:bg-white border hover:border-[#c4a484]/30'}`}>
                    週課表
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {canEdit && (
                  <>
                    <button onClick={handleExportExcel} className="bg-white hover:bg-gray-50 text-[#4a4238] px-6 py-3 border-2 border-[#ece4d9] rounded-full text-sm font-bold tracking-[0.1em] shadow-sm transition-all hover:-translate-y-1">
                      📤 匯出
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="bg-white hover:bg-gray-50 text-[#4a4238] px-6 py-3 border-2 border-[#ece4d9] rounded-full text-sm font-bold tracking-[0.1em] shadow-sm transition-all hover:-translate-y-1">
                      📥 匯入
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImportExcel} hidden accept=".xlsx, .xls" />

                    <button onClick={() => {
                      if (classrooms.length > 0) openBookingModal(0, '10:00', date);
                      else alert("⚠️ 請先建立教室！");
                    }} className="bg-[#4a4238] hover:bg-[#c4a484] text-white px-10 py-4 border border-white rounded-full text-base font-bold tracking-[0.2em] shadow-2xl hover:shadow-[0_20px_40px_rgba(196,164,132,0.4)] transition-all duration-300 hover:-translate-y-1 whitespace-nowrap">
                      + 新增預約
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ── Filter Bar: 教室多選 + 老師篩選 ── */}
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
                  {/* Classroom chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black tracking-[0.25em] text-[#4a4238]/40 uppercase mr-1">教室</span>
                    <button
                      onClick={toggleAllRooms}
                      className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest border-2 transition-all ${selectedRoomIds.size === classrooms.length
                          ? 'bg-[#4a4238] text-white border-[#4a4238]'
                          : 'bg-white text-[#4a4238]/50 border-[#ece4d9] hover:border-[#4a4238]'
                        }`}
                    >
                      全部
                    </button>
                    {sortedClassrooms.map(room => (
                      <button
                        key={room.id}
                        onClick={() => toggleRoom(room.id!)}
                        className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest border-2 transition-all ${selectedRoomIds.has(room.id!)
                            ? 'bg-[#c4a484] text-white border-[#c4a484] shadow-sm'
                            : 'bg-white text-[#4a4238]/50 border-[#ece4d9] hover:border-[#c4a484]'
                          }`}
                      >
                        {room.name}
                      </button>
                    ))}
                  </div>

                  {/* Teacher filter chips */}
                  {teachers.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black tracking-[0.25em] text-[#4a4238]/40 uppercase mr-1">老師</span>
                      <button
                        onClick={toggleAllTeachers}
                        className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest border-2 transition-all ${selectedTeacherIds.size === teachers.length
                            ? 'bg-[#4a4238] text-white border-[#4a4238]'
                            : 'bg-white text-[#4a4238]/50 border-[#ece4d9] hover:border-[#4a4238]'
                          }`}
                      >
                        全部老師
                      </button>
                      {teachers.map(t => {
                        const tColor = getTeacherColor(t.id, teachers);
                        const isSelected = selectedTeacherIds.has(t.id!);
                        return (
                          <button
                            key={t.id}
                            onClick={() => toggleTeacher(t.id!)}
                            className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest border-2 transition-all ${isSelected
                                ? 'text-white shadow-md'
                                : 'bg-white text-[#4a4238]/50 border-[#ece4d9]'
                              }`}
                            style={{ 
                              backgroundColor: isSelected ? tColor.bg : 'white',
                              borderColor: isSelected ? tColor.border : '#ece4d9',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.borderColor = tColor.border;
                                e.currentTarget.style.color = tColor.bg;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.borderColor = '#ece4d9';
                                e.currentTarget.style.color = '#4a423866';
                              }
                            }}
                          >
                            {t.name} 老師
                          </button>
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
                    <div className="w-24 shrink-0 border-r-2 border-[#ece4d9] p-5 font-black text-[#4a4238]/50 flex items-center justify-center tracking-[0.2em] text-sm bg-[#f8f7f2] z-[60]">
                      時間
                    </div>
                    {viewMode === 'ROOM' ? (
                      visibleRooms.map(room => (
                        <div key={room.id} className="flex-1 p-5 text-center flex flex-col items-center justify-center border-r-2 border-[#ece4d9]/30 last:border-r-0 bg-[#f8f7f2] hover:bg-[#ece4d9]/50 transition-colors z-[60]">
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
                          <div key={d} className={`flex-1 p-5 text-center flex flex-col items-center justify-center border-r-2 border-[#ece4d9]/30 last:border-r-0 transition-colors z-[60] bg-[#f8f7f2] ${isToday ? 'bg-[#ece4d9]/40' : 'hover:bg-[#ece4d9]/20'}`}>
                            <span className={`font-black text-xl tracking-widest mb-1 ${isToday ? 'text-[#4a4238]' : 'text-[#4a4238]/60'}`}>
                              {dayNames[dayNum]}
                            </span>
                            <span className={`text-xs font-bold tracking-[0.2em] ${isToday ? 'text-[#c4a484]' : 'text-[#c4a484]/50'}`}>
                              {d.split('-').slice(1).join('/')}
                            </span>
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
                          <div key={time}
                            className={`absolute w-full text-center tracking-wider pointer-events-none transition-all ${isHour ? 'text-[#4a4238] font-black' : 'text-[#c4a484]/50 font-bold text-xs'}`}
                            style={{ top: `${relativeHours * 120 - (isHour ? 10 : 8)}px` }}>
                            {time}
                          </div>
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
                            <div key={time}
                              className={`absolute w-full border-t ${isHour ? 'border-[#ece4d9]/80' : 'border-[#ece4d9]/30 border-dashed'}`}
                              style={{ top: `${relativeHours * 120}px` }}>
                            </div>
                          )
                        })}
                      </div>

                      {viewMode === 'ROOM' ? (
                        visibleRooms.map((room) => (
                          <div
                            key={room.id}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, room.id)}
                            className="flex-1 relative z-10 border-r-2 border-[#ece4d9]/30 last:border-r-0 hover:bg-[#4a4238]/5 transition-colors group"
                          >
                            {timeSlots.map((time, tIdx) => {
                              if (tIdx === timeSlots.length - 1) return null;
                              const [h, m] = time.split(':').map(Number);
                              const relativeHours = (h - 8) + (m / 60);
                              return (
                                <div key={time}
                                  onClick={() => canEdit && openBookingModal(classrooms.indexOf(room), time, date)}
                                  className={`absolute w-full h-[60px] transition-all z-10 group/cell ${canEdit ? 'cursor-pointer hover:bg-[#c4a484]/20' : 'cursor-not-allowed'}`}
                                  style={{ top: `${relativeHours * 120}px` }}
                                ></div>
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
                                <div key={lesson.id}
                                  draggable={canEdit}
                                  onDragStart={(e) => handleDragStart(e, lesson)}
                                  onDragEnd={handleDragEnd}
                                  className={`absolute left-1 right-1 rounded-2xl p-3 md:p-4 overflow-hidden hover:scale-[1.02] hover:z-30 hover:shadow-2xl transition-all cursor-grab active:cursor-grabbing flex flex-col z-20 group border-l-4 shadow-lg force-gpu`}
                                  style={{
                                    top: `${top + 3}px`,
                                    height: `${height - 6}px`,
                                    backgroundColor: lesson.type === 'RENTAL' ? '#c4a484' : getTeacherColor(lesson.teacherId, teachers).bg,
                                    borderLeftColor: lesson.type === 'RENTAL' ? '#a0825a' : getTeacherColor(lesson.teacherId, teachers).border,
                                  }}
                                >
                                  <div className="font-black text-base md:text-lg truncate tracking-wide text-white leading-tight">
                                    {lesson.type === 'RENTAL' ? '🏢 ' + lesson.courseName : lesson.studentName}
                                    {lesson.type === 'LESSON' && <span className="text-[11px] bg-white/25 px-2 py-0.5 rounded-full ml-1 font-semibold">{lesson.courseName}</span>}
                                  </div>
                                  {lesson.type === 'LESSON' && <div className="text-sm text-white/80 font-bold truncate mt-1">{lesson.teacherName} 老師</div>}
                                  <div className="text-xs mt-auto flex justify-between items-end opacity-90 font-black text-white">
                                    <span>{lesson.startTime} - {lesson.endTime}</span>
                                  </div>

                                  <div className="absolute inset-0 bg-[#2a2018]/90 p-4 flex flex-col justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-40 border-2 border-white/20 rounded-2xl backdrop-blur-sm shadow-2xl force-gpu">
                                    <div className="text-[10px] font-black tracking-[0.2em] text-[#c4a484] mb-2 uppercase">預約詳情 DETAILS</div>
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-white/40 text-[9px] font-bold w-12">對象:</span>
                                        <span className="text-white font-black text-sm">{lesson.type === 'RENTAL' ? lesson.courseName : lesson.studentName}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-white/40 text-[9px] font-bold w-12">教室:</span>
                                        <span className="text-[#c4a484] font-black text-sm">{lesson.classroomName}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-white/40 text-[9px] font-bold w-12">時段:</span>
                                        <span className="text-white font-mono text-xs">{lesson.startTime} - {lesson.endTime}</span>
                                      </div>
                                      {lesson.type === 'LESSON' && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-white/40 text-[9px] font-bold w-12">老師:</span>
                                          <span className="text-white font-black text-sm">{lesson.teacherName} 老師</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {canEdit && (
                                    <div className="absolute top-2 right-2 flex gap-1 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={(e) => { e.stopPropagation(); openEditModal(lesson); }} className="bg-white/90 shadow-sm w-6 h-6 rounded flex items-center justify-center hover:bg-white text-[#4a4238] text-xs transition-colors" title="編輯這筆預約">
                                        ✎
                                      </button>
                                      <button onClick={(e) => handleDeleteLesson(e, lesson.id!)} className="bg-red-400/90 shadow-sm w-6 h-6 rounded flex items-center justify-center hover:bg-red-500 text-white text-xs transition-colors" title="刪除這筆預約">
                                        ✕
                                      </button>
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
                            <div
                              key={d}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => handleDrop(e, undefined, d)}
                              className="flex-1 relative z-10 border-r-2 border-[#ece4d9]/30 last:border-r-0 hover:bg-[#4a4238]/5 transition-colors group"
                            >
                              {timeSlots.map((time, tIdx) => {
                                if (tIdx === timeSlots.length - 1) return null;
                                const [h, m] = time.split(':').map(Number);
                                const relativeHours = (h - 8) + (m / 60);
                                return (
                                  <div key={time}
                                    onClick={() => canEdit && openBookingModal(0, time, d)}
                                    className={`absolute w-full h-[60px] transition-all z-10 ${canEdit ? 'cursor-pointer hover:bg-[#c4a484]/20' : 'cursor-not-allowed'}`}
                                    style={{ top: `${relativeHours * 120}px` }}
                                  ></div>
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
                                const color = getTeacherColor(lesson.teacherId, teachers);

                                return (
                                  <div key={lesson.id}
                                    draggable={canEdit}
                                    onDragStart={(e) => handleDragStart(e, lesson)}
                                    onDragEnd={handleDragEnd}
                                    className={`absolute rounded-xl p-2 md:p-3 overflow-hidden hover:scale-[1.02] hover:z-30 hover:shadow-2xl transition-all cursor-grab active:cursor-grabbing flex flex-col z-20 group border-l-4 shadow-md force-gpu`}
                                    style={{
                                      top: `${top + 2}px`,
                                      height: `${height - 4}px`,
                                      left: layout?.left || '2px',
                                      width: `calc(${layout?.width || '100%'} - 4px)`,
                                      backgroundColor: lesson.type === 'RENTAL' ? '#c4a484' : color.bg,
                                      borderLeftColor: lesson.type === 'RENTAL' ? '#a0825a' : color.border,
                                    }}
                                  >
                                    <div className="font-black text-xs md:text-sm truncate tracking-wide text-white leading-tight flex flex-col">
                                      <span>{lesson.type === 'RENTAL' ? '🏢 ' + lesson.courseName : lesson.studentName}</span>
                                      {lesson.type === 'LESSON' && <span className="text-[10px] text-white/70 font-bold truncate">{lesson.courseName} / {lesson.teacherName}</span>}
                                    </div>
                                    <div className="text-[9px] mt-auto opacity-80 text-white font-mono font-bold">
                                      {lesson.startTime}
                                    </div>

                                    <div className="absolute inset-0 p-2 flex flex-col justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-40 border border-white/20 rounded-xl backdrop-blur-md shadow-xl force-gpu"
                                      style={{ backgroundColor: `${color.bg}f2` }}
                                    >
                                      <div className="text-[7px] font-black tracking-widest text-[#c4a484] mb-1 uppercase">課程詳情</div>
                                      <div className="space-y-1">
                                        <div className="text-white font-black text-[10px] leading-tight truncate">{lesson.type === 'RENTAL' ? lesson.courseName : lesson.studentName}</div>
                                        <div className="text-[#c4a484] font-bold text-[8px] truncate">{lesson.classroomName}</div>
                                        <div className="text-white/60 font-mono text-[7px]">{lesson.startTime} - {lesson.endTime}</div>
                                        {lesson.type === 'LESSON' && <div className="text-white/80 font-bold text-[8px] truncate">{lesson.teacherName} 老師</div>}
                                      </div>
                                    </div>

                                    {canEdit && (
                                      <div className="absolute top-1 right-1 flex flex-col gap-1 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); openEditModal(lesson); }} className="bg-white/90 shadow-sm w-4 h-4 rounded flex items-center justify-center hover:bg-white text-[#4a4238] text-[8px] transition-colors">
                                          ✎
                                        </button>
                                        <button onClick={(e) => handleDeleteLesson(e, lesson.id!)} className="bg-red-400/90 shadow-sm w-4 h-4 rounded flex items-center justify-center hover:bg-red-500 text-white text-[8px] transition-colors">
                                          ✕
                                        </button>
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

          {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#4a4238]/60 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-[#f8f7f2] w-full max-w-2xl rounded-[40px] shadow-2xl p-10 relative border-2 border-white max-h-[90vh] overflow-y-auto custom-scrollbar">
                <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center rounded-full bg-[#ece4d9]/50 text-[#4a4238] hover:bg-[#c4a484] hover:text-white transition-colors">✕</button>

                <h3 className="font-serif text-3xl font-black tracking-[0.2em] text-[#4a4238] mb-6 border-b-2 border-[#ece4d9] pb-6 uppercase">
                  {editingLessonId ? '編輯預約資訊 ✎' : '新增預約資訊 +'}
                </h3>

                <div className="flex gap-4 mb-8 bg-[#ece4d9]/50 p-2 rounded-2xl w-fit">
                  <button
                    type="button"
                    onClick={() => setFormState(prev => ({ ...prev, type: 'LESSON', courseName: '鋼琴', unitPrice: 800, teacherPayout: 480 }))}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold tracking-widest transition-all ${formState.type === 'LESSON' ? 'bg-[#4a4238] text-white shadow-lg' : 'text-[#4a4238] hover:bg-white/50'}`}>
                    🎹 音樂課程
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormState(prev => ({ ...prev, type: 'RENTAL', courseName: '教室租借', unitPrice: 200, teacherPayout: 0 }))}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold tracking-widest transition-all ${formState.type === 'RENTAL' ? 'bg-[#c4a484] text-white shadow-lg' : 'text-[#4a4238] hover:bg-white/50'}`}>
                    🏢 教室租借
                  </button>
                </div>

                <form onSubmit={handleBook} className="flex flex-col gap-5">
                  {formState.type === 'LESSON' && (
                    <div className="flex flex-col gap-5 bg-white border-2 border-[#ece4d9] rounded-3xl p-6 shadow-sm">
                      <div className="grid grid-cols-2 gap-4">

                        {/* Combobox */}
                        <div className="relative">
                          <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2">預約學員</label>
                          <Combobox
                            value={students[formState.studentIdx as any] || null}
                            onChange={(selectedStudent: Student | null) => {
                              if (!selectedStudent) return;
                              const idx = students.findIndex(s => s.id === selectedStudent.id);
                              handleFormChange({ target: { name: 'studentIdx', value: String(idx) } } as any);
                            }}>
                            <div className="relative z-[100]">
                              <ComboboxInput
                                className="w-full bg-[#f8f7f2] border-none outline-none rounded-xl px-4 py-3 font-bold text-[#4a4238] placeholder:text-[#4a4238]/40 focus:ring-2 focus:ring-[#c4a484]/50 transition-shadow"
                                displayValue={(s: Student | null) => s ? `${s.name} (餘額: $${s.balance?.toLocaleString() || 0}, 剩餘: ${s.remainingLessons || 0} 堂)` : ''}
                                onChange={(event) => setStudentQuery(event.target.value)}
                                placeholder="輸入姓名或電話搜尋..."
                              />
                              <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-4">
                                <span className="text-[#c4a484] opacity-80 text-xs font-black">▼</span>
                              </ComboboxButton>
                              <ComboboxOptions
                                className="absolute mt-2 min-w-full w-max max-w-[300px] max-h-60 overflow-auto rounded-xl bg-white py-2 shadow-2xl ring-2 ring-[#ece4d9] focus:outline-none custom-scrollbar"
                                style={{ zIndex: 1000 }}
                              >
                                {(() => {
                                  const filtered = studentQuery === ''
                                    ? students
                                    : students.filter((s) => s.name.toLowerCase().includes(studentQuery.toLowerCase()) || (s.phone && s.phone.includes(studentQuery)));

                                  if (filtered.length === 0 && studentQuery !== '') {
                                    return (
                                      <div className="relative cursor-default select-none py-3 px-4 text-sm text-[#4a4238]/60 font-bold">
                                        查無符合條件的學員
                                      </div>
                                    );
                                  }

                                  return filtered.map((s) => (
                                    <ComboboxOption
                                      key={s.id}
                                      className="group relative cursor-pointer select-none py-3 px-4 transition-colors data-[focus]:bg-[#ece4d9]/40 data-[focus]:text-[#4a4238]"
                                      value={s}
                                    >
                                      <span className="block truncate font-bold group-data-[selected]:font-black text-[#4a4238]/80 group-data-[focus]:text-[#4a4238] group-data-[selected]:text-[#4a4238]">
                                        {s.name}
                                      </span>
                                      <span className="block truncate text-[10px] text-[#c4a484] font-mono mt-0.5">
                                        餘額: ${s.balance?.toLocaleString() || 0} / 剩餘: {s.remainingLessons || 0} 堂
                                      </span>
                                    </ComboboxOption>
                                  ));
                                })()}
                              </ComboboxOptions>
                            </div>
                          </Combobox>
                        </div>

                        {/* Enrollments Quick Select */}
                        {students[formState.studentIdx as any]?.enrollments && (students[formState.studentIdx as any].enrollments?.length ?? 0) > 0 && (
                          <div>
                            <label className="block text-[11px] font-black tracking-[0.2em] text-[#c4a484] mb-2 uppercase">快速帶入學員學習方案</label>
                            <select
                              value=""
                              onChange={async (e) => {
                                if (!e.target.value) return;
                                const idx = parseInt(e.target.value);
                                const en = students[formState.studentIdx as any].enrollments?.[idx];
                                if (en) {
                                  let nextState = { ...formState, courseName: en.instrument };
                                  const tIdx = teachers.findIndex(t => t.id === en.teacherId);
                                  if (tIdx !== -1) {
                                    nextState.teacherIdx = tIdx;
                                    nextState.payoutRate = en.payoutRate || 0.6;

                                    // 重新計算價費
                                    const teacher = teachers[tIdx];
                                    const pricing = await getPricing(teacher.id!, en.instrument);

                                    let finalUnitPrice = pricing?.tiers?.[0]?.rate || teacher.hourlyRate;
                                    let pRate = en.payoutRate || pricing?.payoutRate || 0.6;

                                    nextState.unitPrice = finalUnitPrice;
                                    nextState.payoutRate = pRate;
                                    nextState.teacherPayout = Math.round(finalUnitPrice * nextState.payoutLessonsCount * pRate);
                                  }

                                  setFormState(nextState);
                                }
                              }}
                              className="w-full bg-emerald-50 text-emerald-800 border-none rounded-xl px-4 py-3 font-bold text-sm cursor-pointer hover:bg-emerald-100 transition-colors"
                            >
                              <option value="">請選擇方案與師資</option>
                              {students[formState.studentIdx as any].enrollments?.map((en, i) => (
                                <option key={i} value={i}>{en.instrument} ({en.teacherName})</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2">指導老師</label>
                          <select required name="teacherIdx" value={formState.teacherIdx} onChange={handleFormChange} className="w-full bg-[#f8f7f2] border-none rounded-xl px-4 py-3 font-bold">
                            {teachers.map((t, i) => <option key={t.id} value={i}>{t.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2">課程項目</label>
                          <input required name="courseName" value={formState.courseName} onChange={handleFormChange} className="w-full bg-[#f8f7f2] border-none rounded-xl px-4 py-3 font-bold text-sm" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2">預約時間 (起)</label>
                      <select required name="startTime" value={formState.startTime} onChange={handleFormChange} className="w-full bg-white border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-bold">
                        {timeSlots.map((t, idx) => idx !== timeSlots.length - 1 && <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2">預約時間 (迄)</label>
                      <select required name="endTime" value={formState.endTime} onChange={handleFormChange} className="w-full bg-white border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-bold">
                        {timeSlots.map((t, idx) => idx !== 0 && <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2 uppercase">預約日期</label>
                      <input type="date" required name="bookingDate" value={formState.bookingDate} onChange={handleFormChange} className="w-full bg-white border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-bold text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2 uppercase">安排教室</label>
                      <select required name="classroomIdx" value={formState.classroomIdx} onChange={handleFormChange} className="w-full bg-white border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-bold">
                        {classrooms.map((c, i) => <option key={c.id} value={i}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="border-t-2 border-dashed border-[#ece4d9] pt-5 mt-2">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2 uppercase">學員扣除堂數</label>
                        <input type="number" step="0.5" required name="lessonsCount" value={formState.lessonsCount} onChange={handleFormChange} className="w-full bg-white border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-bold text-sm" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black tracking-[0.2em] text-red-500 mb-2 uppercase">老師計薪堂數</label>
                        <input type="number" step="0.5" required name="payoutLessonsCount" value={formState.payoutLessonsCount} onChange={handleFormChange} className="w-full bg-white border-2 border-red-100 rounded-xl px-4 py-3 font-bold text-sm text-red-600" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2 uppercase">{formState.type === 'RENTAL' ? '租借單價' : '課程單價'} ($)</label>
                        <input type="number" required name="unitPrice" readOnly={!canEdit} value={formState.unitPrice} onChange={handleFormChange} className={`w-full bg-white border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-mono font-black text-sm text-[#c4a484] ${!canEdit ? 'opacity-50' : ''}`} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-black tracking-[0.2em] text-red-500 mb-2 uppercase">老師薪資發放 (鐘點) ($)</label>
                        <input type="number" name="teacherPayout" disabled={formState.type === 'RENTAL' || !canEdit} readOnly={!canEdit} value={formState.teacherPayout} onChange={handleFormChange} className={`w-full bg-gray-50 border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-mono font-black text-sm text-red-500 disabled:opacity-30 ${!canEdit ? 'opacity-50' : ''}`} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2 uppercase">課程狀態</label>
                        <select name="status" value={formState.status} onChange={handleFormChange} className="w-full bg-white border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-bold text-sm">
                          <option value="NORMAL">✅ 正常上課</option>
                          <option value="LEAVE">🔔 學生請假</option>
                          <option value="CANCELLED">❌ 課程取消</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2">備註</label>
                        <input name="remark" value={formState.remark} onChange={handleFormChange} className="w-full bg-white border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-bold text-sm" placeholder="特殊備註或注意事項..." />
                      </div>
                    </div>
                  </div>

                  {!editingLessonId && (
                    <div className="bg-[#4a4238]/5 p-5 rounded-3xl border-2 border-dashed border-[#4a4238]/10">
                      <label className="block text-xs font-black tracking-widest text-[#4a4238] mb-4 uppercase">↻ 自動週期預約 (批次建立)</label>
                      <div className="grid grid-cols-2 gap-4">
                        <select name="recurringType" value={formState.recurringType} onChange={handleFormChange} className="bg-white border-none rounded-xl px-4 py-3 font-bold text-sm">
                          <option value="NONE">不重複 (單次)</option>
                          <option value="WEEK">每週固定</option>
                          <option value="TWO_WEEKS">每兩週固定</option>
                        </select>
                        {formState.recurringType !== 'NONE' && (
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-[#4a4238] shrink-0">共計</span>
                            <input type="number" name="recurringCount" value={formState.recurringCount} onChange={handleFormChange} className="w-20 bg-white border-none rounded-xl px-4 py-3 font-bold text-sm text-center" />
                            <span className="text-sm font-bold text-[#4a4238] shrink-0">次</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {canEdit && (
                    <button type="submit" disabled={isSubmitting} className={`mt-4 font-bold tracking-[0.3em] py-5 px-6 rounded-full shadow-xl transition-all text-white flex items-center justify-center gap-2 ${formState.type === 'RENTAL' ? 'bg-[#c4a484] hover:bg-[#b09070]' : 'bg-[#4a4238] hover:bg-[#363028]'}`}>
                      {isSubmitting ? '系統處理中...' : (editingLessonId ? '儲存並更新變更' : '確認並建立預約紀錄')}
                    </button>
                  )}
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
