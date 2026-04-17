"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getLessonsByDate, updateLessonStatus, Lesson } from '@/lib/services/schedule';
import { getDailyClosingStatus, setDailyClosingStatus, settleLessonTransaction } from '@/lib/services/finance';
import { downloadCSV } from '@/lib/utils/csv';
import { useAuth } from '@/components/providers/AuthProvider';
import Navbar from '@/components/layout/Navbar';

export default function LedgerPage() {
  const { hasPermission, profile } = useAuth();
  const canView = hasPermission('ledger', 'VIEW');
  const canEdit = hasPermission('ledger', 'EDIT');

   const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    fetchData();
  }, [date]);

  const fetchData = async () => {
    setIsLoading(true);
    setLessons(await getLessonsByDate(date));
    setIsLocked(await getDailyClosingStatus(date));
    setIsLoading(false);
  };

  const [isSettling, setIsSettling] = useState<string | null>(null);

  const handleUpdate = async (id: string, field: string, value: any) => {
    if (isLocked) {
      alert('🔒 本日帳務已入帳鎖定，無法進行任何修改。');
      return;
    }
    const lesson = lessons.find(l => l.id === id);
    if (!lesson) return;

    // 簽到判斷：一旦 isSettled 即完全鎖定
    if (field === 'isSigned') {
      if (lesson.isSettled) {
        alert('⚠️ 這筆課程已結算，無法再變更簽到狀態。');
        return;
      }

      // 擅取課程簽到→執行完整結算
      if (value === true && lesson.type === 'LESSON') {
        setIsSettling(id);
        const orig = [...lessons];
        setLessons(lessons.map(l => l.id === id ? { ...l, isSigned: true, isSettled: true } : l));
        try {
          await updateLessonStatus(id, { isSigned: true, isSettled: true });
          await settleLessonTransaction(lesson);
          alert('✅ 簽到結算成功！堂數已扣除，老師薪資已記錄。');
        } catch (err: any) {
          setLessons(orig);
          await updateLessonStatus(id, { isSigned: false, isSettled: false });
          alert('❌ 結算失敗：' + (err?.message || '請檢查網路連線'));
        }
        setIsSettling(null);
        return;
      }

      // 租借類型：簽到時也同步設為已結算，鎖定按鈕
      const orig = [...lessons];
      const updates: any = { isSigned: value };
      if (value === true) updates.isSettled = true;
      setLessons(lessons.map(l => l.id === id ? { ...l, ...updates } : l));
      try {
        await updateLessonStatus(id, updates);
      } catch {
        setLessons(orig);
        alert('同步雲端失敗。');
      }
      return;
    }

    // 其他欄位 (paymentMethod, accountSuffix, remark, isPaid...)
    const orig = [...lessons];
    setLessons(lessons.map(l => l.id === id ? { ...l, [field]: value } : l));
    try {
      await updateLessonStatus(id, { [field]: value });
    } catch {
      setLessons(orig);
      alert('同步雲端失敗。');
    }
  };

  const handleSignInAll = async () => {
    if (isLocked) {
      alert('🔒 本日帳務已入帳鎖定，無法進行批次簽到。');
      return;
    }
    const toSignIn = lessons.filter(l => !l.isSigned && !l.isSettled);
    if (toSignIn.length === 0) {
      alert('⚠️ 目前列表中的所有課程都已完成簽到。');
      return;
    }

    if (!confirm(`確定要將目前列表中 ${toSignIn.length} 筆課程全部設為已簽到與結算嗎？\n這將自動執行學生扣款與教師計薪。`)) return;

    setIsLoading(true);
    let successCount = 0;
    try {
      for (const lesson of toSignIn) {
        const updates: any = { isSigned: true, isSettled: true };
        // 批次執行：更新狀態 + 執行財務結算 (針對 LESSON)
        await updateLessonStatus(lesson.id!, updates);
        if (lesson.type === 'LESSON') {
          await settleLessonTransaction(lesson);
        }
        successCount++;
      }
      alert(`✅ 批次簽到完成！成功結算 ${successCount} 筆課程。`);
    } catch (err: any) {
      alert('❌ 批次結算過程中出錯：' + (err?.message || '請檢查網路連線'));
    } finally {
      await fetchData();
      setIsLoading(false);
    }
  };

  const exportCurrentDay = () => {
    const dataToExport = lessons.map(l => ({
      '日期': date,
      '類型': l.type === 'RENTAL' ? '租借' : '課程',
      '時間': l.startTime,
      '項目': l.courseName,
      '師資': l.teacherName || '-',
      '對象': l.studentName || '租借者',
      '堂數/單位': l.lessonsCount,
      '單價': l.unitPrice,
      '老師抽成': l.teacherPayout,
      '應收總計': l.unitPrice * l.lessonsCount,
      '支付方式': l.paymentMethod,
      '備註': l.remark || ''
    }));
    downloadCSV(dataToExport, `ledger_${date}`);
  };

  const totalLessons = lessons.reduce((acc, l) => acc + l.lessonsCount, 0);
  const totalRevenue = lessons.reduce((acc, l) => acc + (l.unitPrice * l.lessonsCount), 0);
  const totalPayout = lessons.reduce((acc, l) => acc + l.teacherPayout, 0);
  
  const cashTotal = lessons.filter(l => l.paymentMethod === 'CASH').reduce((acc, l) => acc + (l.unitPrice * l.lessonsCount), 0);
  const transferTotal = lessons.filter(l => l.paymentMethod === 'TRANSFER').reduce((acc, l) => acc + (l.unitPrice * l.lessonsCount), 0);

  // 日期前後切換
   const shiftDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
    setSelectedIds(new Set()); // 切換日期時清空選擇
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // 僅選取目前列表中「未結算」的項目
      const unsettled = lessons.filter(l => !l.isSettled).map(l => l.id!);
      setSelectedIds(new Set(unsettled));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBatchSignIn = async () => {
    if (isLocked) {
      alert('🔒 本日帳務已入帳鎖定，無法進行批次簽到。');
      return;
    }
    if (selectedIds.size === 0) return;
    
    if (!confirm(`確定要將所選的 ${selectedIds.size} 筆課程全部設為已簽到並執行財務結算嗎？`)) return;

    setIsLoading(true);
    let successCount = 0;
    try {
      for (const id of Array.from(selectedIds)) {
        const lesson = lessons.find(l => l.id === id);
        if (lesson && !lesson.isSettled) {
          const updates: any = { isSigned: true, isSettled: true };
          await updateLessonStatus(id, updates);
          if (lesson.type === 'LESSON') {
            await settleLessonTransaction(lesson);
          }
          successCount++;
        }
      }
      alert(`✅ 批次處理完成！已成功簽到並結算 ${successCount} 筆資料。`);
      setSelectedIds(new Set());
    } catch (err: any) {
      alert('❌ 批次處裡發生錯誤：' + (err?.message || '未知錯誤'));
    } finally {
      await fetchData();
      setIsLoading(false);
    }
  };

  const handleToggleLock = async () => {
    if (!confirm(isLocked ? `確定要解除 ${date} 的帳務鎖定嗎？` : `確定要將 ${date} 設為已入帳並鎖定嗎？\n鎖定後將無法進行任何修改。`)) return;
    try {
      await setDailyClosingStatus(date, !isLocked, profile?.uid || 'UNKNOWN');
      setIsLocked(!isLocked);
    } catch(err) {
      alert('鎖定狀態變更失敗：請檢查網路。');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center pb-24 relative overflow-x-hidden bg-[#f8f7f2]">
      <div className="absolute top-[10%] right-[10%] w-[50vw] h-[50vw] rounded-full bg-[#ece4d9] blur-[150px] opacity-70 -z-10"></div>
      
      {!canView ? (
         <div className="flex-grow flex items-center justify-center p-20 z-50">
            <div className="bg-white p-12 rounded-[40px] shadow-2xl border-2 border-red-50/50 text-center">
               <h3 className="text-4xl mb-4">🚫</h3>
               <p className="font-black text-[#4a4238] tracking-[0.2em]">抱歉，您的帳號目前無權限訪問對帳單模組。</p>
               <p className="text-xs mt-4 opacity-40">請聯繫系統管理員以取得授權。</p>
               <Link href="/" className="mt-8 inline-block bg-[#4a4238] text-white px-8 py-3 rounded-full font-bold tracking-widest hover:bg-[#c4a484] transition-all">返回首頁</Link>
            </div>
          </div>
       ) : (
      <>
      
      {/* Mini Navbar */}
      <Navbar pageTitle="每日對帳單系統">
        <button onClick={exportCurrentDay} className="hidden md:block bg-emerald-500 text-white px-6 py-2 rounded-full font-bold text-xs tracking-widest hover:bg-emerald-600 transition-all shadow-sm">
          匯出當日 CSV
        </button>
      </Navbar>

      <div className="w-full max-w-7xl px-4 z-10 flex flex-col gap-6">
        
        <div className="flex flex-col md:flex-row bg-[#4a4238] rounded-2xl px-8 py-5 items-center justify-between text-white shadow-xl gap-4">
           <div className="flex items-center gap-4">
             <div className={`w-3 h-3 rounded-full ${isLocked ? 'bg-red-500' : 'bg-[#c4a484] animate-pulse'}`}></div>
             <h2 className="font-bold text-xl tracking-[0.3em] uppercase">{date} 營運結算總表 {isLocked && '🔒'}</h2>
           </div>
           <div className="flex items-center gap-4">
             {canEdit && (
               <button 
                 onClick={handleToggleLock}
                 className={`px-4 py-2 rounded-lg text-xs font-bold tracking-widest border transition-all ${isLocked ? 'bg-white/20 border-white hover:bg-white hover:text-rose-600 text-white shadow-inner' : 'bg-rose-500/20 border-rose-500/50 hover:bg-rose-500 text-white'}`}
               >
                 {isLocked ? '🔓 解除鎖定，允許修改' : '🔒 設定今日入帳'}
               </button>
             )}
             <div className="flex items-center gap-3">
             <button
               onClick={() => shiftDate(-1)}
               className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-xl font-bold transition-all hover:scale-110 active:scale-95"
               title="前一天"
             >
               ◀
             </button>
             <input 
               type="date" 
               value={date} 
               onChange={e => setDate(e.target.value)}
               className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 font-bold focus:outline-none focus:bg-white/20 transition-all text-white"
             />
             <button
               onClick={() => shiftDate(1)}
               className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-xl font-bold transition-all hover:scale-110 active:scale-95"
               title="下一天"
             >
               ▶
             </button>
           </div>
        </div>

        <div className="elegant-card w-full p-0 overflow-hidden border-2 border-[#ece4d9]/50 shadow-sm">
          <div className="bg-[#ece4d9]/30 px-8 py-4 border-b border-[#ece4d9] flex justify-between">
            <span className="font-black text-[#4a4238] tracking-widest">壹、課程收入與教師薪資核銷</span>
            <span className="text-xs text-[#c4a484] font-bold">對應原始 EXCEL 藍色區塊</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-center whitespace-nowrap text-sm">
              <thead className="bg-[#f8f7f2]">
                <tr className="text-[#4a4238]/60 font-black tracking-widest border-b border-[#ece4d9]">
                  <th className="py-4 px-4 w-20">時段</th>
                  <th className="py-4 px-4">類型</th>
                  <th className="py-4 px-4">項目/課程名</th>
                  <th className="py-4 px-4">對象/師資</th>
                  <th className="py-4 px-4">堂數單位</th>
                  <th className="py-4 px-4">單價/優惠</th>
                  <th className="py-4 px-4 text-red-500">教師抽成 (-)</th>
                  <th className="py-4 px-4 text-blue-700">應收總額 (+)</th>
                  <th className="py-4 px-4">處理備註</th>
                </tr>
              </thead>
              <tbody className="font-bold text-[#4a4238] divide-y divide-[#ece4d9]/30">
                {lessons.map(l => (
                  <tr key={l.id} className="hover:bg-white transition-colors group">
                    <td className="py-4 px-4 font-mono text-xs opacity-50">{l.startTime}</td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] ${l.type === 'RENTAL' ? 'bg-[#c4a484] text-white' : 'bg-[#4a4238]/10 text-[#4a4238]'}`}>
                        {l.type === 'RENTAL' ? '租借' : '課程'}
                      </span>
                    </td>
                    <td className="py-4 px-4">{l.courseName}</td>
                    <td className="py-4 px-4">
                       <div className="flex flex-col gap-0.5">
                          <span>{l.studentName || '👤 純租借者'}</span>
                          {l.type === 'LESSON' && <span className="text-[10px] opacity-40">師: {l.teacherName}</span>}
                       </div>
                    </td>
                    <td className="py-4 px-4">{l.lessonsCount}</td>
                    <td className="py-4 px-4 font-mono">{l.unitPrice.toLocaleString()}</td>
                    <td className="py-4 px-4 text-red-400 font-mono">-{l.teacherPayout.toLocaleString()}</td>
                    <td className="py-4 px-4 text-blue-800 font-mono">{(l.unitPrice * l.lessonsCount).toLocaleString()}</td>
                    <td className="py-4 px-4">
                      <input type="text" placeholder="..." disabled={!canEdit || isLocked} className="w-full bg-transparent border-b border-transparent group-hover:border-[#c4a484]/30 outline-none text-center transition-all disabled:opacity-40" value={l.remark || ''} onChange={e => handleUpdate(l.id!, 'remark', e.target.value)} />
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#ece4d9]/20 text-[#4a4238] font-black">
                  <td colSpan={4} className="py-5 px-6 text-right tracking-[1em]">本日合計</td>
                  <td className="py-5 px-4">{totalLessons}</td>
                  <td className="py-5 px-4 font-mono">---</td>
                  <td className="py-5 px-4 text-red-500 font-mono">-{totalPayout.toLocaleString()}</td>
                  <td className="py-5 px-4 text-blue-800 font-mono">{totalRevenue.toLocaleString()}</td>
                  <td className="py-5 px-4"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="elegant-card w-full p-0 overflow-hidden border-2 border-emerald-500/20 shadow-sm mt-4">
          <div className="bg-emerald-500/10 px-8 py-4 border-b border-emerald-500/20 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="font-black text-emerald-800 tracking-widest">貳、實收財務與簽到防呆確認</span>
              {selectedIds.size > 0 && (
                <span className="text-[10px] font-bold text-indigo-600 animate-pulse mt-0.5">系統訊息：已選取 {selectedIds.size} 筆待處理資料</span>
              )}
            </div>
            <div className="flex items-center gap-3">
               {canEdit && (
                 <>
                   {selectedIds.size > 0 ? (
                     <button 
                       onClick={handleBatchSignIn}
                       className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-black tracking-[0.1em] transition-all shadow-lg hover:shadow-indigo-200 active:scale-95 flex items-center gap-2 border-2 border-indigo-400"
                     >
                       <span>🚀 執行批次簽到 ({selectedIds.size})</span>
                     </button>
                   ) : (
                     <button 
                       onClick={handleSignInAll}
                       className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-black tracking-[0.1em] transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center gap-2"
                     >
                       <span>✓ 全部簽到 (快速)</span>
                     </button>
                   )}
                 </>
               )}
               <span className="text-xs text-emerald-600 font-bold hidden md:inline ml-2">對應原始 EXCEL 綠色區塊</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-center whitespace-nowrap text-sm">
              <thead className="bg-[#f8f7f2]">
                <tr className="text-emerald-700/60 font-black tracking-widest border-b border-emerald-500/10">
                  <th className="py-4 px-4 w-12">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                      checked={selectedIds.size > 0 && selectedIds.size === lessons.filter(l => !l.isSettled).length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      title="全選未結算項目"
                    />
                  </th>
                  <th className="py-4 px-6 text-left">對象/項目</th>
                  <th className="py-4 px-4">繳費方式</th>
                  <th className="py-4 px-4 text-emerald-600">現金收款 (+)</th>
                  <th className="py-4 px-4 text-blue-600">匯款入帳 (+)</th>
                  <th className="py-4 px-4">帳號末五碼</th>
                  <th className="py-4 px-4">入帳 Check</th>
                  <th className="py-4 px-4">簽到 Check</th>
                </tr>
              </thead>
              <tbody className="font-bold text-[#4a4238] divide-y divide-emerald-500/5">
                {lessons.map(l => (
                  <tr key={l.id} className={`hover:bg-emerald-50/30 transition-colors ${selectedIds.has(l.id!) ? 'bg-indigo-50/50' : ''}`}>
                    <td className="py-5 px-4">
                      <input 
                        type="checkbox" 
                        disabled={l.isSettled || isLocked}
                        checked={selectedIds.has(l.id!)}
                        onChange={() => handleToggleSelect(l.id!)}
                        className={`w-4 h-4 rounded accent-indigo-600 ${l.isSettled ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`}
                      />
                    </td>
                    <td className="py-5 px-6 text-left">
                       <span className="font-black">{l.studentName || '租借者'}</span>
                       <span className="text-[10px] opacity-40 ml-2">({l.courseName})</span>
                    </td>
                    <td className="py-5 px-4">
                      <select value={l.paymentMethod} disabled={!canEdit || isLocked} onChange={e => handleUpdate(l.id!, 'paymentMethod', e.target.value)} className="bg-white border-2 border-emerald-100 rounded-lg px-2 py-1 outline-none font-bold text-xs uppercase disabled:opacity-50">
                        <option value="UNPAID">尚未收費</option>
                        <option value="CASH">現金</option>
                        <option value="TRANSFER">匯款</option>
                      </select>
                    </td>
                    <td className="py-5 px-4 font-mono text-emerald-600">{l.paymentMethod === 'CASH' ? (l.unitPrice * l.lessonsCount).toLocaleString() : '0'}</td>
                    <td className="py-5 px-4 font-mono text-blue-600">{l.paymentMethod === 'TRANSFER' ? (l.unitPrice * l.lessonsCount).toLocaleString() : '0'}</td>
                    <td className="py-5 px-4">
                       <input type="text" placeholder="..." value={l.accountSuffix || ''} onChange={e => handleUpdate(l.id!, 'accountSuffix', e.target.value)} disabled={!canEdit || l.paymentMethod !== 'TRANSFER' || isLocked} className="w-16 text-center border-b border-emerald-200 bg-transparent disabled:opacity-20 outline-none focus:border-emerald-500" />
                    </td>
                    <td className="py-5 px-4">
                       <button onClick={() => canEdit && handleUpdate(l.id!, 'isPaid', !l.isPaid)} disabled={isLocked || !canEdit} className={`w-20 py-1 rounded-full text-[10px] border-2 transition-all ${l.isPaid ? 'bg-red-500 border-red-500 text-white shadow-md' : 'border-red-100 text-red-200 font-black'} ${(!canEdit || isLocked) ? 'opacity-30 cursor-not-allowed' : ''}`}>
                          {l.isPaid ? 'TRUE' : 'FALSE'}
                       </button>
                    </td>
                    <td className="py-5 px-4 relative">
                       <button
                         onClick={() => canEdit && !l.isSettled && handleUpdate(l.id!, 'isSigned', !l.isSigned)}
                         disabled={!canEdit || l.isSettled || isSettling === l.id || isLocked}
                         className={`w-20 py-1 rounded-full text-[10px] border-2 transition-all ${
                           l.isSettled ? 'bg-gray-200 border-gray-200 text-gray-400 cursor-not-allowed opacity-60' :
                           isSettling === l.id ? 'bg-indigo-200 border-indigo-200 text-indigo-500 cursor-wait' :
                           l.isSigned ? 'bg-indigo-600 border-indigo-600 text-white shadow-md cursor-default' :
                           'border-indigo-300 text-indigo-500 hover:bg-indigo-50 font-black cursor-pointer'
                         }`}
                       >
                         {isSettling === l.id ? '處理中...' : l.isSigned ? 'TRUE' : 'FALSE'}
                       </button>
                       {l.isSettled && <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-sm">已結算</span>}
                    </td>
                  </tr>
                ))}
                <tr className="bg-emerald-500/10 text-emerald-800 font-black">
                   <td colSpan={3} className="py-5 px-6 text-right tracking-[1em]">實收分類合計</td>
                   <td className="py-5 px-4 font-mono text-emerald-700">{cashTotal.toLocaleString()}</td>
                   <td className="py-5 px-4 font-mono text-blue-700">{transferTotal.toLocaleString()}</td>
                   <td colSpan={3}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="elegant-card w-full max-w-2xl mx-auto p-0 border-4 border-rose-500/20 shadow-2xl mt-8 mb-20 overflow-hidden rounded-[30px]">
           <div className="bg-rose-500 text-white text-center py-4 font-black tracking-[0.5em] shadow-inner text-xl">
              當日損益結算報告
           </div>
           <div className="p-10 flex flex-col gap-6 bg-white">
              <div className="flex justify-between items-center text-lg border-b border-rose-100 pb-4">
                 <span className="font-bold text-[#4a4238]/60">當日總營業額 (含租借)</span>
                 <span className="font-mono font-black text-blue-700">+ {totalRevenue.toLocaleString()} TWD</span>
              </div>
              <div className="flex justify-between items-center text-lg border-b border-rose-100 pb-4">
                 <span className="font-bold text-[#4a4238]/60">教師薪資成本 (自動扣除)</span>
                 <span className="font-mono font-black text-red-500">- {totalPayout.toLocaleString()} TWD</span>
              </div>
              <div className="flex justify-between items-center bg-rose-50 p-8 rounded-3xl mt-4 border-2 border-rose-100">
                 <div className="flex flex-col">
                    <span className="font-black text-rose-500 tracking-[0.2em] text-sm mb-1 uppercase">Net Profit / 實盈餘</span>
                    <span className="text-xs text-rose-300 font-bold">已扣除所有外部老師抽成</span>
                 </div>
                 <div className="font-mono font-black text-4xl text-rose-600 drop-shadow-sm">
                    { (totalRevenue - totalPayout).toLocaleString() }
                    <span className="text-sm ml-2">TWD</span>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </>
      )}
    </main>
  );
}
