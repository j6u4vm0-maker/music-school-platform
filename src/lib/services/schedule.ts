import { db } from "../firebase";
import { collection, addDoc, getDocs, doc, updateDoc, query, where, deleteDoc } from "firebase/firestore";
import { checkTeacherHoliday } from "./holidays";

export interface Lesson {
  id?: string;
  type: 'LESSON' | 'RENTAL'; // 新增類型區分
  studentId?: string; // 租借時可為空
  studentName?: string;
  teacherId?: string; // 租借時可為空
  teacherName?: string;
  classroomId: string;
  classroomName: string;
  date: string; // 格式: YYYY-MM-DD
  startTime: string; // 格式: HH:mm 
  endTime: string; // 格式: HH:mm 
  price?: number; 

  // === 針對對帳單 Excel 新增的欄位 ===
  courseName: string; // 課程名稱 (例如: 鋼琴, 租借, 樂理)
  lessonsCount: number; // 學生收費堂數 (例如: 1, 1.5)
  payoutLessonsCount?: number; // 老師支薪堂數 (例如: 1)
  unitPrice: number; // 單堂鐘點 (對個別學生的收費標準)
  teacherPayout: number; // 發給老師的薪水 (抽成)
  
  paymentMethod: 'UNPAID' | 'CASH' | 'TRANSFER'; // 收款狀態與方式
  accountSuffix: string; // 帳號尾數
  isPaid: boolean; // 入帳紀錄打勾
  isSigned: boolean; // 簽到表打勾
  isSettled?: boolean; // 收入與支出結算完畢
  status?: 'NORMAL' | 'LEAVE' | 'CANCELLED'; // 課程狀態：正常, 請假, 取消
  remark: string; // 備註
}

const lessonsCollection = collection(db, "lessons");

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
  const q = query(lessonsCollection, where("date", "==", date));
  const snapshot = await getDocs(q);
  const lessons = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }) as Lesson);

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
  const q = query(lessonsCollection, where("date", "==", date), where("teacherId", "==", teacherId));
  const snapshot = await getDocs(q);
  const lessons = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }) as Lesson);

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

  const q = query(
    lessonsCollection, 
    where("teacherId", "==", teacherId),
    where("date", ">=", minDate),
    where("date", "<=", maxDate)
  );

  const snapshot = await getDocs(q);
  const lessons = snapshot.docs.map(doc => {
      const d = doc.data();
      return { id: doc.id, ...d } as Lesson;
  });

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
  const docRef = await addDoc(lessonsCollection, {
    ...lesson,
    createdAt: Date.now()
  });
  return docRef.id;
};

// 更新課程狀態 (每日打勾、更改尾數等)
export const updateLessonStatus = async (lessonId: string, updates: Partial<Lesson>) => {
  const ref = doc(db, "lessons", lessonId);
  await updateDoc(ref, updates);
};

export const deleteLesson = async (lessonId: string) => {
  await deleteDoc(doc(db, "lessons", lessonId));
};

// 提取指定日期的所有課程 (包含日結紀錄)
export const getLessonsByDate = async (date: string) => {
  const q = query(lessonsCollection, where("date", "==", date));
  const snapshot = await getDocs(q);
  // 按照時間排序
  const data = snapshot.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      ...d,
      type: d.type || 'LESSON',
      courseName: d.courseName || (d.type === 'RENTAL' ? '教室租借' : '預設課程(舊紀錄)'),
      lessonsCount: Number(d.lessonsCount) || 1, // 預設 1 堂
      payoutLessonsCount: Number(d.payoutLessonsCount) || Number(d.lessonsCount) || 1,
      unitPrice: Number(d.unitPrice) || Number(d.price) || 0, // 兼容舊版 price
      teacherPayout: Number(d.teacherPayout) || 0,
      paymentMethod: d.paymentMethod || 'UNPAID',
      accountSuffix: d.accountSuffix || '',
      isPaid: Boolean(d.isPaid),
      isSigned: Boolean(d.isSigned),
      isSettled: Boolean(d.isSettled),
      remark: d.remark || ''
    } as Lesson;
  });
  return data.sort((a, b) => a.startTime.localeCompare(b.startTime));
};

// 提取指定日期範圍的所有課程 (例如週視圖)
export const getLessonsByDateRange = async (startDate: string, endDate: string) => {
  const q = query(
    lessonsCollection, 
    where("date", ">=", startDate), 
    where("date", "<=", endDate)
  );
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
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
    } as Lesson;
  });
  return data.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
};

// ── 月統計功能 ────────────────────────────────────────────────

/** 取得特定月份的所有課程 (YYYY-MM) */
export const getLessonsByMonth = async (month: string) => {
  // Firestore 支援字串比較 YYYY-MM-DD
  const q = query(
    lessonsCollection, 
    where("date", ">=", `${month}-01`), 
    where("date", "<=", `${month}-31`)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lesson));
};

/** 取得所有課程記錄 (用於備份) */
export const getAllLessons = async (): Promise<Lesson[]> => {
  const snapshot = await getDocs(lessonsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lesson));
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
