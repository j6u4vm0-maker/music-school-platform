import { where } from "firebase/firestore";
import { checkTeacherHoliday } from "./holidays";
import { Lesson } from "../types/lesson";
export type { Lesson };
import * as lessonRepo from "../repositories/lessonRepository";

// Redundant type removed

// lessonCollection reference moved to repository

// 檢查是否撞堂 (防撞堂核心演算法升級)
export const checkConflict = async (
  date: string, 
  startTime: string, 
  endTime: string, 
  classroomId: string,
  teacherId?: string, 
  studentId?: string,
  type: 'LESSON' | 'RENTAL' = 'LESSON',
  excludeLessonId?: string
): Promise<string | null> => {
  const lessons = await lessonRepo.fetchLessonsByQuery([where("date", "==", date)]);

  // 1. 先檢查老師是否在該時段有特休 (只針對課程)
  if (type === 'LESSON' && teacherId) {
    // 為了取得 teacherName，我們嘗試從傳入的 teacherId 找出它在 lessons 中的 name，如果沒有就傳 '該'
    const conflictHoliday = await checkTeacherHoliday(date, startTime, endTime, teacherId, "該");
    if (conflictHoliday) return conflictHoliday;
  }

  // 2. 檢查是否與現有排程重疊

  for (const lesson of lessons) {
    if (excludeLessonId && lesson.id === excludeLessonId) continue;
    const isOverlapping = (startTime < lesson.endTime && endTime > lesson.startTime);
    if (isOverlapping) {
      // 不論什麼類型，同一間教室一定不能重疊
      if (lesson.classroomId === classroomId) return `【${lesson.classroomName}】在此時段已被預約 (${lesson.type === 'RENTAL' ? '租借中' : '上課中'})`;
      
      // 如果目前是課程，則需要檢查老師與學生是否重疊
      if (type === 'LESSON') {
        if (teacherId && lesson.teacherId === teacherId) return `【${lesson.teacherName}老師】在此時段已有排課`;
        if (studentId && lesson.studentId === studentId) return `【${lesson.studentName}同學】在此時段已有課`;
      }
    }
  }
  return null;
};

// 檢查新增的休假是否會與既有課程衝突 (反向檢核)
export const checkLessonsOverlapWithHoliday = async (
  teacherId: string,
  date: string,
  halfDay: 'AM' | 'PM' | 'ALL'
): Promise<string | null> => {
  const lessons = await lessonRepo.fetchLessonsByQuery([
    where("date", "==", date), 
    where("teacherId", "==", teacherId)
  ]);

  const isAM = (t: string) => t < '12:00';
  const isPM = (t: string) => t >= '12:00';

  for (const lesson of lessons) {
    if (lesson.type === 'RENTAL') continue;
    
    if (halfDay === 'ALL') {
      return `【${lesson.studentName}】有預約 ${lesson.startTime}-${lesson.endTime} 的課程，請先改期才能設定全天休假。`;
    }
    if (halfDay === 'AM' && (isAM(lesson.startTime) || isAM(lesson.endTime))) {
      return `【${lesson.studentName}】有預約上午 (${lesson.startTime}-${lesson.endTime}) 的課程，請先改期才能設定上午休假。`;
    }
    if (halfDay === 'PM' && (isPM(lesson.startTime) || isPM(lesson.endTime))) {
      return `【${lesson.studentName}】有預約下午 (${lesson.startTime}-${lesson.endTime}) 的課程，請先改期才能設定下午休假。`;
    }
  }
  return null;
};

