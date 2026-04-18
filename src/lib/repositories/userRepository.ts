import { db } from '../firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { Student, Teacher } from '../types/user';

const studentsCol = collection(db, 'students');
const teachersCol = collection(db, 'teachers');

const mapDoc = (d: QueryDocumentSnapshot<DocumentData>) => ({
  id: d.id,
  ...d.data()
});

export const fetchStudents = async (): Promise<Student[]> => {
  const snap = await getDocs(studentsCol);
  return snap.docs.map(mapDoc) as Student[];
};

export const fetchTeachers = async (): Promise<Teacher[]> => {
  const snap = await getDocs(teachersCol);
  return snap.docs.map(mapDoc) as Teacher[];
};

export const fetchUserById = async (id: string, role: 'STUDENT' | 'TEACHER'): Promise<Student | Teacher | null> => {
  const col = role === 'TEACHER' ? teachersCol : studentsCol;
  const snap = await getDoc(doc(db, col.path, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as any;
};

export const addUserRecord = async (user: Partial<Student | Teacher>) => {
  const col = user.role === 'TEACHER' ? teachersCol : studentsCol;
  const docRef = await addDoc(col, {
    ...user,
    createdAt: Date.now(),
  });
  return docRef.id;
};

export const updateUserRecord = async (id: string, updates: Partial<Student | Teacher>) => {
  // If role is provided, use it to find the collection. 
  // If not, we might need a more complex strategy, but usually role is known.
  const role = (updates as any).role;
  if (role) {
    const col = role === 'TEACHER' ? teachersCol : studentsCol;
    await updateDoc(doc(db, col.path, id), updates as any);
  } else {
    // Fallback: try both if role is not specified
    try {
      await updateDoc(doc(db, 'students', id), updates as any);
    } catch (e) {
      await updateDoc(doc(db, 'teachers', id), updates as any);
    }
  }
};

export const deleteUserRecord = async (id: string) => {
  try { await deleteDoc(doc(db, 'students', id)); } catch (_) {}
  try { await deleteDoc(doc(db, 'teachers', id)); } catch (_) {}
};
