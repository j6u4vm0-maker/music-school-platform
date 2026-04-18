import { db } from '../firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { Classroom } from '../types/user';

const classroomsCol = collection(db, 'classrooms');

const mapDoc = (d: QueryDocumentSnapshot<DocumentData>) => ({
  id: d.id,
  ...d.data()
});

export const fetchClassrooms = async (): Promise<Classroom[]> => {
  const snap = await getDocs(classroomsCol);
  return snap.docs.map(mapDoc) as Classroom[];
};

export const addClassroomRecord = async (classroom: Classroom) => {
  const docRef = await addDoc(classroomsCol, {
    ...classroom,
    createdAt: Date.now(),
  });
  return docRef.id;
};

export const updateClassroomRecord = async (id: string, classroom: Partial<Classroom>) => {
  await updateDoc(doc(db, 'classrooms', id), classroom as any);
};

export const deleteClassroomRecord = async (id: string) => {
  await deleteDoc(doc(db, 'classrooms', id));
};
