import { db } from "../firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  QueryConstraint
} from "firebase/firestore";
import { Lesson } from "../types/lesson";

const COLLECTION_NAME = "lessons";
const lessonsCollection = collection(db, COLLECTION_NAME);

/**
 * [Repository] Raw Lesson Data Access
 * No business logic allowed here.
 */

export const addLessonRecord = async (lesson: Lesson) => {
  const docRef = await addDoc(lessonsCollection, {
    ...lesson,
    createdAt: Date.now()
  });
  return docRef.id;
};

export const updateLessonRecord = async (lessonId: string, updates: Partial<Lesson>) => {
  const ref = doc(db, COLLECTION_NAME, lessonId);
  await updateDoc(ref, updates as any);
};

export const deleteLessonRecord = async (lessonId: string) => {
  const ref = doc(db, COLLECTION_NAME, lessonId);
  await deleteDoc(ref);
};

export const fetchLessonsByQuery = async (constraints: QueryConstraint[]): Promise<Lesson[]> => {
  const q = query(lessonsCollection, ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Lesson));
};

export const fetchAllLessons = async (): Promise<Lesson[]> => {
  const snapshot = await getDocs(lessonsCollection);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Lesson));
};
