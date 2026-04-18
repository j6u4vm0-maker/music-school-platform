"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import Navbar from '@/components/layout/Navbar';
import { exportToExcel, importFromExcel } from '@/lib/utils/excel';
import { 
  Product, 
  subscribeToProducts, 
  subscribeToFinancialLedgers, 
  subscribeToInventoryTransactions,
  handleInventoryTransaction,
  addProduct,
  updateProduct,
  deleteProduct
} from '@/lib/services/inventory';

// New Components
import ProductTable from '@/components/inventory/ProductTable';
import InventoryDashboard from '@/components/inventory/InventoryDashboard';
import ProductModal from '@/components/inventory/ProductModal';
import InventoryTransactionModal from '@/components/inventory/InventoryTransactionModal';

export default function InventoryPage() {
  const { hasPermission, profile } = useAuth();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [invTxs, setInvTxs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State for Transactions
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Modal State for Product CRUD
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | Partial<Product> | null>(null);
  const [modalType, setModalType] = useState<'STOCK_IN' | 'SALES' | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [txQty, setTxQty] = useState(1);
  const [txPrice, setTxPrice] = useState(0); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [columnFilters, setColumnFilters] = useState({
    category: '', brand: '', itemName: '', origin: '', material: '', note: ''
  });
  const [brandFilter, setBrandFilter] = useState('ALL');
  
  // Selection State for Batch Operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchCategory, setBatchCategory] = useState('');
  const [batchBrand, setBatchBrand] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canEdit = hasPermission('finance', 'EDIT'); 

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

  const submitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
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
        operator: profile?.name || '系統操作',
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

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleBatchUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const toggleSelectAll = () => {
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
      '售價': p.sellPrice, '利潤': p.profit, '庫存數量': p.stockQty, '最低安全庫存': p.minStock, '備註': p.note || ''
    }));
    exportToExcel(data, `庫存清單_${new Date().toISOString().split('T')[0]}`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !confirm('警告：這將會批次新增商品。是否繼續？')) return;
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const { totalRevenue, totalExpense, netProfit } = useMemo(() => {
    const r = ledgers.filter(l => l.type === 'REVENUE').reduce((sum, l) => sum + l.amount, 0);
    const e = ledgers.filter(l => l.type === 'EXPENSE').reduce((sum, l) => sum + l.amount, 0);
    return { totalRevenue: r, totalExpense: e, netProfit: r - e };
  }, [ledgers]);

  const brands = useMemo(() => Array.from(new Set(products.map(p => p.brand).filter(Boolean))).sort(), [products]);
  const categoriesList = useMemo(() => Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort(), [products]);

  const filteredProducts = useMemo(() => products.filter(p => {
    const query = searchQuery.toLowerCase();
    const item = (p.itemName || '').toLowerCase();
    const brand = (p.brand || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();
    const matchesSearch = searchQuery === '' || item.includes(query) || brand.includes(query) || cat.includes(query);
    const matchesBrandDropdown = brandFilter === 'ALL' || p.brand === brandFilter;
    const matchesFilters = Object.entries(columnFilters).every(([key, val]) => (p[key] || '').toLowerCase().includes(val.toLowerCase()));
    return matchesSearch && matchesBrandDropdown && matchesFilters;
  }), [products, searchQuery, brandFilter, columnFilters]);

  return (
    <main className="flex min-h-screen flex-col items-center pb-24 relative overflow-x-hidden bg-[#f8f7f2] animate-fade-in">
      <div className="absolute top-[10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-[#ece4d9] blur-[150px] opacity-70 -z-10 animate-pulse"></div>
      <Navbar pageTitle="進銷存與零售管理" />

      <div className="w-full max-w-7xl px-4 z-10 flex flex-col gap-10 items-center">
        <InventoryDashboard 
          totalRevenue={totalRevenue} totalExpense={totalExpense} netProfit={netProfit} 
          invTxs={invTxs} ledgers={ledgers} products={products} 
        />

        <ProductTable 
          filteredProducts={filteredProducts} selectedIds={selectedIds} 
          toggleSelect={toggleSelect} toggleSelectAll={toggleSelectAll}
          columnFilters={columnFilters} setColumnFilters={setColumnFilters}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          brandFilter={brandFilter} setBrandFilter={setBrandFilter}
          brands={brands} isLoading={isLoading} canEdit={canEdit}
          openTxModal={openTxModal} openProductModal={openProductModal}
          handleDeleteProduct={handleDeleteProduct} handleExport={handleExport}
          handleImportClick={() => fileInputRef.current?.click()}
        />
        <input type="file" ref={fileInputRef} onChange={handleImport} hidden accept=".xlsx, .xls" />
      </div>

      <ProductModal 
        isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)}
        editingProduct={editingProduct} setEditingProduct={setEditingProduct}
        onSubmit={handleProductSubmit} isSubmitting={isSubmitting}
        categoriesList={categoriesList} brands={brands}
      />

      <InventoryTransactionModal 
        isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        selectedProduct={selectedProduct} modalType={modalType}
        txQty={txQty} setTxQty={setTxQty} txPrice={txPrice} setTxPrice={setTxPrice}
        onSubmit={submitTransaction} isSubmitting={isSubmitting}
      />

      {/* Batch Modal Logic */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4" onClick={() => setIsBatchModalOpen(false)}>
          <div className="bg-[#f8f7f2] w-full max-w-md rounded-[40px] p-8 md:p-12 shadow-2xl relative border-2 border-white" onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsBatchModalOpen(false)} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white text-[#4a4238] font-bold shadow-sm hover:bg-gray-50 transition-colors flex items-center justify-center">✕</button>
            <div className="mb-8 text-center">
              <div className="w-16 h-16 bg-[#c4a480]/20 rounded-3xl flex items-center justify-center mx-auto mb-4 text-2xl">⚡</div>
              <h2 className="text-2xl font-black text-[#4a4238]">批次快速修改</h2>
              <p className="text-xs font-bold text-[#4a4238]/50 tracking-widest mt-2">正在針對已選取的 {selectedIds.size} 項商品進行調整</p>
            </div>
            <form onSubmit={handleBatchUpdate} className="flex flex-col gap-6">
              <input value={batchCategory} onChange={e => setBatchCategory(e.target.value)} className="w-full bg-white border-2 border-[#ece4d9] p-4 rounded-2xl focus:outline-none focus:border-[#c4a484] font-bold text-sm" placeholder="套用新分類..." />
              <input value={batchBrand} onChange={e => setBatchBrand(e.target.value)} className="w-full bg-white border-2 border-[#ece4d9] p-4 rounded-2xl focus:outline-none focus:border-[#c4a484] font-bold text-sm" placeholder="套用新品牌..." />
              <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-[#4a4238] hover:bg-[#322c26] text-white rounded-full font-black tracking-[0.2em] text-sm transition-all shadow-xl hover:-translate-y-1">確認全數套用</button>
            </form>
          </div>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom duration-300">
          <div className="bg-[#4a4238] text-white px-8 py-4 rounded-full shadow-2xl border-2 border-white/20 flex items-center gap-6 backdrop-blur-md">
            <p className="text-sm font-black tracking-widest">已選擇 {selectedIds.size} 項商品</p>
            <button onClick={() => { setBatchCategory(''); setBatchBrand(''); setIsBatchModalOpen(true); }} className="bg-[#c4a480] hover:bg-[#b08d6d] text-white px-5 py-2 rounded-full text-xs font-black tracking-widest transition-all shadow-lg">⚡ 批次修改</button>
            <button onClick={() => setSelectedIds(new Set())} className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-full text-xs font-black tracking-widest transition-all">取消</button>
          </div>
        </div>
      )}
    </main>
  );
}
