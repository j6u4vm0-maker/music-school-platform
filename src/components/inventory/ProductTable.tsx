import React from 'react';
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
  isLoading: boolean;
  canEdit: boolean;
  openTxModal: (p: Product, type: 'STOCK_IN' | 'SALES') => void;
  openProductModal: (p?: Product) => void;
  handleDeleteProduct: (id: string) => void;
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
  isLoading,
  canEdit,
  openTxModal,
  openProductModal,
  handleDeleteProduct,
  handleExport,
  handleImportClick
}: ProductTableProps) {
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
                        className="bg-[#c4a480]/10 hover:bg-[#c4a480]/20 text-[#c4a480] border border-[#c4a480]/30 px-2 py-1 rounded text-[10px] font-black tracking-widest transition-colors scale-95"
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
  );
}
