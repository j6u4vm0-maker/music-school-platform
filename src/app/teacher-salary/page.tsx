"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { logout } from '@/lib/services/auth';
import { getTeachers, Teacher } from '@/lib/services/db';
import { getTransactions, Transaction } from '@/lib/services/finance';
import { getMonthTeacherStats, getLessonsByMonth, Lesson } from '@/lib/services/schedule';
import { multiSheetExport } from '@/lib/utils/excel';
import Navbar from '@/components/layout/Navbar';

export default function TeacherSalaryPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthAccruedStats, setMonthAccruedStats] = useState<Record<string, { totalPayout: number; lessonCount: number }>>({});
  const [monthLessons, setMonthLessons] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set());
  const [isExportingAll, setIsExportingAll] = useState(false);
  
  // 核心月份選擇器狀態
  const [analyticsMonth, setAnalyticsMonth] = useState<string>(new Date().toISOString().substring(0, 7)); // 'YYYY-MM'
  
  const [selectedTeacherDetail, setSelectedTeacherDetail] = useState<{ id: string, name: string, type: 'ACCRUED' | 'PAID' } | null>(null);
  const [isSalarySlipOpen, setIsSalarySlipOpen] = useState(false);
  const [salarySlipTeacher, setSalarySlipTeacher] = useState<Teacher | null>(null);

  const { hasPermission, profile } = useAuth();
  const router = useRouter();
  
  // 權限檢查
  const canView = hasPermission('teacher_salary', 'VIEW') || hasPermission('finance', 'VIEW');
  const canEdit = hasPermission('teacher_salary', 'EDIT') || hasPermission('finance', 'EDIT');

  useEffect(() => {
    if (canView) {
      fetchData();
    }
  }, [analyticsMonth, canView]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [teacherList, txs, accrued, mLessons] = await Promise.all([
        getTeachers(),
        getTransactions(),
        getMonthTeacherStats(analyticsMonth),
        getLessonsByMonth(analyticsMonth)
      ]);
      setTeachers(teacherList);
      setTransactions(txs);
      setMonthAccruedStats(accrued);
      setMonthLessons(mLessons);
      setSelectedTeacherIds(new Set()); // Reset selection on month change
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  if (!canView) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f2]">
        <div className="text-center p-12 bg-white rounded-[40px] shadow-xl border-2 border-[#ece4d9]">
          <h1 className="text-4xl mb-4">🚫</h1>
          <h2 className="font-serif text-2xl font-black text-[#4a4238] tracking-widest">權限不足</h2>
          <p className="text-[#4a4238]/60 mt-4 font-bold">薪資核銷模組僅供授權管理員存取。</p>
          <Link href="/" className="mt-8 inline-block bg-[#4a4238] text-white px-8 py-3 rounded-full font-bold">返回首頁</Link>
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center pb-24 relative overflow-x-hidden bg-[#f8f7f2]">
      <div className="absolute top-[10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#ece4d9] blur-[150px] opacity-70 -z-10"></div>
      
      {/* Header & Month Selector */}
      {/* Navbar */}
      <Navbar pageTitle="教師薪資核銷中心">
        <div className="flex items-center gap-4 bg-white/50 border border-[#ece4d9] px-4 py-2 rounded-full shadow-inner scale-90 md:scale-100 transition-all">
           <label className="hidden md:block text-[9px] font-black tracking-widest text-[#c4a484] uppercase whitespace-nowrap">結算月份 Select Month</label>
           <input 
             type="month" 
             value={analyticsMonth} 
             onChange={(e) => setAnalyticsMonth(e.target.value)}
             className="bg-transparent font-mono font-black text-[#4a4238] outline-none text-sm"
           />
        </div>
      </Navbar>

      <div className="w-full max-w-7xl px-4 z-10 flex flex-col items-center">
        {/* Batch Action Bar */}
        <div className="w-full mb-8 bg-white/40 backdrop-blur-md rounded-[28px] p-6 border border-white/60 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
           <div className="flex items-center gap-6">
              <label className="flex items-center gap-3 cursor-pointer group">
                 <input 
                   type="checkbox" 
                   className="w-5 h-5 rounded-lg accent-[#4a4238] cursor-pointer"
                   checked={selectedTeacherIds.size > 0 && selectedTeacherIds.size === teachers.filter(t => (monthAccruedStats[t.id!]?.totalPayout || 0) > 0).length}
                   onChange={(e) => {
                      if (e.target.checked) {
                         const activeIds = teachers.filter(t => (monthAccruedStats[t.id!]?.totalPayout || 0) > 0).map(t => t.id!);
                         setSelectedTeacherIds(new Set(activeIds));
                      } else {
                         setSelectedTeacherIds(new Set());
                      }
                   }}
                 />
                 <span className="text-sm font-black text-[#4a4238] group-hover:text-[#c4a484] transition-colors">全選所有本月老師</span>
              </label>
              {selectedTeacherIds.size > 0 && (
                <div className="animate-in fade-in slide-in-from-left duration-300 flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-[#c4a484] animate-pulse"></div>
                   <span className="text-xs font-bold text-[#c4a484]">已選取 {selectedTeacherIds.size} 名教師</span>
                </div>
              )}
           </div>
           
           <button 
             onClick={async () => {
                if (selectedTeacherIds.size === 0) return;
                setIsExportingAll(true);
                try {
                   const sheets: Record<string, any[]> = {};
                   const selectedList = teachers.filter(t => selectedTeacherIds.has(t.id!));
                   
                   selectedList.forEach(teacher => {
                      const teacherLessons = monthLessons.filter(l => l.teacherId === teacher.id && l.status !== 'CANCELLED');
                      const grouped: Record<string, any> = {};
                      
                      teacherLessons.forEach(l => {
                         const rate = l.teacherPayout / (l.payoutLessonsCount || l.lessonsCount || 1);
                         const key = `${l.courseName}-${rate}`;
                         if (!grouped[key]) {
                            grouped[key] = { '課程名稱': l.courseName, '鐘點 (Rate)': rate, '節數 (Qty)': 0, '小計 (Subtotal)': 0 };
                         }
                         grouped[key]['節數 (Qty)'] += (l.payoutLessonsCount || l.lessonsCount || 1);
                         grouped[key]['小計 (Subtotal)'] += l.teacherPayout;
                      });

                      const data = Object.values(grouped);
                      const total = data.reduce((sum, item) => sum + item['小計 (Subtotal)'], 0);
                      data.push({ '課程名稱': '總計', '鐘點 (Rate)': '', '節數 (Qty)': '', '小計 (Subtotal)': total });
                      
                      sheets[`${teacher.name}_${analyticsMonth}`] = data;
                   });
                   
                   multiSheetExport(sheets, `第七樂章_薪資單匯出_${analyticsMonth}`);
                } catch (err) {
                   console.error(err);
                   alert('匯出失敗');
                } finally {
                   setIsExportingAll(false);
                }
             }}
             disabled={selectedTeacherIds.size === 0 || isExportingAll}
             className="bg-[#4a4238] hover:bg-black disabled:bg-gray-300 text-white px-8 py-3 rounded-2xl font-black tracking-widest text-sm shadow-xl transition-all flex items-center gap-3 active:scale-95"
           >
              {isExportingAll ? '🚀 正在產生報表...' : '💾 一鍵匯出所選薪資單 (.xlsx)'}
           </button>
        </div>

        {/* KPI Summary Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-12">
           <div className="bg-white/80 rounded-3xl p-8 border border-[#ece4d9] shadow-sm">
              <p className="text-[10px] font-black tracking-widest text-[#c4a484] mb-2 uppercase">本月排課總鐘點 (Accrued)</p>
              <div className="flex items-baseline gap-2">
                 <span className="text-sm text-[#4a4238]/40">$</span>
                 <span className="text-3xl font-mono font-black text-[#4a4238]">
                    {Object.values(monthAccruedStats).reduce((sum, s) => sum + s.totalPayout, 0).toLocaleString()}
                 </span>
              </div>
           </div>
           <div className="bg-white/80 rounded-3xl p-8 border border-[#ece4d9] shadow-sm">
              <p className="text-[10px] font-black tracking-widest text-[#c4a484] mb-2 uppercase">本月已發放薪資 (Paid)</p>
              <div className="flex items-baseline gap-2 text-emerald-600">
                 <span className="text-sm opacity-60">$</span>
                 <span className="text-3xl font-mono font-black">
                    {Math.abs(transactions.filter(t => t.type === 'TEACHER_PAYOUT' && t.date.startsWith(analyticsMonth)).reduce((sum, t) => sum + t.amount, 0)).toLocaleString()}
                 </span>
              </div>
           </div>
           <div className="bg-white/80 rounded-3xl p-8 border border-[#ece4d9] shadow-sm">
              <p className="text-[10px] font-black tracking-widest text-[#c4a484] mb-2 uppercase">尚未核銷餘額 (Outstanding)</p>
              <div className="flex items-baseline gap-2 text-red-500">
                 <span className="text-sm opacity-60">$</span>
                 <span className="text-3xl font-mono font-black">
                    {(
                      Object.values(monthAccruedStats).reduce((sum, s) => sum + s.totalPayout, 0) - 
                      Math.abs(transactions.filter(t => t.type === 'TEACHER_PAYOUT' && t.date.startsWith(analyticsMonth)).reduce((sum, t) => sum + t.amount, 0))
                    ).toLocaleString()}
                 </span>
              </div>
           </div>
        </div>

        {/* Teacher Cards Grid */}
        <div className="w-full mb-12">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {teachers.map(teacher => {
                const accrued = monthAccruedStats[teacher.id!] || { totalPayout: 0, lessonCount: 0 };
                const paid = Math.abs(transactions.filter(t => t.userId === teacher.id && t.type === 'TEACHER_PAYOUT' && t.date.startsWith(analyticsMonth)).reduce((acc, t) => acc + t.amount, 0));
                
                if (accrued.totalPayout === 0 && paid === 0) return null;

                const isSelectedAccrued = selectedTeacherDetail?.id === teacher.id && selectedTeacherDetail?.type === 'ACCRUED';
                const isSelectedPaid = selectedTeacherDetail?.id === teacher.id && selectedTeacherDetail?.type === 'PAID';

                const isSelected = selectedTeacherIds.has(teacher.id!);

                return (
                  <div key={teacher.id} className={`bg-white/90 backdrop-blur-md p-6 rounded-[32px] border-2 shadow-sm transition-all group relative overflow-hidden ${isSelected ? 'border-[#4a4238] bg-[#f8f7f2]' : 'border-[#ece4d9] hover:border-[#c4a484]'}`}>
                    
                    {/* Checkbox Overlay */}
                    <div className="absolute top-4 left-4 z-20">
                       <input 
                         type="checkbox" 
                         checked={isSelected}
                         onChange={(e) => {
                            const next = new Set(selectedTeacherIds);
                            if (e.target.checked) next.add(teacher.id!);
                            else next.delete(teacher.id!);
                            setSelectedTeacherIds(next);
                         }}
                         className="w-5 h-5 rounded-lg accent-[#4a4238] cursor-pointer shadow-sm"
                       />
                    </div>

                    <div className="flex justify-between items-start mb-4 pl-8">
                       <div>
                         <h4 className="font-serif text-xl font-bold text-[#4a4238]">{teacher.name}</h4>
                         <p className="text-[9px] font-black tracking-widest text-[#c4a484] uppercase mt-1">Teaching Staff</p>
                       </div>
                       <button 
                         onClick={() => { setSalarySlipTeacher(teacher); setIsSalarySlipOpen(true); }}
                         className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                       >
                         🧾 薪資條
                       </button>
                    </div>

                    <div className="bg-[#f8f7f2] rounded-2xl p-4 mb-4 grid grid-cols-2 gap-4">
                       <div 
                         onClick={() => setSelectedTeacherDetail({ id: teacher.id!, name: teacher.name, type: 'ACCRUED' })}
                         className={`cursor-pointer p-2 rounded-xl transition-all ${isSelectedAccrued ? 'bg-[#c4a484] text-white' : 'hover:bg-white'}`}
                       >
                          <p className="text-[8px] font-black uppercase tracking-widest opacity-60">應付 Accrued</p>
                          <p className="font-mono font-black text-base">${accrued.totalPayout.toLocaleString()}</p>
                       </div>
                       <div 
                         onClick={() => setSelectedTeacherDetail({ id: teacher.id!, name: teacher.name, type: 'PAID' })}
                         className={`cursor-pointer p-2 rounded-xl transition-all ${isSelectedPaid ? 'bg-emerald-600 text-white' : 'hover:bg-white'}`}
                       >
                          <p className="text-[8px] font-black uppercase tracking-widest opacity-60">已付 Paid</p>
                          <p className="font-mono font-black text-base">${paid.toLocaleString()}</p>
                       </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-bold">
                       <span className="text-[#4a4238]/40">本月課程: {accrued.lessonCount} 堂</span>
                       {accrued.totalPayout > paid ? (
                         <span className="text-amber-600">待核銷: ${(accrued.totalPayout - paid).toLocaleString()}</span>
                       ) : (
                         <span className="text-emerald-600">結算完成 ✓</span>
                       )}
                    </div>
                  </div>
                );
              })}
           </div>

           {/* Detail Breakdown */}
           {selectedTeacherDetail && (
             <div className="mt-12 bg-white rounded-[40px] p-10 border-2 border-[#c4a484] shadow-2xl animate-in slide-in-from-bottom duration-500">
                <div className="flex justify-between items-center mb-8">
                   <div>
                      <h3 className="font-serif text-2xl font-black text-[#4a4238] tracking-[0.1em]">
                        {selectedTeacherDetail.name} 老師 — 
                        <span className={selectedTeacherDetail.type === 'ACCRUED' ? 'text-[#c4a484]' : 'text-emerald-600'}>
                           {selectedTeacherDetail.type === 'ACCRUED' ? ' 應付薪資明細 (教學紀錄)' : ' 已發放薪資紀錄 (財務)'}
                        </span>
                      </h3>
                      <p className="text-xs text-[#c4a484] font-bold mt-2 uppercase tracking-widest border-b border-[#ece4d9] pb-4 inline-block">
                        Month: {analyticsMonth} | {selectedTeacherDetail.type === 'ACCRUED' ? 'Schedule Accrual' : 'Financial Payouts'}
                      </p>
                   </div>
                   <button 
                     onClick={() => setSelectedTeacherDetail(null)}
                     className="w-12 h-12 rounded-full hover:bg-[#f8f7f2] flex items-center justify-center text-[#4a4238]/40 hover:text-[#4a4238] transition-all"
                   >
                     ✕
                   </button>
                </div>

                <div className="overflow-x-auto">
                   {selectedTeacherDetail.type === 'ACCRUED' ? (
                     <table className="w-full text-left">
                        <thead className="bg-[#f8f7f2] text-[10px] font-black text-[#4a4238]/40 tracking-widest uppercase border-b border-[#ece4d9]">
                           <tr>
                              <th className="py-5 px-6">教學日期</th>
                              <th className="py-5 px-6">學員姓名</th>
                              <th className="py-5 px-6">課程內容</th>
                              <th className="py-5 px-6 text-center">計薪堂數</th>
                              <th className="py-5 px-6 text-center">鐘點單價</th>
                              <th className="py-5 px-6 text-right">小計薪資</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-[#ece4d9]/40">
                           {monthLessons.filter(l => l.teacherId === selectedTeacherDetail.id && l.status !== 'CANCELLED')
                             .sort((a,b) => a.date.localeCompare(b.date))
                             .map((l, i) => (
                               <tr key={i} className="hover:bg-gray-50 transition-colors">
                                  <td className="py-5 px-6 font-mono text-xs font-bold text-gray-400">{l.date}</td>
                                  <td className="py-5 px-6 font-black text-[#4a4238]">{l.studentName}</td>
                                  <td className="py-5 px-6">
                                     <span className="bg-[#ece4d9] px-3 py-1 rounded-full text-[10px] font-bold">{l.courseName}</span>
                                  </td>
                                  <td className="py-5 px-6 text-center font-bold text-gray-500">{l.payoutLessonsCount || l.lessonsCount || 1} 堂</td>
                                  <td className="py-5 px-6 text-center font-mono text-xs text-gray-400">${(l.teacherPayout / (l.payoutLessonsCount || l.lessonsCount || 1)).toLocaleString()}</td>
                                  <td className="py-5 px-6 text-right font-mono font-black text-[#c4a484]">${l.teacherPayout.toLocaleString()}</td>
                               </tr>
                             ))}
                        </tbody>
                     </table>
                   ) : (
                     <table className="w-full text-left">
                        <thead className="bg-[#f8f7f2] text-[10px] font-black text-[#4a4238]/40 tracking-widest uppercase border-b border-[#ece4d9]">
                           <tr>
                              <th className="py-5 px-6">發放日期</th>
                              <th className="py-5 px-6">憑證備註</th>
                              <th className="py-5 px-6">付款方式</th>
                              <th className="py-5 px-6 text-right">發放金額</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-[#ece4d9]/40">
                           {transactions.filter(t => t.userId === selectedTeacherDetail.id && t.type === 'TEACHER_PAYOUT' && t.date.startsWith(analyticsMonth))
                             .sort((a,b) => b.date.localeCompare(a.date))
                             .map((t, i) => (
                               <tr key={i} className="hover:bg-emerald-50/20 transition-colors">
                                  <td className="py-5 px-6 font-mono text-xs font-bold text-gray-400">{t.date}</td>
                                  <td className="py-5 px-6 font-bold text-[#4a4238]">{t.description}</td>
                                  <td className="py-5 px-6">
                                     <span className={`text-[10px] font-black px-3 py-1 rounded-full ${t.paymentMethod === 'TRANSFER' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                                        {t.paymentMethod === 'CASH' ? '現金' : `匯款 (${t.accountSuffix || '----'})`}
                                     </span>
                                  </td>
                                  <td className="py-5 px-6 text-right font-mono font-black text-emerald-600">${Math.abs(t.amount).toLocaleString()}</td>
                               </tr>
                             ))}
                        </tbody>
                     </table>
                   )}
                </div>
             </div>
           )}
        </div>
      </div>

      {/* Salary Slip Modal (Integrated) */}
      {isSalarySlipOpen && salarySlipTeacher && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:bg-white print:p-0 print:static print:inset-auto">
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body * { visibility: hidden; }
              .salary-slip-printable, .salary-slip-printable * { visibility: visible; }
              .salary-slip-printable { position: absolute; left: 0; top: 0; width: 100%; border: none !important; }
              .no-print { display: none !important; }
            }
          `}} />
          
          <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl p-10 relative overflow-y-auto max-h-[90vh] salary-slip-printable transform animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setIsSalarySlipOpen(false)} 
              className="absolute top-8 right-8 text-gray-300 hover:text-[#4a4238] no-print transition-colors"
            >
              ✕
            </button>
            
            <div className="border-b-4 border-[#4a4238] pb-6 mb-8 flex justify-between items-end">
               <div>
                  <h4 className="font-serif text-3xl font-black tracking-widest text-[#4a4238] mb-1">老師薪資明細表</h4>
                  <p className="text-xs text-[#c4a484] font-bold uppercase tracking-[0.3em]">Monthly Teacher Salary Slip</p>
               </div>
               <div className="text-right">
                  <p className="text-sm font-black text-[#4a4238] uppercase">{analyticsMonth.split('-')[0]} / {analyticsMonth.split('-')[1]} 月份</p>
                  <div className="w-12 h-1 bg-[#c4a484] ml-auto mt-1 rounded-full"></div>
               </div>
            </div>

            <div className="flex justify-between items-center mb-10 bg-[#f8f7f2] p-6 rounded-3xl border border-[#ece4d9]">
               <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white rounded-2xl border-2 border-[#ece4d9] flex items-center justify-center text-3xl shadow-sm">🎹</div>
                  <div>
                     <p className="text-[10px] font-black tracking-widest text-[#c4a484] uppercase">教師姓名 Teacher Name</p>
                     <h5 className="text-2xl font-black text-[#4a4238]">{salarySlipTeacher.name} 老師</h5>
                  </div>
               </div>
               <div className="text-right">
                  <p className="text-[10px] font-black tracking-widest text-[#c4a484] uppercase">結算日期 Date</p>
                  <p className="font-mono text-sm font-bold text-[#4a4238]">{new Date().toLocaleDateString('zh-TW')}</p>
               </div>
            </div>

            <div className="mb-10 overflow-hidden border-2 border-[#4a4238] rounded-2xl">
               <table className="w-full text-left">
                  <thead className="bg-[#4a4238] text-white text-[11px] font-black tracking-[0.2em] uppercase">
                     <tr>
                        <th className="py-4 px-6 border-r border-white/10 w-1/2">課程名稱 (Course Description)</th>
                        <th className="py-4 px-6 border-r border-white/10 text-center">鐘點 (Rate)</th>
                        <th className="py-4 px-6 border-r border-white/10 text-center">節數 (Qty)</th>
                        <th className="py-4 px-6 text-right">小計 (Subtotal)</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-[#4a4238]/10">
                     {(() => {
                        const teacherLessons = monthLessons.filter(l => l.teacherId === salarySlipTeacher.id && l.status !== 'CANCELLED');
                        const grouped: Record<string, { count: number, total: number, name: string, rate: number }> = {};
                        
                        teacherLessons.forEach(l => {
                           const rate = l.teacherPayout / (l.payoutLessonsCount || l.lessonsCount || 1);
                           const key = `${l.courseName}-${rate}`;
                           if (!grouped[key]) {
                              grouped[key] = { name: l.courseName, rate: rate, count: 0, total: 0 };
                           }
                           grouped[key].count += (l.payoutLessonsCount || l.lessonsCount || 1);
                           grouped[key].total += l.teacherPayout;
                        });

                        const items = Object.values(grouped);
                        if (items.length === 0) return <tr><td colSpan={4} className="py-10 text-center text-gray-300 font-bold">本月份無授課紀錄</td></tr>;

                        return items.map((item, idx) => (
                           <tr key={idx} className="hover:bg-gray-50 transition-colors">
                              <td className="py-5 px-6 font-bold text-[#4a4238] border-r border-[#4a4238]/10">{item.name}</td>
                              <td className="py-5 px-6 font-mono text-center border-r border-[#4a4238]/10">${item.rate.toLocaleString()}</td>
                              <td className="py-5 px-6 font-bold text-center border-r border-[#4a4238]/10">{item.count}</td>
                              <td className="py-5 px-6 text-right font-mono font-black text-[#4a4238]">${item.total.toLocaleString()}</td>
                           </tr>
                        ));
                     })()}
                  </tbody>
                  <tfoot className="bg-[#f8f7f2] border-t-2 border-[#4a4238]">
                     <tr className="font-black text-[#4a4238]">
                        <td colSpan={2} className="py-5 px-6 text-right tracking-[0.3em] text-xs uppercase opacity-60">總計明細 Total</td>
                        <td className="py-5 px-6 text-center border-l border-r border-[#4a4238]/10 text-xl font-mono">
                           {monthLessons.filter(l => l.teacherId === salarySlipTeacher.id && l.status !== 'CANCELLED').reduce((acc, l) => acc + (l.payoutLessonsCount || l.lessonsCount || 1), 0)}
                        </td>
                        <td className="py-5 px-6 text-right text-2xl font-mono decoration-[#c4a484] underline underline-offset-8">
                           <span className="text-sm mr-1">$</span>
                           {monthLessons.filter(l => l.teacherId === salarySlipTeacher.id && l.status !== 'CANCELLED').reduce((acc, l) => acc + l.teacherPayout, 0).toLocaleString()}
                        </td>
                     </tr>
                  </tfoot>
               </table>
            </div>

            <div className="flex justify-between items-start gap-8 mt-12 mb-4">
               <div className="flex-grow bg-[#f8f7f2] p-5 rounded-2xl border border-dashed border-[#ece4d9] text-[11px] text-[#4a4238]/60 leading-relaxed font-bold">
                  <p>※ 本薪資明細表自動根據系統排課紀錄產生。如有任何差異，請向管理部反應。感謝您對藝術學院的貢獻。</p>
               </div>
               <div className="no-print flex flex-col gap-3 shrink-0">
                  <button onClick={() => window.print()} className="bg-[#4a4238] hover:bg-black text-white px-8 py-4 rounded-2xl font-black tracking-widest text-sm shadow-xl transition-all flex items-center justify-center gap-2">🖨️ 列印正式條</button>
                  <button onClick={() => setIsSalarySlipOpen(false)} className="text-[#4a4238]/40 hover:text-[#4a4238] font-black tracking-widest text-xs py-2 uppercase">關閉視窗 Close</button>
               </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
