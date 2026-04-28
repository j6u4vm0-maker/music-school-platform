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
  const [modalType, setModalType] = useState<'STOCK_IN' | 'SALES' | null>(null);
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

  const openTxModal = (product: Product, type: 'STOCK_IN' | 'SALES') => {
    setSelectedProduct(product);
    setModalType(type);
    setTxQty(1);
    setTxPrice(type === 'STOCK_IN' ? product.costPrice : product.sellPrice);
    setIsModalOpen(true);
  };

  const submitTransaction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedProduct || !modalType) return;
    setIsSubmitting(true);
    try {
      let accountingCategory = '其他收入';
      const cat = selectedProduct.category || '';
      if (cat === '樂器' || cat === '配件/周邊') accountingCategory = '樂器買賣';
      else if (cat === '樂譜' || cat === '教材/圖書') accountingCategory = '樂譜買賣';

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
    if (confirm('⚠️ 警告：這將會清除所有商品資料、進銷存紀錄以及相關財務報表，且無法復原！確定要繼續嗎？')) {
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
      const promises = Array.from(selectedIds).map(id => updateProduct(id, updates));
      await Promise.all(promises);
      setIsBatchModalOpen(false);
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
    const data = products.map(p => ({
      '分類': p.category || '樂器', '樂器品牌 / 出版社': p.brand, '品項': p.itemName,
      '產地': p.origin || '', '材質 / 特色': p.material || '', '進價': p.costPrice,
      '售價': p.sellPrice, '利潤': (p.sellPrice - p.costPrice), '庫存數量': p.stockQty, '最低安全庫存': p.minStock, '備註': p.note || ''
    }));
    exportToExcel(data, `庫存清單_${new Date().toISOString().split('T')[0]}`);
  };

  const handleImport = async (file: File) => {
    if (!confirm('警告：這將會批次新增商品。是否繼續？')) return;
    setIsLoading(true);
    try {
      const data = await importFromExcel(file);
      for (const row of data) {
        await addProduct({
          category: row['分類'] || '樂器', brand: row['樂器品牌 / 出版社'] || '未分類',
          itemName: row['品項'] || '未命名商品', origin: row['產地'] || '', material: row['材質 / 特色'] || '',
          costPrice: Number(row['進價']) || 0, sellPrice: Number(row['售價']) || 0,
          stockQty: Number(row['庫存數量']) || 0, minStock: Number(row['最低安全庫存']) || 5, note: row['備註'] || '',
        });
      }
      alert('匯入成功');
    } catch (err) { alert('匯入失敗'); }
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
    openTxModal, submitTransaction, openProductModal,
    handleProductSubmit, handleDeleteProduct, handleBatchUpdate, handleClearAllData,
    toggleSelect, toggleSelectAll, handleExport, handleImport,
    totalRevenue, totalExpense, netProfit,
    brands, categoriesList, originsList, materialsList, filteredProducts
  };
};
