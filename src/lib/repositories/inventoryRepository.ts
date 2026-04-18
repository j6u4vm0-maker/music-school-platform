import { db } from '../firebase';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { Product } from '../types/inventory';

const productsCol = collection(db, 'products');
const invCol = collection(db, 'inventory_transactions');
const ledgersCol = collection(db, 'financial_ledgers');

const mapProduct = (d: QueryDocumentSnapshot<DocumentData>): Product => ({
  productId: d.id,
  ...d.data()
} as Product);

export const fetchProducts = async (): Promise<Product[]> => {
  const snap = await getDocs(query(productsCol, orderBy('createdAt', 'desc')));
  return snap.docs.map(mapProduct);
};

export const subscribeProducts = (callback: (products: Product[]) => void) => {
  const q = query(productsCol, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(mapProduct));
  });
};

export const addProductRecord = async (product: any) => {
  const docRef = await addDoc(productsCol, {
    ...product,
    createdAt: Date.now()
  });
  return docRef.id;
};

export const updateProductRecord = async (id: string, updates: any) => {
  await updateDoc(doc(db, 'products', id), updates);
};

export const deleteProductRecord = async (id: string) => {
  await deleteDoc(doc(db, 'products', id));
};

export const fetchInventoryTransactions = async (): Promise<any[]> => {
  const snap = await getDocs(query(invCol, orderBy('timestamp', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const subscribeInventoryTransactions = (callback: (txs: any[]) => void) => {
  const q = query(invCol, orderBy('timestamp', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

export const fetchFinancialLedgers = async (): Promise<any[]> => {
  const snap = await getDocs(query(ledgersCol, orderBy('timestamp', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const subscribeFinancialLedgers = (callback: (ledgers: any[]) => void) => {
  const q = query(ledgersCol, orderBy('timestamp', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};
