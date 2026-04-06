"use client";

// ============================================================
// finance.ts — Firestore: transactions, categories
// ============================================================

import { db } from '../firebase';
import { Lesson } from './schedule';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  setDoc,
  getDoc,
} from 'firebase/firestore';

export interface Transaction {
  id?: string;
  userId: string;
  userName: string;
  type: 'TOP_UP' | 'LESSON_FEE' | 'TEACHER_PAYOUT' | 'EXPENSE' | 'SALES' | 'RENTAL' | 'OTHER_INCOME';
  amount: number;
  description: string;
  category?: string;
  paymentMethod?: 'CASH' | 'TRANSFER';
  accountSuffix?: string;
  date: string;
  createdAt: number;
  teacherId?: string;
  instrument?: string;
}

const txCol = collection(db, 'transactions');
const catCol = collection(db, 'categories');

// ── Transactions ─────────────────────────────────────────────

export const addTransaction = async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
  const docRef = await addDoc(txCol, {
    ...transaction,
    createdAt: Date.now(),
  });
  return docRef.id;
};

export const getTransactions = async (): Promise<Transaction[]> => {
  const q = query(txCol, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
};

export const updateTransaction = async (id: string, transaction: Partial<Transaction>) => {
  await updateDoc(doc(db, 'transactions', id), transaction as any);
};

export const deleteTransaction = async (id: string) => {
  await deleteDoc(doc(db, 'transactions', id));
};

// ── Student Balance ───────────────────────────────────────────

export const updateStudentBalance = async (studentId: string, amountChange: number, lessonsChange: number, teacherId?: string, instrument?: string) => {
  const ref = doc(db, 'students', studentId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    let updated = false;

    if (teacherId && instrument && data.enrollments) {
      const enrollments = data.enrollments.map((en: any) => {
        if (en.teacherId === teacherId && en.instrument === instrument) {
          updated = true;
          return {
            ...en,
            balance: (en.balance || 0) + amountChange,
            remainingLessons: (en.remainingLessons || 0) + lessonsChange
          };
        }
        return en;
      });

      if (updated) {
        await updateDoc(ref, { enrollments });
        return;
      }
    }

    // Fallback: 如果沒有指定老師/科目，或是找不到對應的 enrollment，則更新總餘額（通用錢包）
    await updateDoc(ref, {
      balance: (data.balance || 0) + amountChange,
      remainingLessons: (data.remainingLessons || 0) + lessonsChange,
    });
  }
};

/**
 * 遞延收入轉實質營收：執行強制結算
 * 扣除學生特定存錢筒餘額 -> 產生實質營收紀錄 -> 產生老師支出紀錄
 */
export const settleLessonTransaction = async (lesson: Lesson) => {
  if (lesson.type !== 'LESSON') return; // 租借目前暫不走遞延結算邏輯

  const amountToDeduct = lesson.unitPrice * lesson.lessonsCount;

  // 1. 扣除專屬存錢筒堂數與金額
  await updateStudentBalance(
    lesson.studentId!, 
    -amountToDeduct, 
    -lesson.lessonsCount, 
    lesson.teacherId, 
    lesson.courseName
  );

  // 2. 撥付金流給老師 (實質支出)
  if (lesson.teacherPayout > 0) {
    await addTransaction({
      userId: lesson.teacherId!,
      userName: lesson.teacherName!,
      type: 'TEACHER_PAYOUT',
      category: '教師薪資',
      amount: -lesson.teacherPayout,
      description: `[薪資撥發] 教學: ${lesson.studentName} - ${lesson.courseName} (${lesson.lessonsCount} 堂)`,
      date: lesson.date,
      paymentMethod: 'CASH',
      createdAt: Date.now()
    } as any);
  }

  // 3. 認列補習班實質營收 (預收款轉收入)
  // 注意：這裡產生的實質營收入帳，主要是給報表對帳用
  await addTransaction({
    userId: lesson.studentId!,
    userName: lesson.studentName!,
    type: 'LESSON_FEE', // 作為已實現營收的標籤
    category: '課程營收(已實現)',
    amount: amountToDeduct,
    description: `[營收實現] ${lesson.teacherName} - ${lesson.courseName} (${lesson.lessonsCount} 堂)`,
    date: lesson.date,
    paymentMethod: 'CASH',
    createdAt: Date.now()
  } as any);
};

// ── Categories ────────────────────────────────────────────────

const defaultCategories = [
  '課程營收', '樂器買賣', '場地租借', '樂譜販售', '教師薪資',
  '房貸', '台電', '台水', '電話', '樂譜進貨', '雜支', '樂器購買', '其他收入',
];

export const getCategories = async (): Promise<string[]> => {
  const snap = await getDocs(catCol);
  if (snap.empty) {
    for (const c of defaultCategories) {
      await setDoc(doc(db, 'categories', c), { name: c });
    }
    return defaultCategories;
  }
  return snap.docs.map(d => d.id);
};

export const addCategory = async (name: string) => {
  await setDoc(doc(db, 'categories', name), { name });
};

export const deleteCategory = async (name: string) => {
  await deleteDoc(doc(db, 'categories', name));
};