/** 批次檢查多個日期是否有課程衝突 (輔助排休管理) */
export const checkLessonsConflictBatch = async (
  teacherId: string,
  dates: { date: string, halfDay: 'AM' | 'PM' | 'ALL' }[]
): Promise<Lesson[]> => {
  if (dates.length === 0) return [];
  
  const allConflicts: Lesson[] = [];
  const dateMap = new Map(dates.map(d => [d.date, d.halfDay]));
  
  const sortedDates = [...dates].sort((a,b) => a.date.localeCompare(b.date));
  const minDate = sortedDates[0].date;
  const maxDate = sortedDates[sortedDates.length - 1].date;

  const lessons = await lessonRepo.fetchLessonsByQuery([
    where("teacherId", "==", teacherId),
    where("date", ">=", minDate),
    where("date", "<=", maxDate)
  ]);

  const isAM = (t: string) => t < '12:00';
  const isPM = (t: string) => t >= '12:00';

  for (const lesson of lessons) {
    const holidayType = dateMap.get(lesson.date);
    if (!holidayType) continue;
    if (lesson.type === 'RENTAL') continue;

    let hasConflict = false;
    if (holidayType === 'ALL') {
      hasConflict = true;
    } else if (holidayType === 'AM' && (isAM(lesson.startTime) || isAM(lesson.endTime))) {
      hasConflict = true;
    } else if (holidayType === 'PM' && (isPM(lesson.startTime) || isPM(lesson.endTime))) {
      hasConflict = true;
    }

    if (hasConflict) {
      allConflicts.push(lesson);
    }
  }

  return allConflicts;
};

// 新增課程記錄
export const addLesson = async (lesson: Lesson) => {
  return await lessonRepo.addLessonRecord(lesson);
};

// 更新課程狀態 (每日打勾、更改尾數等)
export const updateLessonStatus = async (lessonId: string, updates: Partial<Lesson>) => {
  await lessonRepo.updateLessonRecord(lessonId, updates);
};

export const deleteLesson = async (lessonId: string) => {
  await lessonRepo.deleteLessonRecord(lessonId);
};

// =========================================================
// 核心業務流程封裝 (Orchestration Layer)
// =========================================================
import { getDailyClosingStatus, unsettleLessonTransaction, settleLessonTransaction } from "./finance";

