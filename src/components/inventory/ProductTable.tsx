import React, { useState } from 'react';
import { Product } from '@/lib/types/inventory';

interface ProductTableProps {
  filteredProducts: Product[];
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  columnFilters: any;
  setColumnFilters: (filters: any) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  brandFilter: string;
  setBrandFilter: (b: string) => void;
  brands: string[];
  categoriesList: string[];
  originsList: string[];
  materialsList: string[];
  isLoading: boolean;
  canEdit: boolean;
  openTxModal: (p: Product, type: 'STOCK_IN' | 'SALES' | 'SALES_RETURN' | 'PURCHASE_RETURN') => void;
  openProductModal: (p?: Product) => void;
  handleExport: () => void;
  handleImportClick: () => void;
}

export default function ProductTable({
  filteredProducts,
  selectedIds,
  toggleSelect,
  toggleSelectAll,
  columnFilters,
  setColumnFilters,
  searchQuery,
  setSearchQuery,
  brandFilter,
  setBrandFilter,
  brands,
  categoriesList,
  originsList,
  materialsList,
  isLoading,
  canEdit,
  openTxModal,
  openProductModal,
  handleExport,
  handleImportClick
}: ProductTableProps) {

  // 新增欄位顯示控制狀態
  const [visibleColumns, setVisibleColumns] = useState({
    category: true,
    brand: true,
    itemName: true,
    origin: true,
    material: true,
    costPrice: true,
    sellPrice: true,
    profit: true,
    stockQty: true,
    minStock: true,
    note: true,
  });
  const [showColumnToggle, setShowColumnToggle] = useState(false);

  const toggleColumn = (col: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  const COLUMNS = [
    { id: 'category', name: '分類' },
    { id: 'brand', name: '品牌 / 出版社' },
    { id: 'itemName', name: '品項名稱' },
    { id: 'origin', name: '產地' },
    { id: 'material', name: '材質 / 特色' },
    { id: 'costPrice', name: '進價' },
    { id: 'sellPrice', name: '售價' },
    { id: 'profit', name: '利潤' },
    { id: 'stockQty', name: '庫存數量' },
    { id: 'minStock', name: '安全庫存' },
    { id: 'note', name: '備註' },
  ];

  return (
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
              className="bg-[#f8f7f2] border-2 border-[#ece4d9] text-[#4a4238] rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-[#c4a480] transition-all max-w-[120px]"
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
                className="w-full md:w-48 bg-[#f8f7f2] border-2 border-[#ece4d9] rounded-xl px-4 py-2.5 pr-8 text-xs font-bold focus:outline-none focus:border-[#c4a480] transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 text-sm">🔍</span>
            </div>
          </div>
          <div className="flex gap-2 border-l-2 border-[#ece4d9] pl-4">
            <div className="relative">
              <button 
                onClick={() => setShowColumnToggle(!showColumnToggle)} 
                className={`text-[#4a4238] bg-white p-2.5 rounded-xl shadow-sm border border-[#ece4d9] hover:bg-[#ece4d9] font-bold text-xs flex items-center gap-2 transition-all ${showColumnToggle ? 'ring-2 ring-[#c4a484]/20 bg-[#ece4d9]' : ''}`}
              >
                 ⚙️ 欄位顯示
              </button>
              {showColumnToggle && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowColumnToggle(false)}></div>
                  <div className="absolute right-0 mt-2 w-56 bg-white border-2 border-[#ece4d9] rounded-2xl shadow-2xl z-50 p-4 animate-in fade-in zoom-in duration-200">
                    <h4 className="text-[10px] font-black tracking-widest text-[#4a4238]/40 uppercase mb-3 px-2">自定義顯示欄位</h4>
                    <div className="flex flex-col gap-1">
                      {COLUMNS.map(col => (
                        <label key={col.id} className="flex items-center gap-3 px-3 py-2 hover:bg-[#f8f7f2] rounded-xl cursor-pointer transition-colors group">
                          <input 
                            type="checkbox" 
                            checked={visibleColumns[col.id as keyof typeof visibleColumns]} 
                            onChange={() => toggleColumn(col.id as keyof typeof visibleColumns)}
                            className="w-4 h-4 rounded border-[#ece4d9] text-[#c4a484] focus:ring-[#c4a484]"
                          />
                          <span className={`text-xs font-bold transition-colors ${visibleColumns[col.id as keyof typeof visibleColumns] ? 'text-[#4a4238]' : 'text-[#4a4238]/30'}`}>{col.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <button onClick={handleExport} className="text-[#4a4238] bg-white p-2.5 rounded-xl shadow-sm border border-[#ece4d9] hover:bg-[#ece4d9] font-bold text-xs flex items-center gap-2 transition-all">
               📤 匯出
            </button>
            {canEdit && (
              <>
                <button onClick={handleImportClick} className="text-[#4a4238] bg-white p-2.5 rounded-xl shadow-sm border border-[#ece4d9] hover:bg-[#ece4d9] font-bold text-xs flex items-center gap-2 transition-all">
                   📥 匯入
                </button>
                <button onClick={() => openProductModal()} className="text-white bg-[#4a4238] p-2.5 px-4 rounded-xl shadow-sm border border-[#4a4238] hover:bg-[#322c26] font-bold text-xs flex items-center gap-2 transition-all ml-2 hover:-translate-y-0.5">
                   ➕ 新增商品
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border-2 border-[#ece4d9] bg-white/50 backdrop-blur-sm">
        {/* 分類快速切換 Tabs */}
        {!isLoading && (
          <div className="flex items-center gap-2 p-4 border-b border-[#ece4d9] bg-[#f8f7f2]/30 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setColumnFilters({ ...columnFilters, category: '' })}
              className={`px-6 py-2 rounded-xl text-xs font-black tracking-widest transition-all whitespace-nowrap ${
                !columnFilters.category 
                  ? 'bg-[#4a4238] text-white shadow-md' 
                  : 'text-[#4a4238]/40 hover:bg-[#ece4d9] hover:text-[#4a4238]'
              }`}
            >
              全部 ALL
            </button>
            {categoriesList.map(cat => (
              <button
                key={cat}
                onClick={() => setColumnFilters({ ...columnFilters, category: cat })}
                className={`px-6 py-2 rounded-xl text-xs font-black tracking-widest transition-all whitespace-nowrap ${
                  columnFilters.category === cat 
                    ? 'bg-[#c4a484] text-white shadow-md' 
                    : 'text-[#4a4238]/40 hover:bg-[#ece4d9] hover:text-[#4a4238]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
           <div className="p-12 text-center text-[#4a4238]/40 font-black tracking-widest animate-pulse">載入中...</div>
        ) : (
          <table className="w-full text-left font-sans text-[#4a4238]/90 min-w-[1000px]">
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
                {visibleColumns.category && (
                  <th className="py-4 px-6 w-32">
                    分類
                    <select 
                      value={columnFilters.category} 
                      onClick={e => e.stopPropagation()} 
                      onChange={e => setColumnFilters({...columnFilters, category: e.target.value})} 
                      className="block w-full mt-2 font-normal bg-white border border-[#ece4d9] rounded px-3 py-2 pr-8 focus:outline-none focus:border-[#c4a484] text-xs cursor-pointer shadow-sm hover:border-[#c4a484]/50 transition-colors min-w-[90px]"
                    >
                      <option value="">全部</option>
                      {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </th>
                )}
                {visibleColumns.brand && (
                  <th className="py-4 px-6 w-40">
                    品牌 / 出版社
                    <select 
                      value={columnFilters.brand} 
                      onClick={e => e.stopPropagation()} 
                      onChange={e => setColumnFilters({...columnFilters, brand: e.target.value})} 
                      className="block w-full mt-2 font-normal bg-white border border-[#ece4d9] rounded px-3 py-2 pr-8 focus:outline-none focus:border-[#c4a484] text-xs cursor-pointer shadow-sm hover:border-[#c4a484]/50 transition-colors min-w-[90px]"
                    >
                      <option value="">全部</option>
                      {brands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </th>
                )}
                {visibleColumns.itemName && (
                  <th className="py-4 px-6 w-56">
                    品項名稱
                    <input type="text" placeholder="篩選..." value={columnFilters.itemName} onClick={e => e.stopPropagation()} onChange={e => setColumnFilters({...columnFilters, itemName: e.target.value})} className="block w-full mt-2 font-normal bg-white border border-[#ece4d9] rounded px-2 py-1 focus:outline-none focus:border-[#c4a484] lowercase" />
                  </th>
                )}
                {visibleColumns.origin && (
                  <th className="py-4 px-6 w-32">
                    產地
                    <select 
                      value={columnFilters.origin} 
                      onClick={e => e.stopPropagation()} 
                      onChange={e => setColumnFilters({...columnFilters, origin: e.target.value})} 
                      className="block w-full mt-2 font-normal bg-white border border-[#ece4d9] rounded px-3 py-2 pr-8 focus:outline-none focus:border-[#c4a484] text-xs cursor-pointer shadow-sm hover:border-[#c4a484]/50 transition-colors min-w-[90px]"
                    >
                      <option value="">全部</option>
                      {originsList.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </th>
                )}
                {visibleColumns.material && (
                  <th className="py-4 px-6 w-40">
                    材質 / 特色
                    <select 
                      value={columnFilters.material} 
                      onClick={e => e.stopPropagation()} 
                      onChange={e => setColumnFilters({...columnFilters, material: e.target.value})} 
                      className="block w-full mt-2 font-normal bg-white border border-[#ece4d9] rounded px-3 py-2 pr-8 focus:outline-none focus:border-[#c4a484] text-xs cursor-pointer shadow-sm hover:border-[#c4a484]/50 transition-colors min-w-[90px]"
                    >
                      <option value="">全部</option>
                      {materialsList.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </th>
                )}
                {visibleColumns.costPrice && <th className="py-4 px-6 text-right w-24">進價</th>}
                {visibleColumns.sellPrice && <th className="py-4 px-6 text-right w-24">售價</th>}
                  {visibleColumns.note && (
                  <th className="py-4 px-6 w-48">
                    備註
                    <input type="text" placeholder="篩選..." value={columnFilters.note} onClick={e => e.stopPropagation()} onChange={e => setColumnFilters({...columnFilters, note: e.target.value})} className="block w-full mt-2 font-normal bg-white border border-[#ece4d9] rounded px-2 py-1 focus:outline-none focus:border-[#c4a484] lowercase" />
                  </th>
                )}
                <th className="py-4 px-6 text-center w-64 sticky right-0 bg-[#f8f7f2]/95 backdrop-blur-sm z-20">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ece4d9]/50">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 2} className="p-12 text-center text-[#4a4238]/40 font-black tracking-widest">
                    找不到相符的商品資料
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => (
                  <tr key={p.productId} className={`hover:bg-white/80 transition-colors ${selectedIds.has(p.productId!) ? 'bg-[#c4a484]/5' : ''}`}>
                    <td className="py-4 px-6 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(p.productId!)}
                        onChange={() => toggleSelect(p.productId!)}
                        className="w-4 h-4 rounded border-[#ece4d9] text-[#c4a484] focus:ring-[#c4a484]"
                      />
                    </td>
                    {visibleColumns.category && (
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-bold shadow-sm border ${p.category === '樂譜' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : p.category === '樂器' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-gray-50 text-gray-600 border-gray-100'}`}>
                          {p.category || '未分類'}
                        </span>
                      </td>
                    )}
                    {visibleColumns.brand && <td className="py-4 px-6 font-bold text-xs opacity-70">{p.brand}</td>}
                    {visibleColumns.itemName && <td className="py-4 px-6 font-black text-sm">{p.itemName}</td>}
                    {visibleColumns.origin && <td className="py-4 px-6 text-xs opacity-60">{p.origin || '-'}</td>}
                    {visibleColumns.material && <td className="py-4 px-6 text-xs italic opacity-70">{p.material || '-'}</td>}
                    {visibleColumns.costPrice && <td className="py-4 px-6 text-right font-mono text-xs opacity-60">${p.costPrice}</td>}
                    {visibleColumns.sellPrice && <td className="py-4 px-6 text-right font-mono text-sm font-bold text-[#c4a484]">${p.sellPrice}</td>}
                    {visibleColumns.profit && <td className="py-4 px-6 text-right font-mono text-xs font-bold text-emerald-600/80">${p.profit}</td>}
                    {visibleColumns.stockQty && (
                      <td className="py-4 px-6 text-center">
                         <span className={`inline-block px-3 py-1 rounded-full text-xs font-black font-mono ${p.stockQty <= p.minStock ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-[#ece4d9] text-[#4a4238]'}`}>
                            {p.stockQty}
                         </span>
                      </td>
                    )}
                    {visibleColumns.minStock && (
                      <td className="py-4 px-6 text-center">
                         <span className="inline-block px-3 py-1 rounded-full bg-white border border-[#ece4d9] text-[#4a4238]/50 text-xs font-black font-mono">
                            {p.minStock}
                         </span>
                      </td>
                    )}
                    {visibleColumns.note && <td className="py-4 px-6 text-xs opacity-50 truncate max-w-[150px]" title={p.note}>{p.note || '-'}</td>}
                    <td className="py-4 px-6 relative z-10 sticky right-0 bg-white/95 backdrop-blur-sm shadow-[-10px_0_15px_rgba(0,0,0,0.02)]">
                      <div className="flex flex-wrap gap-2 justify-center">
                        <button 
                          onClick={() => openTxModal(p, 'SALES')}
                          className="w-20 h-9 bg-[#c4a480]/10 hover:bg-[#c4a480]/20 text-[#c4a480] border border-[#c4a480]/30 rounded text-[10px] font-black tracking-widest transition-all flex items-center justify-center gap-1 active:scale-95"
                        >
                          💰 售出
                        </button>
                        
                        {/* 整合式退回按鈕 */}
                        <div className="relative group/ret-menu">
                          <button 
                            className="w-20 h-9 bg-purple-50 hover:bg-purple-100 text-purple-600 border border-purple-200 rounded text-[10px] font-black tracking-widest transition-all flex items-center justify-center gap-1 active:scale-95"
                          >
                            ↩ 退回 <span className="text-[8px] opacity-30">▼</span>
                          </button>
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/ret-menu:block z-[100] min-w-[130px] bg-white rounded-xl shadow-2xl border-2 border-purple-100 p-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                             <button 
                               onClick={() => openTxModal(p, 'SALES_RETURN')}
                               className="w-full text-left px-3 py-2.5 rounded-lg text-[10px] font-bold text-purple-600 hover:bg-purple-50 transition-colors whitespace-nowrap flex items-center gap-2"
                             >
                               <span className="text-xs">🙋</span> 銷貨退回 (客戶)
                             </button>
                             <button 
                               onClick={() => openTxModal(p, 'PURCHASE_RETURN')}
                               className="w-full text-left px-3 py-2.5 rounded-lg text-[10px] font-bold text-blue-600 hover:bg-blue-50 transition-colors border-t border-purple-50 whitespace-nowrap flex items-center gap-2"
                             >
                               <span className="text-xs">📦</span> 退給供應商
                             </button>
                             <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-white"></div>
                          </div>
                        </div>

                        {canEdit && (
                          <>
                            <button 
                              onClick={() => openTxModal(p, 'STOCK_IN')}
                              className="w-20 h-9 bg-[#4a4238]/5 hover:bg-[#4a4238]/10 text-[#4a4238] border border-[#4a4238]/20 rounded text-[10px] font-black tracking-widest transition-all flex items-center justify-center gap-1 active:scale-95"
                            >
                              📥 進貨
                            </button>

                            <button 
                              onClick={() => openProductModal(p)}
                              className="w-20 h-9 bg-blue-50 hover:bg-blue-100 text-blue-500 border border-blue-200 rounded text-[10px] font-black tracking-widest transition-all flex items-center justify-center gap-1 active:scale-95"
                            >
                              ✎ 編輯
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))

              )}
            </tbody>
          </table>

        )}
      </div>
    </div>
  );
}

