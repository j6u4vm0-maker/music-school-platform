"use client";

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
  runTransaction
} from 'firebase/firestore';

export interface Product {
  productId?: string;
  category: string;
  brand: string;
  itemName: string;
  origin: string;
  material: string;
  costPrice: number;
  sellPrice: number;
  profit: number;
  stockQty: number;
  minStock: number;
  note: string;
}

const productsCol = collection(db, 'products');

/**
 * 新增商品
 * 寫入前會自動計算 profit = sellPrice - costPrice
 */
export const addProduct = async (product: Omit<Product, 'productId' | 'profit'>) => {
  const profit = product.sellPrice - product.costPrice;
  const docRef = await addDoc(productsCol, {
    ...product,
    profit,
    createdAt: Date.now()
  });
  return docRef.id;
};

/**
 * 更新商品資訊
 * 若有修改售價或進價，建議傳入完整的更改，以便重新計算 profit。
 * 若 payload 包含 sellPrice 與 costPrice，會自動重新計算利潤。
 */
export const updateProduct = async (productId: string, updates: Partial<Omit<Product, 'productId'>>) => {
  const payload = { ...updates };
  
  if (payload.sellPrice !== undefined && payload.costPrice !== undefined) {
    payload.profit = payload.sellPrice - payload.costPrice;
  }
  
  await updateDoc(doc(db, 'products', productId), payload);
};

/**
 * 刪除商品
 */
export const deleteProduct = async (productId: string) => {
  await deleteDoc(doc(db, 'products', productId));
};

/**
 * 取得所有商品列表 (即時監聽)
 * @param callback 傳入一個 callback function，當資料有變動時會自動觸發更新 UI
 * @returns 回傳一個 unsubscribe 函數，用於在元件 unmount 時取消監聽
 */
export const subscribeToProducts = (callback: (products: Product[]) => void) => {
  const q = query(productsCol, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const products = snapshot.docs.map(d => ({
      productId: d.id,
      ...d.data()
    } as Product));
    callback(products);
  });
};

/** 取得所有商品列表 (一次性獲取) */
export const getProducts = async (): Promise<Product[]> => {
  const snapshot = await getDocs(query(productsCol, orderBy('createdAt', 'desc')));
  return snapshot.docs.map(d => ({ productId: d.id, ...d.data() } as Product));
};

/**
 * 取得近期的進銷存紀錄 (即時監聽)
 */
export const subscribeToInventoryTransactions = (limitCount: number = 50, callback: (txs: any[]) => void) => {
  const invCol = collection(db, 'inventory_transactions');
  const q = query(invCol, orderBy('timestamp', 'desc')); // 可依需求加上 limit(limitCount)
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

/** 取得所有進銷存紀錄 (一次性獲取) */
export const getInventoryTransactions = async (): Promise<any[]> => {
  const snapshot = await getDocs(query(collection(db, 'inventory_transactions'), orderBy('timestamp', 'desc')));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * 取得近期的財務帳本紀錄 (即時監聽)
 */
export const subscribeToFinancialLedgers = (limitCount: number = 50, callback: (ledgers: any[]) => void) => {
  const ledgersCol = collection(db, 'financial_ledgers');
  const q = query(ledgersCol, orderBy('timestamp', 'desc')); // 可依需求加上 limit(limitCount)
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

/**
 * 任務三：進出貨與財務連動邏輯 (Batched Writes)
 * 使用 runTransaction 確保讀取與寫入庫存時不會發生資料衝突 (Race Condition)
 */
export const handleInventoryTransaction = async (
  scenario: 'STOCK_IN' | 'SALES',
  params: {
    productId: string;
    qty: number;
    price: number; // 若為 STOCK_IN 則傳入 costPrice，若為 SALES 則傳入 sellPrice
    accountingCategory: string;
    operator: string;
  }
) => {
  const productRef = doc(db, 'products', params.productId);
  const inventoryCol = collection(db, 'inventory_transactions');
  const ledgerCol = collection(db, 'financial_ledgers');

  await runTransaction(db, async (transaction) => {
    // 1. 讀取與檢驗庫存狀態
    const productSnap = await transaction.get(productRef);
    if (!productSnap.exists()) {
      throw new Error(`找不到商品 (ID: ${params.productId})`);
    }

    const currentStock = productSnap.data().stockQty || 0;
    let newStock = currentStock;

    if (scenario === 'STOCK_IN') {
      newStock += params.qty;
    } else if (scenario === 'SALES') {
      newStock -= params.qty;
      if (newStock < 0) {
        // 若庫存不足，拋出錯誤終止此批次交易
        throw new Error(`【交易失敗】該商品庫存不足！目前僅剩: ${currentStock}，欲結帳數量: ${params.qty}`);
      }
    }

    // 2. 更新 Product 庫存
    transaction.update(productRef, { stockQty: newStock });

    const now = Date.now();

    // 3. 新增進銷存紀錄 (InventoryTransaction)
    const newInventoryDocRef = doc(inventoryCol);
    transaction.set(newInventoryDocRef, {
      productId: params.productId,
      type: scenario === 'STOCK_IN' ? 'IN_STOCK' : 'OUT_STOCK',
      qtyChange: scenario === 'STOCK_IN' ? params.qty : -params.qty,
      operator: params.operator,
      timestamp: now,
    });

    // 4. 新增財務帳本紀錄 (FinancialLedger)
    const newLedgerDocRef = doc(ledgerCol);
    transaction.set(newLedgerDocRef, {
      transactionId: newInventoryDocRef.id, // 記錄關聯的進銷存單號
      type: scenario === 'STOCK_IN' ? 'EXPENSE' : 'REVENUE',
      category: params.accountingCategory,
      amount: params.price * params.qty,
      timestamp: now,
    });
  });
};
