"use client";

// ============================================================
// db.ts — Firestore: students, teachers, classrooms
// ============================================================

import { db } from '../firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';

export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN';

export interface UserProfile {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  role: Role;
  createdAt?: number;
}

export interface StudentEnrollment {
  instrument: string;
  teacherId: string;
  teacherName: string;
  payoutRate?: number; // 新增：抽成比例
  balance?: number;
  remainingLessons?: number;
}

export interface Student extends UserProfile {
  role: 'STUDENT';
  balance: number;
  remainingLessons: number;
  enrollments?: StudentEnrollment[];
  isLineBound?: boolean;
  // 聯絡資訊
  parentName?: string;   // 緊急聯絡人姓名
  parentPhone?: string;  // 緊急聯絡人電話
  lineId?: string;       // LINE ID
  contact_mobiles?: string[]; // 允許綁定的聯絡手機號碼陣列

  /** @deprecated 使用 enrollments 取代 */
  instrument?: string;
  /** @deprecated 使用 enrollments 取代 */
  teacherId?: string;
  /** @deprecated 使用 enrollments 取代 */
  teacherName?: string;
}

export interface Teacher extends UserProfile {
  role: 'TEACHER';
  instruments: string[];
  hourlyRate: number;
  colorIndex?: number; // 新增：老師特定的顏色編號
  // 聯絡資訊
  parentName?: string;   // 緊急聯絡人 / 備用聯絡人
  parentPhone?: string;  // 備用聯絡電話
  lineId?: string;       // LINE ID
}

export interface Classroom {
  id?: string;
  name: string;
  capacity: number;
  equipment: string[];
}

// ── Students ──────────────────────────────────────────────────

const studentsCol = collection(db, 'students');
const teachersCol = collection(db, 'teachers');
const classroomsCol = collection(db, 'classrooms');

export const addUser = async (user: Partial<Student | Teacher>) => {
  const col = user.role === 'TEACHER' ? teachersCol : studentsCol;
  const docRef = await addDoc(col, {
    ...user,
    createdAt: Date.now(),
  });
  return docRef.id;
};

export const getStudents = async (): Promise<Student[]> => {
  const snap = await getDocs(studentsCol);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
};

export const getTeachers = async (): Promise<Teacher[]> => {
  const snap = await getDocs(teachersCol);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher));
};

export const updateUser = async (id: string, user: Partial<Student | Teacher>) => {
  // Determine collection by checking which one has this ID
  // We check teachers first since teachers have instruments field
  const role = (user as any).role;
  const col = role === 'TEACHER' ? teachersCol : studentsCol;
  await updateDoc(doc(db, col.path, id), user as any);
};

export const deleteUser = async (id: string) => {
  // Try both collections — delete from whichever has the doc
  try { await deleteDoc(doc(db, 'students', id)); } catch (_) {}
  try { await deleteDoc(doc(db, 'teachers', id)); } catch (_) {}
};

// ── Classrooms ────────────────────────────────────────────────

export const addClassroom = async (classroom: Classroom) => {
  const docRef = await addDoc(classroomsCol, {
    ...classroom,
    createdAt: Date.now(),
  });
  return docRef.id;
};

export const getClassrooms = async (): Promise<Classroom[]> => {
  const snap = await getDocs(classroomsCol);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Classroom));
};

export const updateClassroom = async (id: string, classroom: Partial<Classroom>) => {
  await updateDoc(doc(db, 'classrooms', id), classroom as any);
};

export const deleteClassroom = async (id: string) => {
  await deleteDoc(doc(db, 'classrooms', id));
};
