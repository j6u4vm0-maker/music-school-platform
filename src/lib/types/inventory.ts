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
  accountingSubject: string;
}

export interface InventoryTransaction {
  id?: string;
  productId: string;
  type: 'IN_STOCK' | 'OUT_STOCK' | 'RETURN_IN' | 'RETURN_OUT';

  qtyChange: number;
  operator: string;
  timestamp: number;
}

