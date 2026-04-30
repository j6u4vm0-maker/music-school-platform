"use client";

// ============================================================
// finance.ts — Firestore: transactions, categories
// ============================================================

import { Lesson } from '../types/lesson';
import { Transaction } from '../types/finance';
import { FinanceRepository } from '../repositories/financeRepository';
import { revertInventoryTransaction, updateInventoryTransactionAmount } from './inventory';

// ── Transactions ─────────────────────────────────────────────

export const addTransaction = async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
  return await FinanceRepository.addTransaction({
    ...transaction,
    createdAt: Date.now(),
  });
};

export const getTransactions = async (): Promise<Transaction[]> => {
  return await FinanceRepository.getTransactions();
};

export const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
  // 1. 檢查是否連動進銷存
  const tx = await FinanceRepository.getTransaction(id);
  if (tx && tx.refId && tx.userName === '零售/進貨系統' && updates.amount !== undefined) {
    await updateInventoryTransactionAmount(tx.refId, updates.amount);
  }
  
  await FinanceRepository.updateTransaction(id, updates);
};

export const deleteTransaction = async (id: string) => {
  // 1. 檢查是否連動進銷存
  const tx = await FinanceRepository.getTransaction(id);
  if (tx && tx.refId && tx.userName === '零售/進貨系統') {
    await revertInventoryTransaction(tx.refId);
    // revertInventoryTransaction 內部會刪除 tx，但為了保險起見這裡也呼叫
  }
  
  await FinanceRepository.deleteTransaction(id);
};

// ── Student Balance ───────────────────────────────────────────

export const updateStudentBalance = async (studentId: string, amountChange: number, lessonsChange: number, teacherId?: string, instrument?: string) => {
  const result = await FinanceRepository.getStudentDoc(studentId);
  if (result) {
    const { ref, data } = result;
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
        await FinanceRepository.updateStudentDoc(ref, { enrollments });
        return;
      }
    }

    // Fallback
    await FinanceRepository.updateStudentDoc(ref, {
      balance: (data.balance || 0) + amountChange,
      remainingLessons: (data.remainingLessons || 0) + lessonsChange,
    });
  }
};

/**
 * 遞延收入轉實質營收：執行強制結算
 */
export const settleLessonTransaction = async (lesson: Lesson) => {
  if (lesson.type !== 'LESSON') return;

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
      createdAt: Date.now(),
      refId: lesson.id
    } as any);
  }

  // 3. 認列補習班營收
  await addTransaction({
    userId: lesson.studentId!,
    userName: lesson.studentName!,
    type: 'LESSON_FEE',
    category: '課程營收(已實現)',
    amount: amountToDeduct,
    description: `[營收實現] ${lesson.teacherName} - ${lesson.courseName} (${lesson.lessonsCount} 堂)`,
    date: lesson.date,
    paymentMethod: 'CASH',
    createdAt: Date.now(),
    refId: lesson.id
  } as any);
};

/**
 * 沖銷課程帳務
 */
export const unsettleLessonTransaction = async (lesson: Lesson) => {
  if (!lesson.id || lesson.type !== 'LESSON') return;

  const restoredLessonsCount = Number(lesson.lessonsCount) || 1;
  const amountToRestore = lesson.unitPrice * restoredLessonsCount;

  // 1. 退還
  await updateStudentBalance(
    lesson.studentId!, 
    amountToRestore,
    restoredLessonsCount,
    lesson.teacherId, 
    lesson.courseName
  );

  // 2. 刪除相關紀錄 (沖銷)
  const relatedTxs = await FinanceRepository.getTransactionsByRefId(lesson.id);
  for (const tx of relatedTxs) {
    if (tx.id) await FinanceRepository.deleteTransaction(tx.id);
  }
};

// ── Daily Closings ──────────────────────────────────────────

export const getDailyClosingStatus = async (dateStr: string): Promise<boolean> => {
  const data = await FinanceRepository.getClosingStatus(dateStr);
  return data ? data.isClosed === true : false;
};

export const setDailyClosingStatus = async (dateStr: string, isClosed: boolean, userId: string) => {
  await FinanceRepository.setClosingStatus(dateStr, {
    isClosed,
    updatedAt: Date.now(),
    updatedBy: userId
  });
};

// ── Categories ────────────────────────────────────────────────

const defaultCategories = [
  '課程營收', '樂器買賣', '場地租借', '樂譜販售', '教師薪資',
  '房貸', '台電', '台水', '電話', '樂譜進貨', '雜支', '樂器購買', '其他收入',
];

export const getCategories = async (): Promise<string[]> => {
  const catNames = await FinanceRepository.getCategories();
  if (catNames.length === 0) {
    for (const c of defaultCategories) {
      await FinanceRepository.saveCategory(c);
    }
    return defaultCategories;
  }
  return catNames;
};

export const addCategory = async (name: string) => {
  await FinanceRepository.saveCategory(name);
};

export const deleteCategory = async (name: string) => {
  await FinanceRepository.deleteCategory(name);
};
