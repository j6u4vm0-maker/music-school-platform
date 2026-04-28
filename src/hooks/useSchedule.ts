import { useState, useEffect } from 'react';
import { 
  getLessonsByDate, 
  getLessonsByDateRange, 
  addLesson, 
  ScheduleService 
} from '@/lib/services/schedule';
import { Lesson } from '@/lib/types/lesson';
import { getStudents, getTeachers, getClassrooms } from '@/lib/services/db';
import { Student, Teacher, Classroom } from '@/lib/types/user';
import { getPricing } from '@/lib/services/pricing';
import { exportToExcel, importFromExcel } from '@/lib/utils/excel';
import { getDailyClosingStatus, unsettleLessonTransaction } from '@/lib/services/finance';

export const useSchedule = (canEdit: boolean) => {
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

  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [draggedLesson, setDraggedLesson] = useState<Lesson | null>(null);

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
    payoutRate: 0.6,
    recurringType: 'NONE' as 'NONE' | 'WEEK' | 'TWO_WEEKS',
    recurringCount: 4,
    status: 'NORMAL' as 'NORMAL' | 'LEAVE' | 'CANCELLED',
    remark: ''
  });

  // Keep selectedRoomIds/selectedTeacherIds in sync when data loads
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
      if (next.has(id)) { if (next.size > 1) next.delete(id); }
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
    if (l.type === 'RENTAL') return roomMatch;
    const teacherExists = teachers.some(t => t.id === l.teacherId);
    if (!teacherExists) return roomMatch;
    const teacherSelected = l.teacherId && selectedTeacherIds.has(l.teacherId);
    return roomMatch && teacherSelected;
  });

  const hiddenCount = lessons.length - filteredLessons.length;

  const timeSlots: string[] = [];
  for (let i = 8; i <= 24; i++) {
    timeSlots.push(`${i.toString().padStart(2, '0')}:00`);
    if (i < 24) timeSlots.push(`${i.toString().padStart(2, '0')}:30`);
  }

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

  const shiftDate = (direction: 1 | -1) => {
    const d = new Date(date);
    const delta = viewMode === 'WEEK' ? 7 * direction : direction;
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split('T')[0]);
  };

  const getOverlappingLayout = (dayLessons: Lesson[]) => {
    if (dayLessons.length === 0) return [];
    const sorted = [...dayLessons].sort((a, b) => a.startTime.localeCompare(b.startTime) || b.lessonsCount - a.lessonsCount);
    const groups: Lesson[][] = [];

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

  const handleDragStart = (e: React.DragEvent, lesson: Lesson) => {
    if (!canEdit) return;
    setDraggedLesson(lesson);
    e.dataTransfer.setData('text/plain', lesson.id!);
    e.dataTransfer.effectAllowed = 'move';
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
      setIsLoading(true);

      const container = e.currentTarget as HTMLElement;
      const rect = container.getBoundingClientRect();
      const offsetY = Math.max(0, e.clientY - rect.top);

      const slotHeight = 60; // 30 min
      const units = Math.floor(offsetY / slotHeight);
      let startHour = 8 + Math.floor(units / 2);
      let startMin = (units % 2) * 30;

      if (startHour >= 24) { startHour = 23; startMin = 30; }

      const startTime = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`;

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

      await ScheduleService.moveBooking(draggedLesson, targetDate, targetRoomId, startTime, endTime, classrooms);
      await fetchData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "❌ 資料同步失敗，請檢查網路。");
    } finally {
      setIsLoading(false);
    }
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
    try {
      if (!confirm('⚠️ 刪除課程將同步進行以下檢查：\n1. 若已結算，將自動沖銷財務紀錄\n2. 若日期已關帳，將阻止刪除\n\n確定真的要刪除嗎？')) {
        return;
      }
      await ScheduleService.deleteBookingWithChecks(lessonId, lessons);
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || '刪除失敗，請檢查網路狀態');
    }
  };

  const handleBook = async (formData: any) => {
    setIsSubmitting(true);
    try {
      if (editingLessonId) {
        const oldLesson = lessons.find(l => l.id === editingLessonId);
        if (oldLesson?.isSettled) {
          if (!confirm('⚠️ 此課已產生帳務細節，修改將自動啟動以下機制：\n1. 沖銷原本的財務紀錄\n2. 歸還學生扣款堂數\n\n確定要修改嗎？')) {
            setIsSubmitting(false);
            return;
          }
        }
        await ScheduleService.updateBooking(editingLessonId, oldLesson as any, formData, students, teachers, classrooms);
      } else {
        await ScheduleService.createBooking(formData, students, teachers, classrooms);
      }
      setIsModalOpen(false);
      await fetchData();
    } catch (error: any) {
      console.error("Booking error:", error);
      alert('🚫 儲存失敗：' + (error.message || '請確認網路連線或檢查欄位是否填寫正確。'));
    } finally {
      setIsSubmitting(false);
    }
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

  const handleImportExcel = async (file: File) => {
    setIsLoading(true);
    try {
      const data = await importFromExcel(file);
      for (const row of data) {
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
  };

  return {
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
    handleExportExcel, handleImportExcel
  };
};
