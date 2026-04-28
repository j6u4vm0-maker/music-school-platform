"use client";

import { db } from '../firebase';
import {
  doc,
  runTransaction,
  collection,
  deleteDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { Product } from '../types/inventory';
import * as inventoryRepo from '../repositories/inventoryRepository';

/**
 * 新增商品
 * 寫入前會自動計算 profit = sellPrice - costPrice
 */
export const addProduct = async (product: Omit<Product, 'productId' | 'profit'>) => {
  const profit = product.sellPrice - product.costPrice;
  return await inventoryRepo.addProductRecord({
    ...product,
    profit
  });
};

/**
 * 更新商品資訊
 */
export const updateProduct = async (productId: string, updates: Partial<Omit<Product, 'productId'>>) => {
  const payload = { ...updates };
  
  if (payload.sellPrice !== undefined && payload.costPrice !== undefined) {
    payload.profit = payload.sellPrice - payload.costPrice;
  }
  
  await inventoryRepo.updateProductRecord(productId, payload);
};

/**
 * 刪除商品
 */
export const deleteProduct = async (productId: string) => {
  await inventoryRepo.deleteProductRecord(productId);
};

/**
 * 取得所有商品列表 (即時監聽)
 */
export const subscribeToProducts = (callback: (products: Product[]) => void) => {
  return inventoryRepo.subscribeProducts(callback);
};

/** 取得所有商品列表 (一次性獲取) */
export const getProducts = async (): Promise<Product[]> => {
  return await inventoryRepo.fetchProducts();
};

/**
 * 取得近期的進銷存紀錄 (即時監聽)
 */
export const subscribeToInventoryTransactions = (limitCount: number = 50, callback: (txs: any[]) => void) => {
  // limitCount currently handled by repository query if needed, 
  // here we keep the signature for compatibility.
  return inventoryRepo.subscribeInventoryTransactions(callback);
};

/** 取得所有進銷存紀錄 (一次性獲取) */
export const getInventoryTransactions = async (): Promise<any[]> => {
  return await inventoryRepo.fetchInventoryTransactions();
};

/**
 * 取得近期的財務帳本紀錄 (即時監聽)
 */
export const subscribeToFinancialLedgers = (limitCount: number = 50, callback: (ledgers: any[]) => void) => {
  return inventoryRepo.subscribeFinancialLedgers(callback);
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
  const mainTxCol = collection(db, 'transactions');

  await runTransaction(db, async (transaction) => {
    // 1. 讀取與檢驗庫存狀態
    const productSnap = await transaction.get(productRef);
    if (!productSnap.exists()) {
      throw new Error(`找不到商品 (ID: ${params.productId})`);
    }

    const productData = productSnap.data();
    const currentStock = productData.stockQty || 0;
    let newStock = currentStock;

    if (scenario === 'STOCK_IN') {
      newStock += params.qty;
    } else if (scenario === 'SALES') {
      newStock -= params.qty;
      if (newStock < 0) {
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

    // 4. 新增財務帳本紀錄 (FinancialLedger - 庫存專用分帳)
    const newLedgerDocRef = doc(ledgerCol);
    transaction.set(newLedgerDocRef, {
      transactionId: newInventoryDocRef.id,
      type: scenario === 'STOCK_IN' ? 'EXPENSE' : 'REVENUE',
      category: params.accountingCategory,
      amount: params.price * params.qty,
      timestamp: now,
    });

    // 5. 同步至主財務大帳本 (transactions collection)
    const mainTxDocRef = doc(mainTxCol);
    const dateStr = new Date(now).toISOString().split('T')[0];
    
    transaction.set(mainTxDocRef, {
      userId: 'SYSTEM',
      userName: '零售/進貨系統',
      type: scenario === 'STOCK_IN' ? 'EXPENSE' : 'SALES',
      category: params.accountingCategory,
      amount: scenario === 'STOCK_IN' ? -(params.price * params.qty) : (params.price * params.qty),
      description: `[庫存系統] ${scenario === 'STOCK_IN' ? '進貨' : '售出'}: ${productData.itemName} x ${params.qty}`,
      date: dateStr,
      createdAt: now,
      paymentMethod: 'CASH', 
      refId: newInventoryDocRef.id
    });
  });
};

/**
 * 清除所有庫存與進銷存測試資料
 * 注意：此操作不可逆，僅用於清除測試資料
 */
export const clearAllInventoryData = async () => {
  const products = await getProducts();
  const invTxs = await getInventoryTransactions();
  const ledgers = await inventoryRepo.fetchFinancialLedgers();

  // 1. 刪除所有商品
  const pPromises = products.map(p => deleteProduct(p.productId!));
  
  // 2. 刪除所有進銷存紀錄
  const invPromises = invTxs.map(tx => deleteDoc(doc(db, 'inventory_transactions', tx.id)));
  
  // 3. 刪除所有庫存分帳
  const ledgerPromises = ledgers.map(l => deleteDoc(doc(db, 'financial_ledgers', l.id)));
  
  // 4. 刪除主帳本中屬於零售系統的紀錄
  const mainTxSnap = await getDocs(query(collection(db, 'transactions'), where('userName', '==', '零售/進貨系統')));
  const mainTxPromises = mainTxSnap.docs.map(d => deleteDoc(doc(db, 'transactions', d.id)));

  await Promise.all([
    ...pPromises,
    ...invPromises,
    ...ledgerPromises,
    ...mainTxPromises
  ]);
};
