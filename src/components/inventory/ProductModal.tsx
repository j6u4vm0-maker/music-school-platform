import React from 'react';
import { Product } from '@/lib/types/inventory';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: Product | Partial<Product> | null;
  setEditingProduct: (p: Product | Partial<Product> | null) => void;
  onSubmit: (e: React.FormEvent) => void;
  onDelete?: (id: string) => void;
  isSubmitting: boolean;
  categoriesList: string[];
  brands: string[];
}

export default function ProductModal({
  isOpen,
  onClose,
  editingProduct,
  setEditingProduct,
  onSubmit,
  onDelete,
  isSubmitting,
  categoriesList,
  brands
}: ProductModalProps) {

  if (!isOpen || !editingProduct) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#f8f7f2] w-full max-w-lg rounded-[40px] p-8 shadow-2xl relative border-2 border-[#ece4d9] overflow-y-auto max-h-[90vh] custom-scrollbar" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white text-[#4a4238] font-bold shadow-sm hover:bg-gray-50 transition-colors flex items-center justify-center">✕</button>
        
        <div className="mb-6">
          <span className="inline-block px-4 py-1 rounded-full text-[10px] font-black tracking-[0.2em] mb-2 bg-[#4a4238] text-white">
            { (editingProduct as Product).productId ? 'EDIT PRODUCT / 編輯商品' : 'NEW PRODUCT / 新增商品' }
          </span>
          <h2 className="text-2xl font-black text-[#4a4238]">商品基本資料維護</h2>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
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

          { (editingProduct as Product).productId && onDelete && (
            <button 
              type="button"
              onClick={() => {
                if (window.confirm('確定要永久刪除此商品嗎？此操作無法復原。')) {
                  onDelete((editingProduct as Product).productId!);
                  onClose();
                }
              }}
              className="w-full mt-2 py-2 rounded-xl font-bold text-xs text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
            >
              ✕ 永久刪除此商品
            </button>
          )}
        </form>

      </div>
    </div>
  );
}