export const ScheduleService = {
  /**
   * 批次建立預約 (包含衝突檢查與關帳檢查)
   */
  async createBooking(formData: any, students: any[], teachers: any[], classrooms: any[]) {
    const { type, studentIdx, teacherIdx, classroomIdx, bookingDate, startTime, endTime, courseName, lessonsCount, payoutLessonsCount, unitPrice, teacherPayout, recurringType, recurringCount, status, remark } = formData;
    
    if (startTime >= endTime) throw new Error("結束時間必須晚於開始時間！");
    
    const student = type === 'LESSON' ? students[studentIdx as any] : null;
    const teacher = type === 'LESSON' ? teachers[teacherIdx as any] : null;
    const classroom = classrooms[classroomIdx as any];
    
    const datesToBook = getRecurringDates(bookingDate, recurringType, recurringCount);
    
    // 檢查目標日期是否關帳
    for (const d of datesToBook) {
       if (await getDailyClosingStatus(d)) throw new Error(`🚫 日期 ${d} 已入帳鎖定，無法新增預約至該日期！`);
    }
    
    // 檢查衝突
    const conflictResult = await checkConflictsForDates(datesToBook, startTime, endTime, classroom.id!, teacher?.id, student?.id, type);
    if (conflictResult) {
       throw new Error(`${conflictResult.date} 衝突警報：\n${conflictResult.error}\n\n週期預約中斷，請調整後再試。`);
    }

    // 寫入 DB
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
  },

  /**
   * 更新預約 (包含衝突檢查、關帳檢查、舊紀錄沖銷、新紀錄結算)
   */
  async updateBooking(editingLessonId: string, oldLesson: Lesson, formData: any, students: any[], teachers: any[], classrooms: any[]) {
    const { type, studentIdx, teacherIdx, classroomIdx, bookingDate, startTime, endTime, courseName, lessonsCount, payoutLessonsCount, unitPrice, teacherPayout, status, remark } = formData;
    
    if (startTime >= endTime) throw new Error("結束時間必須晚於開始時間！");

    const student = type === 'LESSON' ? students[studentIdx as any] : null;
    const teacher = type === 'LESSON' ? teachers[teacherIdx as any] : null;
    const classroom = classrooms[classroomIdx as any];

    // 檢查是否關帳
    const originLocked = oldLesson ? await getDailyClosingStatus(oldLesson.date) : false;
    const targetLocked = await getDailyClosingStatus(bookingDate);
    if (originLocked || targetLocked) {
       throw new Error("🚫 該日期已入帳鎖定，無法修改預約！");
    }

    // 檢查單一衝突
    const conflict = await checkConflict(bookingDate, startTime, endTime, classroom.id!, teacher?.id, student?.id, type, editingLessonId);
    if (conflict) {
       throw new Error(`衝突警報：\n${conflict}`);
    }

    // 執行沖銷
    if (oldLesson?.isSettled) {
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

    // 寫入更新
    await updateLessonStatus(editingLessonId, payload);

    // 若修改前已結算且修改後為正常課程，則重新結算
    if (oldLesson?.isSettled) {
      if (payload.status === 'NORMAL' && payload.type === 'LESSON') {
         await settleLessonTransaction({ id: editingLessonId, ...payload } as Lesson);
      } else {
         await updateLessonStatus(editingLessonId, { isSigned: false, isSettled: false });
      }
    }
  },

  /**
   * 刪除課程 (包含關帳檢查、帳務沖銷)
   */
  async deleteBookingWithChecks(lessonId: string, lessonsList: Lesson[]) {
    const oldLesson = lessonsList.find(l => l.id === lessonId);
    if (!oldLesson) throw new Error("找不到該筆預約");

    const isLocked = await getDailyClosingStatus(oldLesson.date);
    if (isLocked) {
      throw new Error("🚫 該日期已入帳鎖定，無法刪除預約！");
    }

    if (oldLesson.isSettled) {
      await unsettleLessonTransaction(oldLesson);
    }

    await deleteLesson(lessonId);
  },

  /**
   * 移動課程 (拖曳修改時間與教室)
   */
  async moveBooking(draggedLesson: Lesson, targetDate: string | undefined, targetRoomId: string | undefined, newStartTime: string, newEndTime: string, classrooms: any[]) {
    const isSourceLocked = await getDailyClosingStatus(draggedLesson.date);
    if (isSourceLocked) throw new Error("🚫 原始日期已入帳鎖定，無法被移動。");

    const newDate = targetDate || draggedLesson.date;
    const isTargetLocked = await getDailyClosingStatus(newDate);
    if (isTargetLocked) throw new Error("🚫 目標日期已入帳鎖定，移入失敗。");

    const newRoomId = targetRoomId || draggedLesson.classroomId;
    const newRoom = classrooms.find(c => c.id === newRoomId);

    const conflict = await checkConflict(
      newDate, newStartTime, newEndTime, newRoomId, draggedLesson.teacherId, draggedLesson.studentId, draggedLesson.type, draggedLesson.id
    );

    if (conflict) {
      throw new Error(`🚫 無法移動：${conflict}`);
    }

    await updateLessonStatus(draggedLesson.id!, {
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
      classroomId: newRoomId,
      classroomName: newRoom?.name || draggedLesson.classroomName
    });
  }
};

/**
 * 輔助方法：統一標準化 Lesson 數據架構 (Service 內部邏輯)
 */
const normalizeLesson = (d: any): Lesson => ({
  id: d.id,
  ...d,
  type: d.type || 'LESSON',
  courseName: d.courseName || (d.type === 'RENTAL' ? '教室租借' : '預設課程(舊紀錄)'),
  lessonsCount: Number(d.lessonsCount) || 1, 
  payoutLessonsCount: Number(d.payoutLessonsCount) || Number(d.lessonsCount) || 1,
  unitPrice: Number(d.unitPrice) || Number(d.price) || 0,
  teacherPayout: Number(d.teacherPayout) || 0,
  paymentMethod: d.paymentMethod || 'UNPAID',
  accountSuffix: d.accountSuffix || '',
  isPaid: Boolean(d.isPaid),
  isSigned: Boolean(d.isSigned),
  isSettled: Boolean(d.isSettled),
  remark: d.remark || ''
});

// 提取指定日期的所有課程 (包含日結紀錄)
export const getLessonsByDate = async (date: string) => {
  const data = await lessonRepo.fetchLessonsByQuery([where("date", "==", date)]);
  // 在 Service 層執行標準化與排序
  return data.map(normalizeLesson).sort((a, b) => a.startTime.localeCompare(b.startTime));
};

// 提取指定日期範圍的所有課程 (例如週視圖)
export const getLessonsByDateRange = async (startDate: string, endDate: string) => {
  const data = await lessonRepo.fetchLessonsByQuery([
    where("date", ">=", startDate), 
    where("date", "<=", endDate)
  ]);
  return data.map(normalizeLesson).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
};

// ── 月統計功能 ────────────────────────────────────────────────

/** 取得特定月份的所有課程 (YYYY-MM) */
export const getLessonsByMonth = async (month: string) => {
  return await lessonRepo.fetchLessonsByQuery([
    where("date", ">=", `${month}-01`), 
    where("date", "<=", `${month}-31`)
  ]);
};

/** 取得所有課程記錄 (用於備份) */
export const getAllLessons = async (): Promise<Lesson[]> => {
  return await lessonRepo.fetchAllLessons();
};

/** 計算特定月份各老師的「累計應得薪資」(基於已排課程) */
export const getMonthTeacherStats = async (month: string) => {
  const lessons = await getLessonsByMonth(month);
  const stats: Record<string, { totalPayout: number; lessonCount: number }> = {};

  lessons.forEach(l => {
    if (l.type === 'LESSON' && l.teacherId && l.teacherName) {
      if (!stats[l.teacherId]) {
        stats[l.teacherId] = { totalPayout: 0, lessonCount: 0 };
      }
      stats[l.teacherId].totalPayout += Number(l.teacherPayout) || 0;
      stats[l.teacherId].lessonCount += Number(l.payoutLessonsCount) || Number(l.lessonsCount) || 1;
    }
  });

  return stats;
};

/**
 * [Service] 計算週期性預約的所有日期
 */
export const getRecurringDates = (baseDate: string, recurringType: 'NONE' | 'WEEK' | 'TWO_WEEKS', recurringCount: number): string[] => {
  const dates = [baseDate];
  if (recurringType === 'NONE') return dates;
  
  const interval = recurringType === 'WEEK' ? 7 : 14;
  for (let i = 1; i < (recurringCount || 1); i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + (i * interval));
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

/**
 * [Service] 批次檢查衝突
 */
export const checkConflictsForDates = async (
  dates: string[],
  startTime: string,
  endTime: string,
  classroomId: string,
  teacherId?: string,
  studentId?: string,
  type: 'LESSON' | 'RENTAL' = 'LESSON',
  excludeLessonId?: string
): Promise<{ date: string; error: string } | null> => {
  for (const d of dates) {
    const conflict = await checkConflict(d, startTime, endTime, classroomId, teacherId, studentId, type, excludeLessonId);
    if (conflict) return { date: d, error: conflict };
  }
  return null;
};

// ── 老師專屬視圖數據服務 (含脫敏與安全隔離) ────────────────────────────────────
export const getTeacherScheduleView = async (startDate: string, endDate: string, currentTeacherId: string) => {
  const lessons = await getLessonsByDateRange(startDate, endDate);
  
  return lessons.map(l => {
    // 嚴格移除所有財務相關欄位 (無論是否為本人)
    const { unitPrice, teacherPayout, payoutLessonsCount, ...safeData } = l as any;
    
    // 如果不是該老師的課程，進行數據脫敏 (Data Masking)
    if (l.teacherId !== currentTeacherId) {
      return {
        ...safeData,
        studentName: "教室使用中",
        studentId: "MASKED",
        courseName: "Occupied",
        teacherName: "其他老師",
        remark: "",
        isOthers: true // 用於前端渲染「毛玻璃」效果
      };
    }
    
    return {
      ...safeData,
      isOthers: false
    };
  });
};
