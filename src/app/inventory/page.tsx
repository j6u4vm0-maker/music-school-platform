"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from 'next/navigation';
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

export default function InventoryPage() {
  const { hasPermission, profile } = useAuth();
  const router = useRouter();
  
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
    category: '',
    brand: '',
    itemName: '',
    origin: '',
    material: '',
    note: ''
  });
  const [brandFilter, setBrandFilter] = useState('ALL');
  
  // Selection State for Batch Operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchCategory, setBatchCategory] = useState('');
  const [batchBrand, setBatchBrand] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check permissions early (redirect or block if unauthorized)
  const canEdit = hasPermission('finance', 'EDIT'); 

  useEffect(() => {
    // 建立監聽器
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
    // 預設帶入進價或售價
    setTxPrice(type === 'STOCK_IN' ? product.costPrice : product.sellPrice);
    setIsModalOpen(true);
  };

  const submitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !modalType) return;
    
    setIsSubmitting(true);
    try {
      // 根據商品分類決定會計科目
      let accountingCategory = '其他收入';
      if (selectedProduct.category === '樂器') accountingCategory = '樂器買賣';
      else if (selectedProduct.category === '樂譜') accountingCategory = '樂譜買賣';
      else if (selectedProduct.category === '配件/周邊') accountingCategory = '樂器買賣';
      else if (selectedProduct.category === '教材/圖書') accountingCategory = '樂譜買賣';

      await handleInventoryTransaction(modalType, {
        productId: selectedProduct.productId!,
        qty: txQty,
        price: txPrice,
        accountingCategory,
        operator: profile?.name || '系統操作',
      });
      setIsModalOpen(false);
    } catch (error: any) {
      alert(error.message || '交易失敗，請稍後再試。');
    }
    setIsSubmitting(false);
  };

  const openProductModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
    } else {
      setEditingProduct({
        category: '樂器',
        brand: '',
        itemName: '',
        origin: '',
        material: '',
        costPrice: 0,
        sellPrice: 0,
        stockQty: 0,
        minStock: 5,
        note: '',
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
    if (confirm('確定要刪除此商品嗎？歷史水單與帳務紀錄不會被刪除，但關聯對象可能變成空缺，請謹慎操作。')) {
      try {
        await deleteProduct(id);
      } catch(err) {
        alert('刪除失敗');
      }
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
      
      if (Object.keys(updates).length === 0) {
        alert('請至少輸入或選擇一項要修改的內容（分類或品牌）');
        setIsSubmitting(false);
        return;
      }
      
      // 批次執行更新，這裡不涉及財務連動，純屬資產整理
      const promises = Array.from(selectedIds).map(id => updateProduct(id, updates));
      await Promise.all(promises);
      
      setIsBatchModalOpen(false);
      setSelectedIds(new Set());
      alert(`🎉 成功批次更新 ${selectedIds.size} 項商品的資料！`);
    } catch (err) {
      alert('批次更新失敗，請檢查網路連線。');
    }
    setIsSubmitting(false);
  };

  // Selection logic
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
      const newSet = new Set(filteredProducts.map(p => p.productId!));
      setSelectedIds(newSet);
    }
  };

  // Excel 匯出
  const handleExport = () => {
    const exportData = products.map(p => ({
      '分類': p.category || '樂器',
      '樂器品牌 / 出版社': p.brand,
      '品項': p.itemName,
      '產地': p.origin || '',
      '材質 / 特色': p.material || '',
      '進價': p.costPrice,
      '售價': p.sellPrice,
      '利潤': p.profit,
      '庫存數量': p.stockQty,
      '最低安全庫存': p.minStock,
      '備註': p.note || ''
    }));
    exportToExcel(exportData, `庫存清單_${new Date().toISOString().split('T')[0]}`);
  };

  // Excel 匯入
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('警告：這將會批次新增匯入的商品至資料庫中。是否繼續？')) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }
    
    setIsLoading(true);
    try {
      const data = await importFromExcel(file);
      let successCount = 0;
      for (const row of data) {
        const costPrice = Number(row['進價']) || 0;
        const sellPrice = Number(row['售價']) || 0;
        const stockQty = Number(row['庫存數量']) || 0;
        
        await addProduct({
          category: row['分類'] || '樂器',
          brand: row['樂器品牌 / 出版社'] || '未分類',
          itemName: row['品項'] || '未命名商品',
          origin: row['產地'] || '',
          material: row['材質 / 特色'] || '',
          costPrice,
          sellPrice,
          stockQty,
          minStock: Number(row['最低安全庫存']) || 5, // 預設安全庫存
          note: row['備註'] || '',
        });
        successCount++;
      }
      alert(`成功匯入 ${successCount} 筆商品資料！`);
    } catch (err) {
      alert('匯入失敗，請確認 Excel 格式是否包含必要欄位：分類, 樂器品牌 / 出版社, 品項, 產地, 材質 / 特色, 進價, 售價, 庫存數量, 備註');
    }
    setIsLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 1. 計算財務 KPI (總營收、總支出、淨利)
  const totalRevenue = ledgers.filter(l => l.type === 'REVENUE').reduce((sum, l) => sum + l.amount, 0);
  const totalExpense = ledgers.filter(l => l.type === 'EXPENSE').reduce((sum, l) => sum + l.amount, 0);
  const netProfit = totalRevenue - totalExpense;

  const brands = Array.from(new Set(products.map(p => p.brand).filter(Boolean))).sort();
  const categoriesList = Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort();

  const filteredProducts = products.filter(p => {
    // 全域搜尋 (支援品項、品牌、分類)
    const matchesSearch = searchQuery === '' || 
                          p.itemName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.category?.toLowerCase().includes(searchQuery.toLowerCase());

    // 以前的品牌下拉選單過濾 (保留供參考或併用)
    const matchesBrandDropdown = brandFilter === 'ALL' || p.brand === brandFilter;

    // 欄位細節過濾
    const matchesCategory = (p.category || '').toLowerCase().includes(columnFilters.category.toLowerCase());
    const matchesBrand = (p.brand || '').toLowerCase().includes(columnFilters.brand.toLowerCase());
    const matchesItemName = (p.itemName || '').toLowerCase().includes(columnFilters.itemName.toLowerCase());
    const matchesOrigin = (p.origin || '').toLowerCase().includes(columnFilters.origin.toLowerCase());
    const matchesMaterial = (p.material || '').toLowerCase().includes(columnFilters.material.toLowerCase());
    const matchesNote = (p.note || '').toLowerCase().includes(columnFilters.note.toLowerCase());

    return matchesSearch && matchesBrandDropdown && matchesCategory && matchesBrand && matchesItemName && matchesOrigin && matchesMaterial && matchesNote;
  });

  return (
    <main className="flex min-h-screen flex-col items-center pb-24 relative overflow-x-hidden bg-[#f8f7f2]">
      <div className="absolute top-[10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-[#ece4d9] blur-[150px] opacity-70 -z-10"></div>
      
      {/* Navbar */}
      <Navbar pageTitle="進銷存與零售管理" />

      <div className="w-full max-w-7xl px-4 z-10 flex flex-col gap-10 items-center">
        
        {/* Section 1: KPI 財務數據卡片 */}
        <div className="w-full animate-in slide-in-from-bottom duration-500">
           <h4 className="font-black tracking-[0.2em] text-[#4a4238] text-sm mb-4 pl-2">📊 零售財務指標 (Ledger)</h4>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
             <div className="bg-white/80 backdrop-blur-md rounded-3xl p-8 border-2 border-[#ece4d9] shadow-sm flex flex-col justify-center transition-all hover:shadow-md">
                <h3 className="font-black tracking-[0.3em] text-[#c4a484] text-xs mb-2">零售總營收 (REVENUE)</h3>
                <p className="font-mono text-4xl font-extrabold text-[#4a4238] tracking-widest">+ ${totalRevenue.toLocaleString()}</p>
             </div>
             <div className="bg-white/80 backdrop-blur-md rounded-3xl p-8 border-2 border-[#ece4d9] shadow-sm flex flex-col justify-center transition-all hover:shadow-md">
                <h3 className="font-black tracking-[0.3em] text-red-400/70 text-xs mb-2">進貨總支出 (EXPENSE)</h3>
                <p className="font-mono text-4xl font-extrabold text-[#4a4238] tracking-widest">- ${totalExpense.toLocaleString()}</p>
             </div>
             <div className="bg-[#4a4238] rounded-3xl p-8 shadow-xl flex flex-col justify-center transform hover:scale-105 transition-transform">
                <h3 className="font-black tracking-[0.3em] text-[#ece4d9]/50 text-xs mb-2">商品實質淨利 (NET)</h3>
                <p className="font-mono text-5xl font-extrabold text-white tracking-widest">${netProfit.toLocaleString()}</p>
             </div>
           </div>
        </div>

        {/* Section 2: 庫存清單與管理 */}
        <div className="w-full elegant-card p-8 md:p-12 mb-4 relative overflow-hidden shadow-lg animate-in slide-in-from-bottom duration-700">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b-2 border-[#ece4d9] pb-6 gap-6 relative z-10">
            <div>
              <h3 className="font-serif text-3xl md:text-3xl font-extrabold tracking-[0.1em] text-[#4a4238]">📦 商品庫存清單</h3>
              <p className="tracking-widest text-[#4a4238]/50 text-xs mt-2 font-bold">即時監控庫存狀態與批次處理操作</p>
            </div>
            
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex gap-2">
                <select
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="bg-[#f8f7f2] border-2 border-[#ece4d9] text-[#4a4238] rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-[#c4a484] transition-all max-w-[120px]"
                >
                  <option value="ALL">全部品牌</option>
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="搜尋品牌或品項..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full md:w-48 bg-[#f8f7f2] border-2 border-[#ece4d9] rounded-xl px-4 py-2.5 pr-8 text-xs font-bold focus:outline-none focus:border-[#c4a484] transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 text-sm">🔍</span>
                </div>
              </div>
              <div className="flex gap-2 border-l-2 border-[#ece4d9] pl-4">
                <button onClick={handleExport} className="text-[#4a4238] bg-white p-2.5 rounded-xl shadow-sm border border-[#ece4d9] hover:bg-[#ece4d9] font-bold text-xs flex items-center gap-2 transition-all">
                   📤 匯出
                </button>
                {canEdit && (
                  <>
                    <button onClick={() => fileInputRef.current?.click()} className="text-[#4a4238] bg-white p-2.5 rounded-xl shadow-sm border border-[#ece4d9] hover:bg-[#ece4d9] font-bold text-xs flex items-center gap-2 transition-all">
                       📥 匯入
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImport} hidden accept=".xlsx, .xls" />
                    <button onClick={() => openProductModal()} className="text-white bg-[#4a4238] p-2.5 px-4 rounded-xl shadow-sm border border-[#4a4238] hover:bg-[#322c26] font-bold text-xs flex items-center gap-2 transition-all ml-2 hover:-translate-y-0.5">
                       ➕ 新增商品
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border-2 border-[#ece4d9] bg-white/50 backdrop-blur-sm">
            {isLoading ? (
               <div className="p-12 text-center text-[#4a4238]/40 font-black tracking-widest animate-pulse">載入中...</div>
            ) : filteredProducts.length === 0 ? (
               <div className="p-12 text-center text-[#4a4238]/40 font-black tracking-widest">找不到相符的商品資料</div>
            ) : (
              <table className="w-full text-left font-sans text-[#4a4238]/90 min-w-[1400px]">
                <thead className="bg-[#ece4d9]/50 text-[#4a4238] uppercase tracking-widest text-[10px] font-black border-b-2 border-[#ece4d9]">
                  <tr>
                    <th className="py-4 px-6 w-16 text-center">
                       <input 
                         type="checkbox" 
                         checked={filteredProducts.length > 0 && selectedIds.size === filteredProducts.length}
                         onChange={toggleSelectAll}
                         className="w-4 h-4 rounded border-[#ece4d9] text-[#c4a484] focus:ring-[#c4a484]"
                       />
                    </th>
                    <th className="py-4 px-6 w-32">
                      分類
                      <input type="text" placeholder="篩選..." value={columnFilters.category} onClick={e => e.stopPropagation()} onChange={e => setColumnFilters({...columnFilters, category: e.target.value})} className="block w-full mt-2 font-normal bg-white border border-[#ece4d9] rounded px-2 py-1 focus:outline-none focus:border-[#c4a484] lowercase" />
                    </th>
                    <th className="py-4 px-6 w-40">
                      品牌 / 出版社
                      <input type="text" placeholder="篩選..." value={columnFilters.brand} onClick={e => e.stopPropagation()} onChange={e => setColumnFilters({...columnFilters, brand: e.target.value})} className="block w-full mt-2 font-normal bg-white border border-[#ece4d9] rounded px-2 py-1 focus:outline-none focus:border-[#c4a484] lowercase" />
                    </th>
                    <th className="py-4 px-6 w-56">
                      品項名稱
                      <input type="text" placeholder="篩選..." value={columnFilters.itemName} onClick={e => e.stopPropagation()} onChange={e => setColumnFilters({...columnFilters, itemName: e.target.value})} className="block w-full mt-2 font-normal bg-white border border-[#ece4d9] rounded px-2 py-1 focus:outline-none focus:border-[#c4a484] lowercase" />
                    </th>
                    <th className="py-4 px-6 w-32">
                      產地
                      <input type="text" placeholder="篩選..." value={columnFilters.origin} onClick={e => e.stopPropagation()} onChange={e => setColumnFilters({...columnFilters, origin: e.target.value})} className="block w-full mt-2 font-normal bg-white border border-[#ece4d9] rounded px-2 py-1 focus:outline-none focus:border-[#c4a484] lowercase" />
                    </th>
                    <th className="py-4 px-6 w-40">
                      材質 / 特色
                      <input type="text" placeholder="篩選..." value={columnFilters.material} onClick={e => e.stopPropagation()} onChange={e => setColumnFilters({...columnFilters, material: e.target.value})} className="block w-full mt-2 font-normal bg-white border border-[#ece4d9] rounded px-2 py-1 focus:outline-none focus:border-[#c4a484] lowercase" />
                    </th>
                    <th className="py-4 px-6 text-right w-24">進價</th>
                    <th className="py-4 px-6 text-right w-24">售價</th>
                    <th className="py-4 px-6 text-right w-24">利潤</th>
                    <th className="py-4 px-6 text-center w-28">庫存數量</th>
                    <th className="py-4 px-6 text-center w-28">安全庫存</th>
                    <th className="py-4 px-6 w-48">
                      備註
                      <input type="text" placeholder="篩選..." value={columnFilters.note} onClick={e => e.stopPropagation()} onChange={e => setColumnFilters({...columnFilters, note: e.target.value})} className="block w-full mt-2 font-normal bg-white border border-[#ece4d9] rounded px-2 py-1 focus:outline-none focus:border-[#c4a484] lowercase" />
                    </th>
                    <th className="py-4 px-6 text-center w-52 sticky right-0 bg-[#f8f7f2]/95 backdrop-blur-sm z-20">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece4d9]/50">
                  {filteredProducts.map(p => (
                    <tr key={p.productId} className={`hover:bg-white/80 transition-colors ${selectedIds.has(p.productId!) ? 'bg-[#c4a484]/5' : ''}`}>
                      <td className="py-4 px-6 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(p.productId!)}
                          onChange={() => toggleSelect(p.productId!)}
                          className="w-4 h-4 rounded border-[#ece4d9] text-[#c4a484] focus:ring-[#c4a484]"
                        />
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.category === '樂譜' ? 'bg-indigo-100 text-indigo-600' : p.category === '樂器' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'}`}>
                          {p.category || '未分類'}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-bold text-xs opacity-70">{p.brand}</td>
                      <td className="py-4 px-6 font-black text-sm">{p.itemName}</td>
                      <td className="py-4 px-6 text-xs opacity-60">{p.origin || '-'}</td>
                      <td className="py-4 px-6 text-xs italic opacity-70">{p.material || '-'}</td>
                      <td className="py-4 px-6 text-right font-mono text-xs opacity-60">${p.costPrice}</td>
                      <td className="py-4 px-6 text-right font-mono text-sm font-bold text-[#c4a484]">${p.sellPrice}</td>
                      <td className="py-4 px-6 text-right font-mono text-xs font-bold text-emerald-600/80">${p.profit}</td>
                      <td className="py-4 px-6 text-center">
                         <span className={`inline-block px-3 py-1 rounded-full text-xs font-black font-mono ${p.stockQty <= p.minStock ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-[#ece4d9] text-[#4a4238]'}`}>
                            {p.stockQty}
                         </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                         <span className="inline-block px-3 py-1 rounded-full bg-white border border-[#ece4d9] text-[#4a4238]/50 text-xs font-black font-mono">
                            {p.minStock}
                         </span>
                      </td>
                      <td className="py-4 px-6 text-xs opacity-50 truncate max-w-[150px]" title={p.note}>{p.note || '-'}</td>
                      <td className="py-4 px-6 relative z-10 sticky right-0 bg-white/95 backdrop-blur-sm shadow-[-10px_0_15px_rgba(0,0,0,0.02)]">
                        <div className="flex flex-wrap gap-1.5 justify-center">
                          <button 
                            onClick={() => openTxModal(p, 'SALES')}
                            className="bg-[#c4a484]/10 hover:bg-[#c4a484]/20 text-[#c4a484] border border-[#c4a484]/30 px-2 py-1 rounded text-[10px] font-black tracking-widest transition-colors scale-95"
                          >
                            💰 售出
                          </button>
                          {canEdit && (
                            <>
                              <button 
                                onClick={() => openTxModal(p, 'STOCK_IN')}
                                className="bg-[#4a4238]/5 hover:bg-[#4a4238]/10 text-[#4a4238] border border-[#4a4238]/20 px-2 py-1 rounded text-[10px] font-black tracking-widest transition-colors scale-95"
                              >
                                📥 進貨
                              </button>
                              <button 
                                onClick={() => openProductModal(p)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-500 border border-blue-200 px-2 py-1 rounded text-[10px] font-black tracking-widest transition-colors scale-95"
                              >
                                ✎ 編輯
                              </button>
                              <button 
                                onClick={() => handleDeleteProduct(p.productId!)}
                                className="bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 px-2 py-1 rounded text-[10px] font-black tracking-widest transition-colors scale-95"
                              >
                                ✕
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Section 3: 交易紀錄表 */}
        <div className="w-full flex flex-col md:flex-row gap-6 animate-in slide-in-from-bottom duration-1000">
          <div className="flex-1 bg-white p-6 rounded-3xl border-2 border-[#ece4d9] shadow-sm overflow-hidden flex flex-col">
            <h4 className="font-black tracking-[0.2em] text-[#4a4238] text-sm mb-4 border-b-2 border-gray-50 pb-3 flex items-center gap-2">
              <span className="text-[#c4a484]">📋 近期進銷紀錄</span> (Inventory Logs)
            </h4>
            <div className="overflow-y-auto max-h-80 pr-2 custom-scrollbar">
              {invTxs.length === 0 ? <p className="text-center text-xs opacity-40 py-10 font-bold tracking-widest">無相關紀錄</p> : (
                <div className="flex flex-col gap-3">
                  {invTxs.map(tx => {
                    const matchedProduct = products.find(p => p.productId === tx.productId);
                    const txDate = new Date(tx.timestamp).toLocaleString('zh-TW', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
                    return (
                      <div key={tx.id} className={`p-4 rounded-2xl flex justify-between items-center bg-gray-50 border-l-4 ${tx.type==='IN_STOCK' ? 'border-l-blue-400' : 'border-l-[#c4a484]'}`}>
                        <div>
                          <p className="text-xs font-black text-[#4a4238]">{matchedProduct ? matchedProduct.itemName : '已刪除商品'}</p>
                          <p className="text-[10px] font-bold text-[#4a4238]/40 tracking-widest mt-1">{txDate} | 經手: {tx.operator}</p>
                        </div>
                        <div className={`font-mono font-black text-lg ${tx.type==='IN_STOCK' ? 'text-blue-500' : 'text-[#c4a484]'}`}>
                          {tx.type==='IN_STOCK' ? '+' : ''}{tx.qtyChange}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 bg-white p-6 rounded-3xl border-2 border-[#ece4d9] shadow-sm overflow-hidden flex flex-col">
            <h4 className="font-black tracking-[0.2em] text-[#4a4238] text-sm mb-4 border-b-2 border-gray-50 pb-3 flex items-center gap-2">
              <span className="text-[#c4a484]">💰 帳本連動紀錄</span> (Ledger Logs)
            </h4>
            <div className="overflow-y-auto max-h-80 pr-2 custom-scrollbar">
              {ledgers.length === 0 ? <p className="text-center text-xs opacity-40 py-10 font-bold tracking-widest">無帳務紀錄</p> : (
                <div className="flex flex-col gap-3">
                  {ledgers.map(l => {
                    const lDate = new Date(l.timestamp).toLocaleString('zh-TW', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
                    return (
                      <div key={l.id} className="p-4 rounded-2xl flex justify-between items-center bg-gray-50 border border-gray-100">
                        <div>
                          <span className="text-[10px] bg-[#ece4d9] text-[#4a4238] font-black px-2 py-0.5 rounded-full mb-1 inline-block tracking-widest">{l.category}</span>
                          <p className="text-[10px] font-bold text-[#4a4238]/40 tracking-widest mt-1">時間: {lDate}</p>
                        </div>
                        <div className={`font-mono font-black text-lg ${l.type==='REVENUE' ? 'text-emerald-500' : 'text-red-400'}`}>
                          {l.type==='REVENUE' ? '+' : '-'}${l.amount.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Batch Edit Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4" onClick={() => setIsBatchModalOpen(false)}>
          <div className="bg-[#f8f7f2] w-full max-w-md rounded-[40px] p-8 md:p-12 shadow-2xl relative border-2 border-white" onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsBatchModalOpen(false)} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white text-[#4a4238] font-bold shadow-sm hover:bg-gray-50 transition-colors flex items-center justify-center">✕</button>
            
            <div className="mb-8 text-center">
              <div className="w-16 h-16 bg-[#c4a484]/20 rounded-3xl flex items-center justify-center mx-auto mb-4 text-2xl">⚡</div>
              <h2 className="text-2xl font-black text-[#4a4238]">批次快速修改</h2>
              <p className="text-xs font-bold text-[#4a4238]/50 tracking-widest mt-2">正在針對已選取的 {selectedIds.size} 項商品進行調整</p>
            </div>

            <form onSubmit={handleBatchUpdate} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                 <label className="text-xs font-black text-[#4a4238] tracking-widest ml-1">套用新分類 (Batch Category)</label>
                 <input 
                   list="category-options"
                   value={batchCategory} 
                   onChange={e => setBatchCategory(e.target.value)} 
                   className="w-full bg-white border-2 border-[#ece4d9] p-4 rounded-2xl focus:outline-none focus:border-[#c4a484] font-bold text-sm"
                   placeholder="留空表示不變動分類..."
                 />
              </div>

              <div className="flex flex-col gap-2">
                 <label className="text-xs font-black text-[#4a4238] tracking-widest ml-1">套用新品牌 (Batch Brand)</label>
                 <input 
                   list="brand-options"
                   value={batchBrand} 
                   onChange={e => setBatchBrand(e.target.value)} 
                   className="w-full bg-white border-2 border-[#ece4d9] p-4 rounded-2xl focus:outline-none focus:border-[#c4a484] font-bold text-sm"
                   placeholder="留空表示不變動品牌..."
                 />
              </div>

              <div className="bg-[#ece4d9]/30 p-4 rounded-2xl border border-[#ece4d9] flex items-center gap-3">
                 <span className="text-xl">⚠️</span>
                 <p className="text-[10px] font-bold text-[#4a4238]/60 leading-relaxed">
                   注意：批次修改會直接覆蓋所有選中商品的對應欄位，請確認資料正確。
                 </p>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full py-4 bg-[#4a4238] hover:bg-[#322c26] text-white rounded-full font-black tracking-[0.2em] text-sm transition-all shadow-xl hover:-translate-y-1 disabled:opacity-50"
              >
                {isSubmitting ? '正在處理中...' : '確認並全數套用'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {isModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-[#f8f7f2] w-full max-w-md rounded-[40px] p-8 md:p-12 shadow-2xl relative border-2 border-[#ece4d9]" onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white text-[#4a4238] font-bold shadow-sm hover:bg-gray-50 transition-colors flex items-center justify-center">✕</button>
            
            <div className="mb-6 text-center">
              <span className={`inline-block px-4 py-1 rounded-full text-[10px] font-black tracking-[0.2em] mb-4 ${modalType === 'STOCK_IN' ? 'bg-[#4a4238] text-white' : 'bg-[#c4a484] text-white'}`}>
                {modalType === 'STOCK_IN' ? 'IN STOCK / 進貨入庫' : 'SALES / 結帳售出'}
              </span>
              <h2 className="text-2xl font-black text-[#4a4238]">{selectedProduct.itemName}</h2>
              <p className="text-xs font-bold text-[#4a4238]/50 tracking-widest mt-1">目前剩餘數量: {selectedProduct.stockQty}</p>
            </div>

            <form onSubmit={submitTransaction} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                 <label className="text-xs font-black text-[#4a4238] tracking-widest ml-2">處理數量 (QTY)</label>
                 <input 
                   type="number" 
                   min="1" 
                   max={modalType === 'SALES' ? selectedProduct.stockQty : undefined}
                   required
                   value={txQty}
                   onChange={e => setTxQty(Number(e.target.value))}
                   className="bg-white border-2 border-[#ece4d9] p-4 rounded-2xl focus:outline-none focus:border-[#c4a484] font-mono text-xl font-bold"
                 />
                 {modalType === 'SALES' && txQty > selectedProduct.stockQty && (
                   <p className="text-red-500 text-[10px] font-bold ml-2">警告：欲售出數量大於現有庫存！</p>
                 )}
              </div>
              <div className="flex flex-col gap-2">
                 <label className="text-xs font-black text-[#4a4238] tracking-widest ml-2">
                   {modalType === 'STOCK_IN' ? '單位進價 (Cost Price)' : '單位售價 (Sell Price)'}
                 </label>
                 <div className="relative">
                   <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-gray-400 font-bold">$</span>
                   <input 
                     type="number" 
                     min="0"
                     required
                     value={txPrice}
                     onChange={e => setTxPrice(Number(e.target.value))}
                     className="w-full bg-white border-2 border-[#ece4d9] p-4 pl-8 rounded-2xl focus:outline-none focus:border-[#c4a484] font-mono text-xl font-bold"
                   />
                 </div>
              </div>
              
              <div className="mt-4 bg-[#ece4d9]/30 p-4 rounded-2xl border border-[#ece4d9] text-center flex flex-col gap-1">
                 <p className="text-[10px] font-bold tracking-widest text-[#4a4238]/60 uppercase">
                    {modalType === 'STOCK_IN' ? 'Estimated Expense (總支出)' : 'Estimated Revenue (總收入)'}
                 </p>
                 <p className="font-mono text-3xl font-black text-[#4a4238]">
                    ${ (txQty * txPrice).toLocaleString() }
                 </p>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting || (modalType === 'SALES' && txQty > selectedProduct.stockQty)}
                className={`w-full mt-4 py-4 rounded-full font-black tracking-[0.2em] text-sm transition-all shadow-md
                  ${isSubmitting ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 
                  modalType === 'STOCK_IN' ? 'bg-[#4a4238] hover:bg-[#322c26] text-white hover:shadow-xl hover:-translate-y-1' : 
                  'bg-[#c4a484] hover:bg-[#b08d6d] text-white hover:shadow-xl hover:-translate-y-1'}
                  disabled:opacity-50 disabled:hover:translate-y-0
                `}
              >
                {isSubmitting ? '處理中...' : '確認執行'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Product CRUD Modal */}
      {isProductModalOpen && editingProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsProductModalOpen(false)}>
          <div className="bg-[#f8f7f2] w-full max-w-lg rounded-[40px] p-8 shadow-2xl relative border-2 border-[#ece4d9] overflow-y-auto max-h-[90vh] custom-scrollbar" onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsProductModalOpen(false)} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white text-[#4a4238] font-bold shadow-sm hover:bg-gray-50 transition-colors flex items-center justify-center">✕</button>
            
            <div className="mb-6">
              <span className="inline-block px-4 py-1 rounded-full text-[10px] font-black tracking-[0.2em] mb-2 bg-[#4a4238] text-white">
                { (editingProduct as Product).productId ? 'EDIT PRODUCT / 編輯商品' : 'NEW PRODUCT / 新增商品' }
              </span>
              <h2 className="text-2xl font-black text-[#4a4238]">商品基本資料維護</h2>
            </div>

            <form onSubmit={handleProductSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                   <label className="text-xs font-black text-[#4a4238] tracking-widest ml-1">商品分類 (Category)</label>
                   <input 
                     list="category-options"
                     value={editingProduct.category} 
                     onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} 
                     className="w-full bg-white border-2 border-[#ece4d9] p-3 rounded-2xl focus:outline-none focus:border-[#c4a484] font-bold text-sm"
                     placeholder="請輸入或選擇分類..."
                   />
                   <datalist id="category-options">
                     {['樂器', '樂譜', '配件/周邊', '教材/圖書', '其他', ...categoriesList].map(c => <option key={c} value={c} />)}
                   </datalist>
                </div>
                <div className="flex flex-col gap-2">
                   <label className="text-xs font-black text-[#4a4238] tracking-widest ml-1">目前庫存 (Stock)</label>
                   <input type="number" min="0" required value={editingProduct.stockQty} onChange={e => setEditingProduct({...editingProduct, stockQty: Number(e.target.value)})} className="w-full bg-gray-50 border-2 border-[#ece4d9] p-3 rounded-2xl focus:outline-none focus:border-[#c4a484] font-mono text-sm font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                   <label className="text-xs font-black text-[#4a4238] tracking-widest ml-1">品牌 / 出版社</label>
                   <input 
                     type="text" 
                     list="brand-options"
                     required 
                     value={editingProduct.brand} 
                     onChange={e => setEditingProduct({...editingProduct, brand: e.target.value})} 
                     className="w-full bg-white border-2 border-[#ece4d9] p-3 rounded-2xl focus:outline-none focus:border-[#c4a484] font-bold text-sm" 
                     placeholder="輸入第一個字自動提示..."
                   />
                   <datalist id="brand-options">
                     {brands.map(b => <option key={b} value={b} />)}
                   </datalist>
                </div>
                <div className="flex flex-col gap-2">
                   <label className="text-xs font-black text-[#4a4238] tracking-widest ml-1">品項名稱 (Item Name)</label>
                   <input type="text" required value={editingProduct.itemName} onChange={e => setEditingProduct({...editingProduct, itemName: e.target.value})} className="w-full bg-white border-2 border-[#ece4d9] p-3 rounded-2xl focus:outline-none focus:border-[#c4a484] font-bold text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                   <label className="text-xs font-black text-[#4a4238] tracking-widest ml-1">產地 (Origin)</label>
                   <input type="text" value={editingProduct.origin} onChange={e => setEditingProduct({...editingProduct, origin: e.target.value})} className="w-full bg-white border-2 border-[#ece4d9] p-3 rounded-2xl focus:outline-none focus:border-[#c4a484] font-bold text-sm" />
                </div>
                <div className="flex flex-col gap-2">
                   <label className="text-xs font-black text-[#4a4238] tracking-widest ml-1">材質 / 特色 (Material)</label>
                   <input type="text" value={editingProduct.material} onChange={e => setEditingProduct({...editingProduct, material: e.target.value})} className="w-full bg-white border-2 border-[#ece4d9] p-3 rounded-2xl focus:outline-none focus:border-[#c4a484] font-bold text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2 relative">
                   <label className="text-xs font-black text-[#4a4238] tracking-widest ml-1">標準進價 (Cost)</label>
                   <input type="number" min="0" required value={editingProduct.costPrice} onChange={e => setEditingProduct({...editingProduct, costPrice: Number(e.target.value)})} className="w-full bg-white border-2 border-[#ece4d9] p-3 pl-8 rounded-2xl focus:outline-none focus:border-[#c4a484] font-mono text-sm font-bold" />
                   <span className="absolute left-3 bottom-[14px] font-mono text-gray-400 font-bold">$</span>
                </div>
                <div className="flex flex-col gap-2 relative">
                   <label className="text-xs font-black text-[#4a4238] tracking-widest ml-1">標準售價 (Sell)</label>
                   <input type="number" min="0" required value={editingProduct.sellPrice} onChange={e => setEditingProduct({...editingProduct, sellPrice: Number(e.target.value)})} className="w-full bg-white border-2 border-[#ece4d9] p-3 pl-8 rounded-2xl focus:outline-none focus:border-[#c4a484] font-mono text-sm font-bold" />
                   <span className="absolute left-3 bottom-[14px] font-mono text-gray-400 font-bold">$</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                   <label className="text-xs font-black text-[#4a4238] tracking-widest ml-1">最低安全庫存 (Min Stock)</label>
                   <input type="number" min="0" required value={editingProduct.minStock} onChange={e => setEditingProduct({...editingProduct, minStock: Number(e.target.value)})} className="w-full bg-white border-2 border-[#ece4d9] p-3 rounded-2xl focus:outline-none focus:border-[#c4a484] font-mono text-sm font-bold" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                 <label className="text-xs font-black text-[#4a4238] tracking-widest ml-1">商品備註 (Notes)</label>
                 <textarea rows={2} value={editingProduct.note} onChange={e => setEditingProduct({...editingProduct, note: e.target.value})} className="w-full bg-white border-2 border-[#ece4d9] p-3 rounded-2xl focus:outline-none focus:border-[#c4a484] font-bold text-sm resize-none" />
              </div>

              <button type="submit" disabled={isSubmitting} className={`w-full mt-4 py-4 rounded-full font-black tracking-[0.2em] text-sm transition-all shadow-md bg-[#4a4238] hover:bg-[#322c26] text-white hover:shadow-xl hover:-translate-y-1 disabled:opacity-50`}>
                {isSubmitting ? '儲存中...' : '確認儲存'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom duration-300">
          <div className="bg-[#4a4238] text-white px-8 py-4 rounded-full shadow-2xl border-2 border-white/20 flex items-center gap-6 backdrop-blur-md">
            <div className="flex flex-col">
              <p className="text-[10px] font-black tracking-widest opacity-50 uppercase">Selected Items</p>
              <p className="text-sm font-black tracking-widest">已選擇 {selectedIds.size} 項商品</p>
            </div>
            <div className="h-8 w-px bg-white/10"></div>
            <div className="flex gap-3">
              <button 
                onClick={() => { setBatchCategory(''); setBatchBrand(''); setIsBatchModalOpen(true); }}
                className="bg-[#c4a484] hover:bg-[#b08d6d] text-white px-5 py-2 rounded-full text-xs font-black tracking-widest transition-all shadow-lg hover:-translate-y-0.5"
              >
                ⚡ 批次修改
              </button>
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-full text-xs font-black tracking-widest transition-all"
              >
                取消選擇
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Custom Scrollbar Style for the modal and lists */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #ece4d9;
          border-radius: 20px;
        }
      `}} />
    </main>
  );
}
