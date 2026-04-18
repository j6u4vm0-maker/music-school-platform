import React from 'react';
import { Product } from '@/lib/types/inventory';

interface InventoryDashboardProps {
  totalRevenue: number;
  totalExpense: number;
  netProfit: number;
  invTxs: any[];
  ledgers: any[];
  products: Product[];
}

export default function InventoryDashboard({
  totalRevenue,
  totalExpense,
  netProfit,
  invTxs,
  ledgers,
  products
}: InventoryDashboardProps) {
  return (
    <div className="w-full flex flex-col gap-10 items-center">
      {/* KPI 財務數據卡片 */}
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

      {/* 交易紀錄表 */}
      <div className="w-full flex flex-col md:flex-row gap-6 animate-in slide-in-from-bottom duration-1000">
        <div className="flex-1 bg-white p-6 rounded-3xl border-2 border-[#ece4d9] shadow-sm overflow-hidden flex flex-col">
          <h4 className="font-black tracking-[0.2em] text-[#4a4238] text-sm mb-4 border-b-2 border-gray-50 pb-3 flex items-center gap-2">
            <span className="text-[#c4a480]">📋 近期進銷紀錄</span> (Inventory Logs)
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
            <span className="text-[#c4a480]">💰 帳本連動紀錄</span> (Ledger Logs)
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
  );
}
