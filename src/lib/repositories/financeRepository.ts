import { db } from '../firebase';
import { Transaction } from '../types/finance';
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
  where,
  DocumentReference,
} from 'firebase/firestore';

const TX_COLLECTION = 'transactions';
const CAT_COLLECTION = 'categories';
const CLOSING_COLLECTION = 'daily_closings';

/**
 * [Repository] 交易紀錄連線
 */
export const FinanceRepository = {
  // --- Transactions ---
  async addTransaction(transaction: Omit<Transaction, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, TX_COLLECTION), transaction);
    return docRef.id;
  },

  async getTransaction(id: string): Promise<Transaction | null> {
    const snap = await getDoc(doc(db, TX_COLLECTION, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } as Transaction : null;
  },

  async getTransactions(): Promise<Transaction[]> {
    const q = query(collection(db, TX_COLLECTION), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
  },

  async getTransactionsByRefId(refId: string): Promise<Transaction[]> {
    const q = query(collection(db, TX_COLLECTION), where("refId", "==", refId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
  },

  async updateTransaction(id: string, data: Partial<Transaction>): Promise<void> {
    await updateDoc(doc(db, TX_COLLECTION, id), data as any);
  },

  async deleteTransaction(id: string): Promise<void> {
    await deleteDoc(doc(db, TX_COLLECTION, id));
  },

  // --- Categories ---
  async getCategories(): Promise<string[]> {
    const snap = await getDocs(collection(db, CAT_COLLECTION));
    return snap.docs.map(d => d.id);
  },

  async saveCategory(name: string): Promise<void> {
    await setDoc(doc(db, CAT_COLLECTION, name), { name });
  },

  async deleteCategory(name: string): Promise<void> {
    await deleteDoc(doc(db, CAT_COLLECTION, name));
  },

  // --- Daily Closings ---
  async getClosingStatus(dateStr: string): Promise<any> {
    const snap = await getDoc(doc(db, CLOSING_COLLECTION, dateStr));
    return snap.exists() ? snap.data() : null;
  },

  async setClosingStatus(dateStr: string, data: any): Promise<void> {
    await setDoc(doc(db, CLOSING_COLLECTION, dateStr), data, { merge: true });
  },

  // --- Student Balance (Used by Service) ---
  async getStudentDoc(studentId: string): Promise<any> {
    const snap = await getDoc(doc(db, 'students', studentId));
    return snap.exists() ? { ref: snap.ref, data: snap.data() } : null;
  },

  async updateStudentDoc(ref: DocumentReference, data: any): Promise<void> {
    await updateDoc(ref, data);
  }
};
