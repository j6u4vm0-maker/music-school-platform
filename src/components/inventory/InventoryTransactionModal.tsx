import React from 'react';
import { Product } from '@/lib/types/inventory';

interface InventoryTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProduct: Product | null;
  modalType: 'STOCK_IN' | 'SALES' | null;
  txQty: number;
  setTxQty: (q: number) => void;
  txPrice: number;
  setTxPrice: (p: number) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
}

export default function InventoryTransactionModal({
  isOpen,
  onClose,
  selectedProduct,
  modalType,
  txQty,
  setTxQty,
  txPrice,
  setTxPrice,
  onSubmit,
  isSubmitting
}: InventoryTransactionModalProps) {
  if (!isOpen || !selectedProduct || !modalType) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#f8f7f2] w-full max-w-md rounded-[40px] p-8 md:p-12 shadow-2xl relative border-2 border-[#ece4d9]" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white text-[#4a4238] font-bold shadow-sm hover:bg-gray-50 transition-colors flex items-center justify-center">✕</button>
        
        <div className="mb-6 text-center">
          <span className={`inline-block px-4 py-1 rounded-full text-[10px] font-black tracking-[0.2em] mb-4 ${modalType === 'STOCK_IN' ? 'bg-[#4a4238] text-white' : 'bg-[#c4a484] text-white'}`}>
            {modalType === 'STOCK_IN' ? 'IN STOCK / 進貨入庫' : 'SALES / 結帳售出'}
          </span>
          <h2 className="text-2xl font-black text-[#4a4238]">{selectedProduct.itemName}</h2>
          <p className="text-xs font-bold text-[#4a4238]/50 tracking-widest mt-1">目前剩餘數量: {selectedProduct.stockQty}</p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
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
  );
}
