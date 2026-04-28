"use client";

import React, { useRef } from 'react';
import Navbar from '@/components/layout/Navbar';
import TransactionModal from '@/components/finance/TransactionModal';
import { useAuth } from '@/components/providers/AuthProvider';
import { useFinance } from '@/hooks/useFinance';

export default function FinancePage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('finance', 'EDIT');
  const canView = hasPermission('finance', 'VIEW');

  const finance = useFinance(canEdit);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    transactions,
    students,
    teachers,
    isLoading,
    isModalOpen, setIsModalOpen,
    modalType, setModalType,
    categories,
    filterRange, setFilterRange,
    startDate, setStartDate,
    endDate, setEndDate,
    newCategoryName, setNewCategoryName,
    editingTx, setEditingTx,
    searchQuery, setSearchQuery,
    sortOrder, setSortOrder,
    viewMode, setViewMode,
    analyticsMonth, setAnalyticsMonth,
    isDeleteModalOpen, setIsDeleteModalOpen,
    executeDelete, openEditModal,
    handleExportExcel,
    filteredTransactions,
    handleSaveTransaction,
    totalIncome, totalExpense, netRevenue,
    totalRevenueMonth, totalExpenseMonth, netProfitMonth,
    revenueByCategory, expenseByCategory,
    handleAddCategory, confirmDeleteCategory, confirmDeleteTransaction
  } = finance;

  const handleImportExcelUI = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await finance.handleImportExcel(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <main className="flex min-h-screen flex-col items-center pb-24 relative overflow-x-hidden bg-[#f8f7f2] animate-fade-in">
      <div className="absolute top-[20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#ece4d9] blur-[150px] opacity-70 -z-10 animate-pulse"></div>
      
      <Navbar pageTitle="智能財務與核銷" />

      {!canView ? (
        <div className="flex-grow flex items-center justify-center p-20">
           <div className="bg-white p-12 rounded-[40px] shadow-2xl border-2 border-red-50/50 text-center">
              <h3 className="text-4xl mb-4">🚫</h3>
              <p className="font-black text-[#4a4238] tracking-[0.2em]">抱歉，您的帳號目前無權限訪問財務模組。</p>
              <p className="text-xs mt-4 opacity-40">請聯繫系統管理員以取得授權。</p>
           </div>
        </div>
      ) : (
      <div className="w-full max-w-7xl px-4 z-10 flex flex-col items-center">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-12">
          <div className="bg-white/60 backdrop-blur-md rounded-3xl p-8 border-2 border-[#ece4d9] shadow-sm flex flex-col justify-center">
             <h3 className="font-black tracking-[0.3em] text-[#c4a484] text-xs mb-2">本期總入帳 (REVENUE)</h3>
             <p className="font-mono text-4xl font-extrabold text-[#4a4238] tracking-widest">+ ${totalIncome.toLocaleString()}</p>
          </div>
          <div className="bg-white/60 backdrop-blur-md rounded-3xl p-8 border-2 border-[#ece4d9] shadow-sm flex flex-col justify-center border-b-4 border-b-red-400/30">
             <h3 className="font-black tracking-[0.3em] text-red-400/70 text-xs mb-2">已發放款與月消耗 (EXPENSE)</h3>
             <p className="font-mono text-4xl font-extrabold text-[#4a4238] tracking-widest">- ${totalExpense.toLocaleString()}</p>
          </div>
          <div className="bg-[#4a4238] rounded-3xl p-8 shadow-xl flex flex-col justify-center transform hover:scale-105 transition-transform">
             <h3 className="font-black tracking-[0.3em] text-[#ece4d9]/50 text-xs mb-2">實質淨營收 (NET)</h3>
             <p className="font-mono text-5xl font-extrabold text-white tracking-widest">${netRevenue.toLocaleString()}</p>
          </div>
        </div>

        <div className="elegant-card w-full p-8 md:p-12 min-h-[50vh] flex flex-col relative overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b-2 border-[#ece4d9] pb-6 gap-6 relative z-10">
            <div className="flex flex-col gap-4">
              <h3 className="font-serif text-3xl md:text-4xl font-extrabold tracking-[0.15em] text-[#4a4238]">
                {viewMode === 'LIST' ? '金流出入帳明細' : '月營運分析'}
              </h3>
              <div className="flex bg-[#ece4d9]/30 p-1 rounded-full border border-[#ece4d9] w-max shadow-inner">
                <button 
                  onClick={() => setViewMode('LIST')}
                  className={`px-6 py-2 rounded-full text-sm font-black tracking-widest transition-all ${viewMode === 'LIST' ? 'bg-[#4a4238] text-white shadow-md' : 'text-[#4a4238] hover:bg-white'}`}>
                  📝 明細列表
                </button>
                <button 
                  onClick={() => setViewMode('ANALYTICS')}
                  className={`px-6 py-2 rounded-full text-sm font-black tracking-widest transition-all flex items-center gap-2 ${viewMode === 'ANALYTICS' ? 'bg-[#c4a484] text-white shadow-md' : 'text-[#4a4238] hover:bg-white border hover:border-[#c4a484]/30'}`}>
                  📊 營運分析
                </button>
              </div>
            </div>
            
            {viewMode === 'LIST' && (
              <div className="flex flex-wrap gap-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex bg-[#ece4d9]/30 p-1 rounded-full border border-[#ece4d9]">
                {(['ALL', 'WEEK', 'MONTH', 'CUSTOM'] as const).map(r => (
                  <button 
                    key={r}
                    onClick={() => setFilterRange(r)}
                    className={`px-6 py-2 rounded-full text-xs font-black tracking-widest transition-all ${filterRange === r ? 'bg-[#4a4238] text-white shadow-md' : 'text-[#4a4238] hover:bg-white'}`}>
                    {r === 'ALL' ? '全部' : r === 'WEEK' ? '近一週' : r === 'MONTH' ? '本月份' : '選擇區間'}
                  </button>
                ))}
                </div>
                
                {filterRange === 'CUSTOM' && (
                  <div className="flex items-center gap-2 bg-white border-2 border-[#ece4d9] px-3 py-2 rounded-2xl shadow-sm animate-in fade-in slide-in-from-left-2 duration-300">
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-xs font-bold text-[#4a4238] focus:outline-none" />
                    <span className="text-[#4a4238]/30 font-bold">~</span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-xs font-bold text-[#4a4238] focus:outline-none" />
                  </div>
                )}
              </div>
              {canEdit && (
                <>
                  <button onClick={() => { setModalType('TOP_UP'); setIsModalOpen(true); }} className="bg-[#c4a484] hover:bg-[#b09070] text-white px-6 py-3 border border-white rounded-full text-sm font-bold tracking-[0.1em] shadow-lg transition-all hover:-translate-y-1">📈 學生儲值</button>
                  <button onClick={() => { setModalType('TEACHER_PAYOUT'); setIsModalOpen(true); }} className="bg-white hover:bg-gray-50 text-[#4a4238] px-6 py-3 border-2 border-[#4a4238]/20 rounded-full text-sm font-bold tracking-[0.1em] shadow-md transition-all hover:-translate-y-1">📉 鐘點費</button>
                  <button onClick={() => { setModalType('OTHER_INCOME'); setIsModalOpen(true); }} className="bg-white hover:bg-gray-50 text-blue-500/70 px-6 py-3 border-2 border-blue-500/20 rounded-full text-sm font-bold tracking-[0.1em] shadow-md transition-all hover:-translate-y-1">💰 收入</button>
                  <button onClick={() => { setModalType('EXPENSE'); setIsModalOpen(true); }} className="bg-white hover:bg-gray-50 text-red-500/70 px-6 py-3 border-2 border-red-500/20 rounded-full text-sm font-bold tracking-[0.1em] shadow-md transition-all hover:-translate-y-1">📄 支出</button>
                </>
              )}
              <div className="flex gap-2 ml-4 pl-4 border-l-2 border-[#ece4d9]">
                <button onClick={handleExportExcel} className="text-[#4a4238] opacity-60 hover:opacity-100 font-bold text-xs flex flex-col items-center gap-1 group">
                   <span className="bg-white p-2 rounded-lg border border-[#ece4d9] group-hover:shadow-md transition-all">📤</span>
                   匯出 Excel
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="text-[#4a4238] opacity-60 hover:opacity-100 font-bold text-xs flex flex-col items-center gap-1 group">
                   <span className="bg-white p-2 rounded-lg border border-[#ece4d9] group-hover:shadow-md transition-all">📥</span>
                   匯入 Excel
                </button>
                <input type="file" ref={fileInputRef} onChange={handleImportExcelUI} hidden accept=".xlsx, .xls" />
              </div>
            </div>
            )}
            
            {viewMode === 'ANALYTICS' && (
              <div className="flex items-center gap-4 bg-white border-2 border-[#ece4d9] px-6 py-3 rounded-2xl shadow-sm">
                 <label className="font-bold text-[#4a4238] tracking-widest text-sm">選擇分析月份：</label>
                 <input type="month" value={analyticsMonth} onChange={(e) => setAnalyticsMonth(e.target.value)} className="font-mono text-[#c4a484] font-black text-lg focus:outline-none bg-transparent" />
              </div>
            )}
            
            {viewMode === 'LIST' && (
              <div className="relative w-full md:w-64">
                <input 
                  type="text"
                  placeholder="搜尋科目、對象或備註..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/50 border-2 border-[#ece4d9] rounded-2xl px-5 py-3 pr-10 text-sm font-bold focus:outline-none focus:border-[#c4a480] transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 text-lg">🔍</span>
              </div>
            )}
          </div>

          {viewMode === 'LIST' ? (
            <>
              <div className="flex-grow w-full overflow-x-auto pb-8 z-10">
            {isLoading ? (
               <div className="animate-pulse flex items-center justify-center h-40 text-[#4a4238]/40 font-black tracking-widest text-xl">讀取歷史水單...</div>
            ) : transactions.length === 0 ? (
               <div className="flex flex-col items-center justify-center p-12 text-[#4a4238]/50 tracking-widest bg-white/40 rounded-3xl border-2 border-dashed border-[#ece4d9]">
                 <p className="font-extrabold text-lg">目前尚無任何資金流動紀錄。</p>
               </div>
            ) : (
               <div className="min-w-[800px] border-2 border-[#ece4d9] rounded-[30px] bg-white/70 backdrop-blur-md overflow-hidden shadow-sm">
                  <table className="w-full text-left font-sans text-[#4a4238]/90">
                    <thead className="bg-[#ece4d9]/50 text-[#4a4238] border-b-2 border-[#ece4d9] uppercase tracking-widest text-xs font-black">
                      <tr>
                        <th className="py-5 px-8 cursor-pointer hover:bg-[#ece4d9] transition-colors" onClick={() => setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')}>
                          日期 <span className="ml-2 font-mono text-[#c4a484]">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
                        </th>
                        <th className="py-5 px-8">會計科目</th>
                        <th className="py-5 px-8">交易對象</th>
                        <th className="py-5 px-8">備註</th>
                        <th className="py-5 px-8">金額</th>
                        <th className="py-5 px-8 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map(t => (
                        <tr key={t.id} className="border-b border-[#ece4d9]/50 hover:bg-[#c4a484]/10 transition-colors">
                          <td className="py-5 px-8 tracking-widest font-mono text-sm opacity-60 font-bold">{t.date}</td>
                          <td className="py-5 px-8">
                             <span className="px-3 py-1 rounded-full bg-[#ece4d9] text-[#4a4238] text-xs font-black tracking-tighter">
                                {t.category || (t.type === 'TOP_UP' ? '課程營收' : '一般項目')}
                             </span>
                          </td>
                          <td className="py-5 px-8 font-black text-lg">
                            {t.userName}
                            {t.paymentMethod && (
                               <span className={`text-[10px] ml-2 px-2 py-0.5 rounded-full ${t.paymentMethod === 'TRANSFER' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                                  {t.paymentMethod === 'CASH' ? '現金' : `匯款 (${t.accountSuffix || '----'})`}
                               </span>
                            )}
                          </td>
                          <td className="py-5 px-8 font-bold opacity-80">{t.description}</td>
                          <td className={`py-5 px-8 font-black text-xl font-mono ${t.amount > 0 ? 'text-[#c4a484]' : 'text-red-500/80'}`}>{t.amount > 0 ? '+' : ''}{t.amount.toLocaleString()}</td>
                          <td className="py-5 px-8 text-right flex gap-3 justify-end items-center">
                             {canEdit && (
                               <>
                                 <button onClick={() => openEditModal(t)} className="text-blue-400 hover:text-blue-600 font-bold text-xs">✎ 修正</button>
                                 <button onClick={() => confirmDeleteTransaction(t.id!)} className="text-red-300 hover:text-red-500 font-bold text-xs pr-4">✕ 刪除</button>
                               </>
                             )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            )}
          </div>

          {canEdit && (
            <div className="mt-12 bg-[#ece4d9]/10 rounded-[30px] p-8 border-2 border-dashed border-[#ece4d9] relative z-10">
               <h4 className="font-black tracking-[0.2em] text-[#4a4238] text-sm mb-6 flex items-center gap-2">📂 靈活會計科目管理</h4>
               <div className="flex flex-wrap gap-3 mb-6">
                  {categories.map(c => (
                    <span key={c} className="bg-white border-2 border-[#ece4d9] px-4 py-2 rounded-xl text-xs font-bold text-[#4a4238] opacity-80 flex items-center gap-3">
                      {c}
                      {!["課程營收", "教師薪資", "雜支"].includes(c) && (
                        <button onClick={() => confirmDeleteCategory(c)} className="text-red-300 hover:text-red-500 font-black">✕</button>
                      )}
                    </span>
                  ))}
               </div>
               <div className="flex gap-4">
                  <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="輸入新科目名稱" className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-6 py-4 flex-grow font-bold focus:outline-none" />
                  <button onClick={handleAddCategory} className="bg-[#4a4238] hover:bg-[#c4a480] text-white px-10 py-4 rounded-2xl font-black tracking-widest transition-all">+ 新增科目</button>
               </div>
            </div>
          )}
        </>
      ) : (
          <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-500">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="bg-white rounded-[30px] p-8 border-2 border-[#ece4d9] flex flex-col items-center justify-center relative shadow-sm">
                 <h4 className="text-[#4a4238]/60 font-black tracking-[0.2em] text-sm mb-4">本月總收入</h4>
                 <div className="text-4xl font-mono font-black text-[#c4a480] relative z-10 flex items-center gap-2">${totalRevenueMonth.toLocaleString()}</div>
               </div>
               <div className="bg-white rounded-[30px] p-8 border-2 border-[#ece4d9] flex flex-col items-center justify-center relative shadow-sm">
                 <h4 className="text-[#4a4238]/60 font-black tracking-[0.2em] text-sm mb-4">本月總支出</h4>
                 <div className="text-4xl font-mono font-black text-red-500/80 relative z-10 flex items-center gap-2">${totalExpenseMonth.toLocaleString()}</div>
               </div>
               <div className={`rounded-[30px] p-8 border-2 flex flex-col items-center justify-center relative shadow-md ${netProfitMonth >= 0 ? 'bg-[#4a4238] border-[#4a4238]' : 'bg-red-50 border-red-200'}`}>
                 <h4 className={`font-black tracking-[0.2em] text-sm mb-4 ${netProfitMonth >= 0 ? 'text-[#ece4d9]/80' : 'text-red-800'}`}>本月淨利</h4>
                 <div className={`text-5xl font-mono font-black ${netProfitMonth >= 0 ? 'text-white' : 'text-red-500'}`}>{netProfitMonth < 0 ? '-' : ''}${Math.abs(netProfitMonth).toLocaleString()}</div>
               </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
               <div className="bg-white/70 backdrop-blur-md rounded-[30px] p-8 border-2 border-[#ece4d9] shadow-sm">
                 <h4 className="font-black tracking-[0.2em] text-[#4a4238] text-lg mb-8">💰 收入佔比</h4>
                 <div className="flex flex-col gap-6">
                    {Object.entries(revenueByCategory).map(([cat, amt]) => (
                      <div key={cat}>
                        <div className="flex justify-between mb-2 font-bold"><span>{cat}</span><span>${amt.toLocaleString()}</span></div>
                        <div className="h-2 w-full bg-[#ece4d9] rounded-full"><div className="h-full bg-[#c4a484] rounded-full" style={{ width: `${(amt / totalRevenueMonth) * 100}%` }}></div></div>
                      </div>
                    ))}
                 </div>
               </div>
               <div className="bg-white/70 backdrop-blur-md rounded-[30px] p-8 border-2 border-[#ece4d9] shadow-sm">
                 <h4 className="font-black tracking-[0.2em] text-[#4a4238] text-lg mb-8">📉 支出佔比</h4>
                 <div className="flex flex-col gap-6">
                    {Object.entries(expenseByCategory).map(([cat, amt]) => (
                      <div key={cat}>
                        <div className="flex justify-between mb-2 font-bold"><span>{cat}</span><span>${amt.toLocaleString()}</span></div>
                        <div className="h-2 w-full bg-[#ece4d9] rounded-full"><div className="h-full bg-red-400 rounded-full" style={{ width: `${(amt / totalExpenseMonth) * 100}%` }}></div></div>
                      </div>
                    ))}
                 </div>
               </div>
             </div>
          </div>
        )}
        </div>
      </div>
      )}

      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingTx(null); }}
        onSave={handleSaveTransaction}
        modalType={modalType}
        editingTx={editingTx}
        students={students}
        teachers={teachers}
        categories={categories}
        canEdit={canEdit}
      />

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">
             <h2 className="text-xl font-bold text-center text-[#4a4238] mb-4">確定要刪除嗎？</h2>
             <div className="flex gap-4">
               <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-[#ece4d9] text-[#4a4238] font-bold rounded-xl">取消</button>
               <button onClick={executeDelete} className="flex-1 py-3 bg-red-400 text-white font-bold rounded-xl">確認刪除</button>
             </div>
           </div>
        </div>
      )}
    </main>
  );
}
