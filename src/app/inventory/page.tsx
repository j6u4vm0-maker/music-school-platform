"use client";

import React, { useRef } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import Navbar from '@/components/layout/Navbar';
import { useInventory } from '@/hooks/useInventory';

// New Components
import ProductTable from '@/components/inventory/ProductTable';
import InventoryDashboard from '@/components/inventory/InventoryDashboard';
import ProductModal from '@/components/inventory/ProductModal';
import InventoryTransactionModal from '@/components/inventory/InventoryTransactionModal';

export default function InventoryPage() {
  const { hasPermission, profile } = useAuth();
  const inventory = useInventory(profile?.name || '系統操作');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canEdit = hasPermission('finance', 'EDIT'); 

  const {
    products, ledgers, invTxs, isLoading,
    isModalOpen, setIsModalOpen,
    isProductModalOpen, setIsProductModalOpen,
    editingProduct, setEditingProduct,
    modalType,
    selectedProduct,
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
    handleProductSubmit, handleDeleteProduct, handleBatchUpdate,
    toggleSelect, toggleSelectAll, handleExport,
    totalRevenue, totalExpense, netProfit,
    brands, categoriesList, filteredProducts
  } = inventory;

  const handleImportUI = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await inventory.handleImport(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
          toggleSelect={toggleSelect} toggleSelectAll={() => toggleSelectAll(filteredProducts)}
          columnFilters={columnFilters} setColumnFilters={setColumnFilters}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          brandFilter={brandFilter} setBrandFilter={setBrandFilter}
          brands={brands} isLoading={isLoading} canEdit={canEdit}
          openTxModal={openTxModal} openProductModal={openProductModal}
          handleDeleteProduct={handleDeleteProduct} handleExport={handleExport}
          handleImportClick={() => fileInputRef.current?.click()}
        />
        <input type="file" ref={fileInputRef} onChange={handleImportUI} hidden accept=".xlsx, .xls" />
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
