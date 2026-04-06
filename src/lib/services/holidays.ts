import { db } from '../firebase';
import {
  collection, addDoc, getDocs, deleteDoc, doc, query, where
} from 'firebase/firestore';

export interface TeacherHoliday {
  id?: string;
  teacherId: string;
  teacherName: string;
  date: string;              // YYYY-MM-DD
  halfDay: 'AM' | 'PM' | 'ALL'; // 上午 / 下午 / 全天 不排課
  reason?: string;
  ruleId?: string;           // 批次規則 ID (用於連假或重複排休)
  createdAt?: number;
  updatedAt?: number;
}

const holidaysCol = collection(db, 'teacher_holidays');

export const addTeacherHoliday = async (holiday: Omit<TeacherHoliday, 'id'>) => {
  const docRef = await addDoc(holidaysCol, { ...holiday, createdAt: Date.now() });
  return docRef.id;
};

// 批次新增休假 (連假或重複)
export const addTeacherHolidayBatch = async (holidays: Omit<TeacherHoliday, 'id'>[]) => {
  const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const promises = holidays.map(h => addDoc(holidaysCol, { ...h, ruleId, createdAt: Date.now() }));
  await Promise.all(promises);
  return ruleId;
};

export const getTeacherHolidays = async (teacherId: string): Promise<TeacherHoliday[]> => {
  const q = query(holidaysCol, where('teacherId', '==', teacherId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as TeacherHoliday));
};

export const deleteTeacherHoliday = async (id: string) => {
  await deleteDoc(doc(db, 'teacher_holidays', id));
};

// 依規則 ID 批次刪除
export const deleteTeacherHolidaysByRule = async (ruleId: string) => {
    const q = query(holidaysCol, where('ruleId', '==', ruleId));
    const snap = await getDocs(q);
    const promises = snap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(promises);
};

/**
 * 查詢特定日期是否有老師休假（供 checkConflict 使用）
 * 回傳衝突描述，若無衝突則回傳 null
 */
export const checkTeacherHoliday = async (
  date: string,
  startTime: string,
  endTime: string,
  teacherId: string,
  teacherName: string
): Promise<string | null> => {
  const holidays = await getTeacherHolidays(teacherId);
  const dayHolidays = holidays.filter(h => h.date === date);

  for (const h of dayHolidays) {
    if (h.halfDay === 'ALL') {
      return `【${teacherName}老師】當天全天休假，無法排課。`;
    }
    // AM = 00:00~12:00 不可排, PM = 12:00~24:00 不可排
    const isAM = (t: string) => t < '12:00';
    const isPM = (t: string) => t >= '12:00';
    if (h.halfDay === 'AM' && (isAM(startTime) || isAM(endTime))) {
      return `【${teacherName}老師】當天上午休假，無法在上午排課。`;
    }
    if (h.halfDay === 'PM' && (isPM(startTime) || isPM(endTime))) {
      return `【${teacherName}老師】當天下午休假，無法在下午排課。`;
    }
  }
  return null;
};
