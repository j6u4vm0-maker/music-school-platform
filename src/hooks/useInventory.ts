import { useState, useEffect, useMemo } from 'react';
import { 
  Product, 
  subscribeToProducts, 
  subscribeToFinancialLedgers, 
  subscribeToInventoryTransactions,
  handleInventoryTransaction,
  addProduct,
  updateProduct,
  deleteProduct,
  clearAllInventoryData
} from '@/lib/services/inventory';
import { exportToExcel, importFromExcel } from '@/lib/utils/excel';

export const useInventory = (profileName: string) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [invTxs, setInvTxs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | Partial<Product> | null>(null);
  const [modalType, setModalType] = useState<'STOCK_IN' | 'SALES' | 'SALES_RETURN' | 'PURCHASE_RETURN' | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [txQty, setTxQty] = useState(1);
  const [txPrice, setTxPrice] = useState(0); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [columnFilters, setColumnFilters] = useState<any>({
    category: '', brand: '', itemName: '', origin: '', material: '', note: ''
  });
  const [brandFilter, setBrandFilter] = useState('ALL');
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchCategory, setBatchCategory] = useState('');
  const [batchBrand, setBatchBrand] = useState('');
  const [batchMinStock, setBatchMinStock] = useState<string>('');
  const [batchStockQty, setBatchStockQty] = useState<string>('');
  const [batchCostPrice, setBatchCostPrice] = useState<string>('');
  const [batchSellPrice, setBatchSellPrice] = useState<string>('');


  useEffect(() => {
    const unsubProducts = subscribeToProducts(setProducts);
    const unsubLedgers = subscribeToFinancialLedgers(100, setLedgers);
    const unsubInvTxs = subscribeToInventoryTransactions(50, setInvTxs);
    setIsLoading(false);
    return () => {
      unsubProducts();
      unsubLedgers();
      unsubInvTxs();
    };
  }, []);

  const openTxModal = (product: Product, type: 'STOCK_IN' | 'SALES' | 'SALES_RETURN' | 'PURCHASE_RETURN') => {
    setSelectedProduct(product);
    setModalType(type);
    setTxQty(1);
    const defaultPrice = (type === 'STOCK_IN' || type === 'PURCHASE_RETURN') ? product.costPrice : product.sellPrice;
    setTxPrice(defaultPrice);
    setIsModalOpen(true);
  };


  const submitTransaction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedProduct || !modalType) return;
    setIsSubmitting(true);
    try {
      const accountingCategory = selectedProduct.accountingSubject || '樂器買賣';

      await handleInventoryTransaction(modalType, {
        productId: selectedProduct.productId!,
        qty: txQty,
        price: txPrice,
        accountingCategory,
        operator: profileName || '系統操作',
      });
      setIsModalOpen(false);
    } catch (error: any) {
      alert(error.message || '交易失敗');
    }
    setIsSubmitting(false);
  };


  const openProductModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
    } else {
      setEditingProduct({
        category: '樂器', brand: '', itemName: '', origin: '', material: '',
        costPrice: 0, sellPrice: 0, stockQty: 0, minStock: 5, note: '',
        accountingSubject: '其他買賣',
      });
    }
    setIsProductModalOpen(true);
  };

  const handleProductSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingProduct) return;
    setIsSubmitting(true);
    try {
      if ((editingProduct as Product).productId) {
        await updateProduct((editingProduct as Product).productId!, editingProduct);
      } else {
        await addProduct(editingProduct as any);
      }
      setIsProductModalOpen(false);
    } catch (err: any) {
      alert(err.message || '儲存失敗');
    }
    setIsSubmitting(false);
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm('確定要刪除此商品嗎？')) {
      try { await deleteProduct(id); } catch(err) { alert('刪除失敗'); }
    }
  };

  const handleClearAllData = async () => {
    console.log('Attempting to clear all data...');
    if (window.confirm('⚠️ 警告：這將會清除所有商品資料、進銷存紀錄以及相關財務報表，且無法復原！確定要繼續嗎？')) {
      console.log('User confirmed clear action.');
      setIsLoading(true);
      try {
        await clearAllInventoryData();
        alert('已成功清除所有庫存與測試資料');
      } catch (err) {
        alert('清除失敗，請檢查權限');
      }
      setIsLoading(false);
    }
  };

  const handleBatchUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    try {
      const updates: any = {};
      if (batchCategory) updates.category = batchCategory;
      if (batchBrand) updates.brand = batchBrand;
      if (batchMinStock !== '') updates.minStock = Number(batchMinStock);
      if (batchStockQty !== '') updates.stockQty = Number(batchStockQty);
      if (batchCostPrice !== '') updates.costPrice = Number(batchCostPrice);
      if (batchSellPrice !== '') updates.sellPrice = Number(batchSellPrice);

      const promises = Array.from(selectedIds).map(id => updateProduct(id, updates));
      await Promise.all(promises);
      setIsBatchModalOpen(false);
      // Reset batch fields
      setBatchCategory('');
      setBatchBrand('');
      setBatchMinStock('');
      setBatchStockQty('');
      setBatchCostPrice('');
      setBatchSellPrice('');
      setSelectedIds(new Set());
      alert(`成功批次更新 ${selectedIds.size} 項商品！`);
    } catch (err) { alert('批次更新失敗'); }
    setIsSubmitting(false);
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = (filteredProducts: Product[]) => {
    if (selectedIds.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.productId!)));
    }
  };

  const handleExport = () => {
    if (filteredProducts.length === 0) {
      alert('目前沒有符合條件的資料可以匯出');
      return;
    }

    const data = filteredProducts.map(p => ({
      '分類': p.category || '未分類', 
      '樂器品牌 / 出版社': p.brand || '未分類', 
      '品項': p.itemName || '未命名',
      '產地': p.origin || '', 
      '材質 / 特色': p.material || '', 
      '會計科目': p.accountingSubject || '其他買賣',
      '進價': Number(p.costPrice) || 0, 
      '售價': Number(p.sellPrice) || 0, 
      '利潤': (Number(p.sellPrice || 0) - Number(p.costPrice || 0)), 
      '庫存數量': Number(p.stockQty) || 0, 
      '最低安全庫存': Number(p.minStock) || 0, 
      '備註': p.note || ''
    }));

    const dateStr = new Date().toISOString().split('T')[0];
    exportToExcel(data, `庫存清單_${dateStr}`);
  };

  const handleImport = async (file: File) => {
    if (!confirm('警告：這將會批次新增商品。是否繼續？')) return;
    setIsLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const data = await importFromExcel(file);
      console.log(`開始匯入 ${data.length} 筆資料...`, data[0]); // Log first row for debugging

      for (const row of data) {
        try {
          // Helper to find value by flexible key
          const getVal = (keywords: string[]) => {
            const key = Object.keys(row).find(k => 
              keywords.some(kw => k.replace(/\s/g, '').includes(kw.replace(/\s/g, '')))
            );
            return key ? row[key] : undefined;
          };

          const brand = getVal(['樂器品牌/出版社', '商品名稱/出版社', '品牌', '出版社']) || '';
          const itemName = getVal(['型號', '品項', '品項名稱', '商品名稱']) || '';
          
          if (!brand && !itemName) {
             console.warn('跳過空白列:', row);
             continue; 
          }

          const category = getVal(['分類']) || '樂器';
          const accountingSubject = getVal(['會計科目']);
          
          // Default subject logic based on brand
          let finalSubject = accountingSubject;
          if (!finalSubject) {
            const brandStr = String(brand || '');
            if (brandStr.includes('歐德琴')) {
              finalSubject = '樂器買賣';
            } else if (brandStr.includes('伯斯特') || brandStr.includes('音樂家小舖')) {
              finalSubject = '樂譜買賣';
            } else {
              finalSubject = '其他買賣';
            }
          }

          const costPrice = Number(getVal(['進價', '成本'])) || 0;
          const sellPrice = Number(getVal(['售價', '價格'])) || 0;
          const stockQty = Number(getVal(['庫存數量', '現有庫存', '數量'])) || 0;
          const minStock = Number(getVal(['最低安全', '安全庫存'])) || 5;

          const productId = await addProduct({
            category: String(category),
            brand: String(brand || '未分類'),
            itemName: String(itemName || '未命名商品'),
            origin: String(getVal(['產地']) || ''),
            material: String(getVal(['材質/特色', '材質']) || ''),
            accountingSubject: String(finalSubject || '其他買賣'),
            costPrice,
            sellPrice,
            stockQty: 0, 
            minStock,
            note: String(getVal(['備註']) || ''),
          });

          if (stockQty > 0) {
            await handleInventoryTransaction('STOCK_IN', {
              productId,
              qty: stockQty,
              price: costPrice,
              accountingCategory: String(finalSubject || '其他買賣'),
              operator: '系統匯入',
            });
          }
          
          successCount++;
        } catch (rowErr) {
          console.error('單筆資料匯入失敗:', row, rowErr);
          errorCount++;
        }
      }
      alert(`匯入完成！\n成功: ${successCount} 筆\n失敗: ${errorCount} 筆`);
    } catch (err: any) {
      console.error('整體匯入流程出錯:', err);
      alert('匯入失敗: ' + (err.message || '未知錯誤'));
    }
    setIsLoading(false);
  };

  const { totalRevenue, totalExpense, netProfit } = useMemo(() => {
    const r = ledgers.filter(l => l.type === 'REVENUE').reduce((sum, l) => sum + l.amount, 0);
    const e = ledgers.filter(l => l.type === 'EXPENSE').reduce((sum, l) => sum + l.amount, 0);
    return { totalRevenue: r, totalExpense: e, netProfit: r - e };
  }, [ledgers]);

  const brands = useMemo(() => Array.from(new Set(products.map(p => p.brand).filter(Boolean))).sort(), [products]);
  const categoriesList = useMemo(() => Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort(), [products]);
  const originsList = useMemo(() => Array.from(new Set(products.map(p => p.origin).filter(Boolean))).sort(), [products]);
  const materialsList = useMemo(() => Array.from(new Set(products.map(p => p.material).filter(Boolean))).sort(), [products]);

  const filteredProducts = useMemo(() => products.filter(p => {
    const query = searchQuery.toLowerCase();
    const item = (p.itemName || '').toLowerCase();
    const brand = (p.brand || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();
    const matchesSearch = searchQuery === '' || item.includes(query) || brand.includes(query) || cat.includes(query);
    const matchesBrandDropdown = brandFilter === 'ALL' || p.brand === brandFilter;
    const matchesFilters = Object.entries(columnFilters).every(([key, val]) => (p[key as keyof Product] || '').toString().toLowerCase().includes((val as string).toLowerCase()));
    return matchesSearch && matchesBrandDropdown && matchesFilters;
  }), [products, searchQuery, brandFilter, columnFilters]);

  return {
    products, ledgers, invTxs, isLoading,
    isModalOpen, setIsModalOpen,
    isProductModalOpen, setIsProductModalOpen,
    editingProduct, setEditingProduct,
    modalType, setModalType,
    selectedProduct, setSelectedProduct,
    txQty, setTxQty, txPrice, setTxPrice,
    isSubmitting,
    searchQuery, setSearchQuery,
    columnFilters, setColumnFilters,
    brandFilter, setBrandFilter,
    selectedIds, setSelectedIds,
    isBatchModalOpen, setIsBatchModalOpen,
    batchCategory, setBatchCategory,
    batchBrand, setBatchBrand,
    batchMinStock, setBatchMinStock,
    batchStockQty, setBatchStockQty,
    batchCostPrice, setBatchCostPrice,
    batchSellPrice, setBatchSellPrice,
    openTxModal, submitTransaction, openProductModal,
    handleProductSubmit, handleDeleteProduct, handleBatchUpdate, handleClearAllData,
    toggleSelect, toggleSelectAll, handleExport, handleImport,
    totalRevenue, totalExpense, netProfit,
    brands, categoriesList, originsList, materialsList, filteredProducts
  };
};
