"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getTransactions, addTransaction, updateStudentBalance, getCategories, addCategory, deleteCategory, updateTransaction, deleteTransaction, Transaction } from '@/lib/services/finance';
import { getStudents, getTeachers, Student, Teacher } from '@/lib/services/db';
import { exportToExcel, importFromExcel } from '@/lib/utils/excel';
import { useRef } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { logout } from '@/lib/services/auth';
import { useRouter } from 'next/navigation';
import { getPricing, getTeacherPricingList, calculatePackagePrice, TeacherInstrumentPricing } from '@/lib/services/pricing';
import { getMonthTeacherStats } from '@/lib/services/schedule';

export default function FinancePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'TOP_UP' | 'TEACHER_PAYOUT' | 'EXPENSE' | 'OTHER_INCOME'>('TOP_UP');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Advanced Reporting & Categories
  const [categories, setCategories] = useState<string[]>([]);
  const [filterRange, setFilterRange] = useState<'ALL' | 'WEEK' | 'MONTH'>('ALL');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Analytics State
  const [viewMode, setViewMode] = useState<'LIST' | 'ANALYTICS'>('LIST');
  const [analyticsMonth, setAnalyticsMonth] = useState<string>(new Date().toISOString().substring(0, 7)); // 'YYYY-MM'
  const [monthAccruedStats, setMonthAccruedStats] = useState<Record<string, { totalPayout: number; lessonCount: number }>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'CATEGORY' | 'TRANSACTION', id: string } | null>(null);

  // TOP_UP combo pricing state
  const [topUpTeacher, setTopUpTeacher] = useState<Teacher | null>(null);
  const [topUpInstrument, setTopUpInstrument] = useState<string>('');
  const [topUpPricing, setTopUpPricing] = useState<TeacherInstrumentPricing | null>(null);
  const [topUpLessons, setTopUpLessons] = useState<number>(0);
  const [calculatedAmount, setCalculatedAmount] = useState<number>(0);
  const [availableInstruments, setAvailableInstruments] = useState<string[]>([]);

  const { hasPermission, profile } = useAuth();
  const router = useRouter();

  const canEdit = hasPermission('finance', 'EDIT');
  const canView = hasPermission('finance', 'VIEW');

  useEffect(() => {
    fetchData();
  }, [analyticsMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const txs = await getTransactions();
      setTransactions(txs);
      
      const accrued = await getMonthTeacherStats(analyticsMonth);
      setMonthAccruedStats(accrued);

      setCategories(await getCategories());
      if (students.length === 0) {
         setStudents(await getStudents());
         setTeachers(await getTeachers());
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    await addCategory(newCategoryName);
    setCategories(await getCategories());
    setNewCategoryName('');
  };

  const confirmDeleteCategory = (name: string) => {
    setItemToDelete({ type: 'CATEGORY', id: name });
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteTransaction = (id: string) => {
    setItemToDelete({ type: 'TRANSACTION', id });
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (itemToDelete.type === 'CATEGORY') {
        await deleteCategory(itemToDelete.id);
        setCategories(await getCategories());
      } else {
        await deleteTransaction(itemToDelete.id);
        setTransactions(await getTransactions());
      }
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (e) {
      alert("刪除失敗，請檢查權限");
    }
  };

  const openEditModal = (tx: Transaction) => {
    setEditingTx(tx);
    setModalType(tx.type as any);
    // Reset combo state when opening edit
    setTopUpTeacher(null);
    setTopUpInstrument('');
    setTopUpPricing(null);
    setTopUpLessons(0);
    setCalculatedAmount(0);
    setIsModalOpen(true);
  };

  // Combo-pricing handlers for TOP_UP
  const handleTopUpTeacherChange = async (teacher: Teacher | null) => {
    setTopUpTeacher(teacher);
    setTopUpInstrument('');
    setTopUpPricing(null);
    setCalculatedAmount(0);
    setTopUpLessons(0);
    if (teacher) {
      const pricingList = await getTeacherPricingList(teacher.id!);
      setAvailableInstruments(pricingList.map(p => p.instrument));
    } else {
      setAvailableInstruments([]);
    }
  };

  const handleTopUpInstrumentChange = async (instrument: string) => {
    setTopUpInstrument(instrument);
    setCalculatedAmount(0);
    setTopUpLessons(0);
    if (topUpTeacher && instrument) {
      const pricing = await getPricing(topUpTeacher.id!, instrument);
      setTopUpPricing(pricing);
    } else {
      setTopUpPricing(null);
    }
  };

  const handleTopUpLessonsChange = async (lessons: number) => {
    setTopUpLessons(lessons);
    if (topUpPricing && lessons > 0) {
      const price = await calculatePackagePrice(topUpPricing, lessons);
      setCalculatedAmount(price);
    } else {
      setCalculatedAmount(0);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredTransactions.map(t => ({
      '日期': t.date,
      '類型': t.type === 'TOP_UP' ? '儲值' : t.type === 'TEACHER_PAYOUT' ? '撥款' : t.type === 'EXPENSE' ? '支出' : '收入',
      '會計科目': t.category || (t.type === 'TOP_UP' ? '課程營收' : '一般項目'),
      '對象': t.userName,
      '備註': t.description,
      '金額': t.amount,
      '方式': t.paymentMethod === 'CASH' ? '現金' : '匯款',
      '帳號末五碼': t.accountSuffix || ''
    }));
    exportToExcel(exportData, `財務流水帳_${new Date().toISOString().split('T')[0]}`);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsLoading(true);
    try {
      const data = await importFromExcel(file);
      for (const row of data) {
        const amount = Number(row['金額']);
        if (isNaN(amount)) continue;

        await addTransaction({
          date: row['日期'] || new Date().toISOString().split('T')[0],
          type: row['類型'] === '儲值' ? 'TOP_UP' : row['類型'] === '撥款' ? 'TEACHER_PAYOUT' : (amount < 0 ? 'EXPENSE' : 'OTHER_INCOME'),
          category: row['會計科目'] || '一般項目',
          userName: row['對象'] || '系統載入',
          description: row['備註'] || '',
          amount: amount,
          paymentMethod: row['方式'] === '匯款' ? 'TRANSFER' : 'CASH',
          accountSuffix: row['帳號末五碼'] || '',
          userId: 'SYSTEM'
        } as Transaction);
      }
      fetchData();
      alert(`成功載入 ${data.length} 筆資料`);
    } catch (err) {
      alert('Excel 載入失敗，請檢查格式是否正確。');
    }
    setIsLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 篩選與統計邏輯
  const filteredTransactions = transactions.filter(t => {
    if (filterRange === 'ALL') return true;
    const tDate = new Date(t.date);
    const now = new Date();
    if (filterRange === 'WEEK') {
        const diff = (now.getTime() - tDate.getTime()) / (1000 * 3600 * 24);
        return diff <= 7;
    }
    if (filterRange === 'MONTH') {
        return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const teacherStats = teachers.map(teacher => {
    const teacherTxs = transactions.filter(t => t.userId === teacher.id && t.type === 'TEACHER_PAYOUT');
    const totalPayout = Math.abs(teacherTxs.reduce((acc, t) => acc + t.amount, 0));
    return { name: teacher.name, totalPayout };
  }).filter(s => s.totalPayout > 0);

  // --- Analytics Logic ---
  const currentMonthTxs = transactions.filter(t => t.date.startsWith(analyticsMonth));
  
  const analyticsRevenueTxs = currentMonthTxs.filter(t => t.amount > 0);
  const analyticsExpenseTxs = currentMonthTxs.filter(t => t.amount < 0);
  
  const totalRevenue = analyticsRevenueTxs.reduce((sum, t) => sum + t.amount, 0);
  const analyticsTotalExpense = Math.abs(analyticsExpenseTxs.reduce((sum, t) => sum + t.amount, 0));
  const netProfit = totalRevenue - analyticsTotalExpense;

  const revenueByCategory = analyticsRevenueTxs.reduce((acc, t) => {
    const cat = t.category || (t.type === 'TOP_UP' ? '課程營收' : '一般收入');
    acc[cat] = (acc[cat] || 0) + t.amount;
    return acc;
  }, {} as Record<string, number>);

  const expenseByCategory = analyticsExpenseTxs.reduce((acc, t) => {
    const cat = t.category || (t.type === 'TEACHER_PAYOUT' ? '教師薪資' : '一般支出');
    acc[cat] = (acc[cat] || 0) + Math.abs(t.amount);
    return acc;
  }, {} as Record<string, number>);
  // -----------------------

  const handleTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const form = new FormData(e.currentTarget);

    const amount = Number(form.get('amount'));
    const description = form.get('description') as string;
    const paymentMethod = form.get('paymentMethod') as 'CASH' | 'TRANSFER';
    const accountSuffix = form.get('accountSuffix') as string;
    const date = new Date().toISOString().split('T')[0];

    try {
      if (modalType === 'TOP_UP') {
        const studentIdx = form.get('studentIdx') as string;
        const student = students[parseInt(studentIdx)];
        const lessons = topUpLessons || (Number(form.get('lessons')) || 0);
        // Use calculated amount if available, otherwise fall back to manual amount
        const finalAmount = calculatedAmount > 0 ? calculatedAmount : amount;

        if (editingTx) {
          await updateTransaction(editingTx.id!, {
            userId: student.id!,
            userName: student.name,
            amount: finalAmount,
            description: description,
            paymentMethod,
            accountSuffix,
            teacherId: topUpTeacher?.id,
            instrument: topUpInstrument || undefined,
          });
        } else {
          await addTransaction({
            userId: student.id!,
            userName: student.name,
            type: 'TOP_UP',
            category: '預收款(儲值)',
            amount: finalAmount,
            description: topUpTeacher
              ? `${topUpTeacher.name}/${topUpInstrument} - ${lessons}堂課程儲値`
              : description,
            paymentMethod,
            accountSuffix,
            date,
            teacherId: topUpTeacher?.id || undefined,
            instrument: topUpInstrument || undefined,
          });
          await updateStudentBalance(student.id!, finalAmount, lessons, topUpTeacher?.id, topUpInstrument);
        }

      } else if (modalType === 'TEACHER_PAYOUT') {
        const teacherIdx = form.get('teacherIdx') as string;
        const teacher = teachers[parseInt(teacherIdx)];

        if (editingTx) {
          await updateTransaction(editingTx.id!, {
            userId: teacher.id!,
            userName: teacher.name,
            amount: -Math.abs(amount), 
            description: description,
            paymentMethod,
            accountSuffix
          });
        } else {
          await addTransaction({
            userId: teacher.id!,
            userName: teacher.name,
            type: 'TEACHER_PAYOUT',
            category: '教師薪資',
            amount: -Math.abs(amount), 
            description: description,
            paymentMethod,
            accountSuffix,
            date
          } as Transaction);
        }

      } else if (modalType === 'EXPENSE') {
        if (editingTx) {
          await updateTransaction(editingTx.id!, {
            amount: -Math.abs(amount), 
            description: description,
            category: form.get('category') as string,
            paymentMethod,
            accountSuffix
          });
        } else {
          await addTransaction({
            userId: 'SYSTEM',
            userName: '營運系統',
            type: 'EXPENSE',
            category: form.get('category') as string,
            amount: -Math.abs(amount), 
            description: description,
            paymentMethod,
            accountSuffix,
            date
          } as Transaction);
        }
      } else if (modalType === 'OTHER_INCOME') {
        const category = form.get('category') as string;
        let finalType: Transaction['type'] = 'OTHER_INCOME';
        if (category === '樂器買賣') finalType = 'SALES';
        if (category === '樂譜販售') finalType = 'SALES';
        if (category === '場地租借') finalType = 'RENTAL';

        if (editingTx) {
          await updateTransaction(editingTx.id!, {
            userId: 'SYSTEM',
            userName: '客座/零售/租借',
            type: finalType,
            category: category,
            amount: amount,
            description: description,
            paymentMethod,
            accountSuffix
          });
        } else {
          await addTransaction({
            userId: 'SYSTEM',
            userName: '客座/零售/租借',
            type: finalType,
            category: category,
            amount: amount,
            description: description,
            paymentMethod,
            accountSuffix,
            date
          } as Transaction);
        }
      }
      
      setIsModalOpen(false);
      setEditingTx(null);
      // Reload UI and data
      setStudents(await getStudents()); 
      setTransactions(await getTransactions());
    } catch (e) {
      alert("儲存失敗，請檢查 Firebase 權限。");
    }
    setIsSubmitting(false);
  };

  const totalIncome = filteredTransactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = Math.abs(filteredTransactions.filter(t => t.amount < 0).reduce((acc, t) => acc + t.amount, 0));
  const netRevenue = totalIncome - totalExpense;

  return (
    <main className="flex min-h-screen flex-col items-center pb-24 relative overflow-x-hidden bg-[#f8f7f2]">
      <div className="absolute top-[20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#ece4d9] blur-[150px] opacity-70 -z-10"></div>
      
      {/* Mini Navbar */}
      <div className="w-full max-w-7xl px-4 pt-6 z-40 mb-12">
        <nav className="glass-nav px-8 py-5 flex justify-between items-center shadow-sm">
          <div className="flex gap-8 items-center">
            <Link href="/" className="flex items-center gap-4 cursor-pointer hover:-translate-y-1 transition-transform">
              <div className="w-12 h-12 rounded-full border-2 border-[#4a4238] flex items-center justify-center font-serif text-xl font-bold text-[#4a4238]">7th</div>
              <h1 className="font-serif font-black text-xl tracking-[0.2em] text-[#4a4238]">返回</h1>
            </Link>
            <button onClick={async () => { await logout(); router.push('/login'); }} className="text-[10px] font-black tracking-widest text-[#4a4238]/40 hover:text-red-400 transition-colors uppercase">
               [ Secure Logout ⎋ ]
            </button>
          </div>
          <h2 className="font-serif font-black text-2xl md:text-3xl tracking-[0.15em] text-[#c4a484] drop-shadow-sm">智能財務與核銷</h2>
        </nav>
      </div>

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
        
        {/* KPI 財務儀表板 Dashboard */}
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

        {/* 老師薪資統計摘要 Teacher Stats */}
        <div className="w-full mb-12 animate-in slide-in-from-bottom duration-500">
           <h4 className="font-black tracking-[0.2em] text-[#4a4238] text-sm mb-4 px-2 flex justify-between items-center">
             <span>👨‍🏫 教師薪資與核銷摘要 ({analyticsMonth})</span>
             <span className="text-[10px] opacity-40">應付 = 課表已排堂數之總和 | 已付 = 財務撥款紀錄</span>
           </h4>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {teachers.map(teacher => {
                const accrued = monthAccruedStats[teacher.id!] || { totalPayout: 0, lessonCount: 0 };
                const teacherTxs = transactions.filter(t => t.userId === teacher.id && t.type === 'TEACHER_PAYOUT' && t.date.startsWith(analyticsMonth));
                const paid = Math.abs(teacherTxs.reduce((acc, t) => acc + t.amount, 0));
                
                if (accrued.totalPayout === 0 && paid === 0) return null;

                return (
                  <div key={teacher.id} className="bg-white p-5 rounded-2xl border-2 border-[#ece4d9] shadow-sm flex flex-col gap-3 group hover:border-[#c4a484] transition-all">
                    <div className="flex justify-between items-center">
                       <span className="font-black text-[#4a4238]">{teacher.name}</span>
                       <span className="text-[10px] bg-[#ece4d9] px-2 py-0.5 rounded-full font-bold">已教 {accrued.lessonCount} 堂</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center border-t border-[#ece4d9] pt-3">
                       <div>
                          <p className="text-[9px] font-black text-[#c4a484] tracking-widest uppercase">應付薪資</p>
                          <p className="font-mono font-black text-sm text-[#4a4238]">${accrued.totalPayout.toLocaleString()}</p>
                       </div>
                       <div className="border-l border-[#ece4d9]">
                          <p className="text-[9px] font-black text-emerald-500/70 tracking-widest uppercase">已發薪資</p>
                          <p className="font-mono font-black text-sm text-[#4a4238]">${paid.toLocaleString()}</p>
                       </div>
                    </div>
                    {accrued.totalPayout > paid && (
                       <p className="text-[10px] text-red-400 font-bold text-center bg-red-50 rounded-lg py-1">
                          ⚠️ 尚餘 ${ (accrued.totalPayout - paid).toLocaleString() } 未撥款
                       </p>
                    )}
                    {accrued.totalPayout > 0 && accrued.totalPayout <= paid && (
                       <p className="text-[10px] text-emerald-500 font-bold text-center bg-emerald-50 rounded-lg py-1">
                          ✅ 核銷完成
                       </p>
                    )}
                  </div>
                );
              })}
           </div>
        </div>

        <div className="elegant-card w-full p-8 md:p-12 min-h-[50vh] flex flex-col relative overflow-hidden">
          {/* Header */}
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
            
            {/* Quick Actions (Only in List View) */}
            {viewMode === 'LIST' && (
              <div className="flex flex-wrap gap-4">
              <div className="flex bg-[#ece4d9]/30 p-1 rounded-full mr-4 border border-[#ece4d9]">
                {(['ALL', 'WEEK', 'MONTH'] as const).map(r => (
                  <button 
                    key={r}
                    onClick={() => setFilterRange(r)}
                    className={`px-6 py-2 rounded-full text-xs font-black tracking-widest transition-all ${filterRange === r ? 'bg-[#4a4238] text-white shadow-md' : 'text-[#4a4238] hover:bg-white'}`}>
                    {r === 'ALL' ? '全部' : r === 'WEEK' ? '近一週' : '本月份'}
                  </button>
                ))}
              </div>
              {canEdit && (
                <>
                  <button onClick={() => { setModalType('TOP_UP'); setIsModalOpen(true); }} className="bg-[#c4a484] hover:bg-[#b09070] text-white px-6 py-3 border border-white rounded-full text-sm font-bold tracking-[0.1em] shadow-lg transition-all hover:-translate-y-1">
                     📈 學生儲值
                  </button>
                  <button onClick={() => { setModalType('TEACHER_PAYOUT'); setIsModalOpen(true); }} className="bg-white hover:bg-gray-50 text-[#4a4238] px-6 py-3 border-2 border-[#4a4238]/20 rounded-full text-sm font-bold tracking-[0.1em] shadow-md transition-all hover:-translate-y-1">
                     📉 鐘點費
                  </button>
                  <button onClick={() => { setModalType('OTHER_INCOME'); setIsModalOpen(true); }} className="bg-white hover:bg-gray-50 text-blue-500/70 px-6 py-3 border-2 border-blue-500/20 rounded-full text-sm font-bold tracking-[0.1em] shadow-md transition-all hover:-translate-y-1">
                     💰 收入
                  </button>
                  <button onClick={() => { setModalType('EXPENSE'); setIsModalOpen(true); }} className="bg-white hover:bg-gray-50 text-red-500/70 px-6 py-3 border-2 border-red-500/20 rounded-full text-sm font-bold tracking-[0.1em] shadow-md transition-all hover:-translate-y-1">
                     📄 支出
                  </button>
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
                <input type="file" ref={fileInputRef} onChange={handleImportExcel} hidden accept=".xlsx, .xls" />
              </div>
            </div>
            )}
            
            {/* Analytics Header Actions (Month Selector) */}
            {viewMode === 'ANALYTICS' && (
              <div className="flex items-center gap-4 bg-white border-2 border-[#ece4d9] px-6 py-3 rounded-2xl shadow-sm">
                 <label className="font-bold text-[#4a4238] tracking-widest text-sm">選擇分析月份：</label>
                 <input 
                   type="month" 
                   value={analyticsMonth} 
                   onChange={(e) => setAnalyticsMonth(e.target.value)} 
                   className="font-mono text-[#c4a484] font-black text-lg focus:outline-none bg-transparent"
                 />
              </div>
            )}
          </div>

          {viewMode === 'LIST' ? (
            <>
              {/* === 明細列表 View === */}
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
                        <th className="py-5 px-8">日期</th>
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
                          <td className={`py-5 px-8 font-black text-xl font-mono ${t.amount > 0 ? 'text-[#c4a484]' : 'text-red-500/80'}`}>
                             {t.amount > 0 ? '+' : ''}{t.amount.toLocaleString()}
                          </td>
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

          {/* 會計科目管理 UI Accounting Categories Management */}
          {canEdit && (
            <div className="mt-12 bg-[#ece4d9]/10 rounded-[30px] p-8 border-2 border-dashed border-[#ece4d9] relative z-10">
               <h4 className="font-black tracking-[0.2em] text-[#4a4238] text-sm mb-6 flex items-center gap-2">
                  📂 靈活會計科目管理
                  <span className="text-[10px] font-normal opacity-50 italic">(您可以在此自由擴充科目，並在記帳時選用)</span>
               </h4>
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
                  <input 
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    placeholder="輸入新科目名稱 (例如：樂器購買)" 
                    className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-6 py-4 flex-grow font-bold focus:outline-none focus:border-[#c4a484] transition-all" 
                  />
                  <button 
                    onClick={handleAddCategory}
                    className="bg-[#4a4238] hover:bg-[#c4a484] text-white px-10 py-4 rounded-2xl font-black tracking-widest transition-all">
                    + 新增科目
                  </button>
               </div>
            </div>
          )}
          </>
        ) : (
          /* === 營運分析 Analytics View === */
          <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-500">
             {/* Metrics Row */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="bg-white rounded-[30px] p-8 border-2 border-[#ece4d9] flex flex-col items-center justify-center relative overflow-hidden group hover:-translate-y-2 transition-transform shadow-sm hover:shadow-xl">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-[100px] z-0"></div>
                 <h4 className="text-[#4a4238]/60 font-black tracking-[0.2em] text-sm mb-4 relative z-10">本月總收入</h4>
                 <div className="text-4xl font-mono font-black text-[#c4a484] relative z-10 flex items-center gap-2">
                   <span className="text-2xl text-[#c4a484]/50">$</span>
                   {totalRevenue.toLocaleString()}
                 </div>
               </div>
               <div className="bg-white rounded-[30px] p-8 border-2 border-[#ece4d9] flex flex-col items-center justify-center relative overflow-hidden group hover:-translate-y-2 transition-transform shadow-sm hover:shadow-xl">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-bl-[100px] z-0"></div>
                 <h4 className="text-[#4a4238]/60 font-black tracking-[0.2em] text-sm mb-4 relative z-10">本月總支出</h4>
                 <div className="text-4xl font-mono font-black text-red-500/80 relative z-10 flex items-center gap-2">
                   <span className="text-2xl text-red-500/40">$</span>
                   {analyticsTotalExpense.toLocaleString()}
                 </div>
               </div>
               <div className={`rounded-[30px] p-8 border-2 flex flex-col items-center justify-center relative overflow-hidden group hover:-translate-y-2 transition-transform shadow-md hover:shadow-xl ${netProfit >= 0 ? 'bg-[#4a4238] border-[#4a4238]' : 'bg-red-50 border-red-200'}`}>
                 <h4 className={`font-black tracking-[0.2em] text-sm mb-4 relative z-10 ${netProfit >= 0 ? 'text-[#ece4d9]/80' : 'text-red-800'}`}>結算淨利 (Net Profit)</h4>
                 <div className={`text-5xl font-mono font-black relative z-10 flex items-center gap-2 ${netProfit >= 0 ? 'text-white' : 'text-red-500'}`}>
                   <span className={`text-3xl opacity-50`}>{netProfit < 0 ? '-' : ''}$</span>
                   {Math.abs(netProfit).toLocaleString()}
                 </div>
               </div>
             </div>

             {/* Breakdown Row */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
               {/* Income Breakdown */}
               <div className="bg-white/70 backdrop-blur-md rounded-[30px] p-8 border-2 border-[#ece4d9] shadow-sm">
                 <h4 className="font-black tracking-[0.2em] text-[#4a4238] text-lg mb-8 flex items-center gap-3">
                   <span className="bg-[#c4a484] text-white p-2 rounded-xl">💰</span> 收入會計科目佔比
                 </h4>
                 {Object.keys(revenueByCategory).length === 0 ? (
                    <p className="text-center text-[#4a4238]/40 font-bold py-10">本月尚無收入資料</p>
                 ) : (
                   <div className="flex flex-col gap-6">
                     {Object.entries(revenueByCategory).sort((a,b) => b[1] - a[1]).map(([cat, amt]) => (
                       <div key={cat} className="w-full">
                         <div className="flex justify-between items-end mb-2">
                           <span className="font-bold text-[#4a4238] tracking-widest">{cat}</span>
                           <span className="font-mono text-[#c4a484] font-black">${amt.toLocaleString()}</span>
                         </div>
                         <div className="h-3 w-full bg-[#ece4d9]/50 rounded-full overflow-hidden">
                           <div 
                             className="h-full bg-gradient-to-r from-[#c4a484] to-[#e2d5c5] rounded-full" 
                             style={{ width: `${Math.max(5, (amt / totalRevenue) * 100)}%` }}
                           />
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
               </div>

               {/* Expense Breakdown */}
               <div className="bg-white/70 backdrop-blur-md rounded-[30px] p-8 border-2 border-[#ece4d9] shadow-sm">
                 <h4 className="font-black tracking-[0.2em] text-[#4a4238] text-lg mb-8 flex items-center gap-3">
                   <span className="bg-red-400 text-white p-2 rounded-xl">📉</span> 支出會計科目佔比
                 </h4>
                 {Object.keys(expenseByCategory).length === 0 ? (
                    <p className="text-center text-[#4a4238]/40 font-bold py-10">本月尚無支出資料</p>
                 ) : (
                   <div className="flex flex-col gap-6">
                     {Object.entries(expenseByCategory).sort((a,b) => b[1] - a[1]).map(([cat, amt]) => (
                       <div key={cat} className="w-full">
                         <div className="flex justify-between items-end mb-2">
                           <span className="font-bold text-[#4a4238] tracking-widest">{cat}</span>
                           <span className="font-mono text-red-400 font-black">${amt.toLocaleString()}</span>
                         </div>
                         <div className="h-3 w-full bg-[#ece4d9]/50 rounded-full overflow-hidden">
                           <div 
                             className="h-full bg-gradient-to-r from-red-400 to-red-300 rounded-full" 
                             style={{ width: `${Math.max(5, (amt / analyticsTotalExpense) * 100)}%` }}
                           />
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             </div>
          </div>
        )}
      </div>
     </div>
    )}

    {/* Modal / Dialog */}
    {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#4a4238]/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#f8f7f2] w-full max-w-xl rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] p-10 relative border-2 border-white max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center rounded-full bg-[#ece4d9]/50 text-[#4a4238] hover:bg-[#c4a484] hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
             <h3 className="font-serif text-3xl font-black tracking-[0.2em] text-[#4a4238] mb-8 border-b-2 border-[#ece4d9] pb-6 flex items-baseline gap-4">
               {modalType === 'TOP_UP' && (editingTx ? '修改儲值紀錄' : '學生課卡建立與儲值')}
               {modalType === 'TEACHER_PAYOUT' && (editingTx ? '修改撥款紀錄' : '教師鐘點費下發')}
               {modalType === 'OTHER_INCOME' && (editingTx ? '修改收入紀錄' : '其他項目收入登記')}
               {modalType === 'EXPENSE' && (editingTx ? '修改支出紀錄' : '營運雜支/其他紀錄')}
             </h3>

            <form onSubmit={handleTransaction} className="flex flex-col gap-6">
              
              {modalType === 'TOP_UP' && (
                <>
                  {/* Step 1: 選學生 */}
                  <div>
                    <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">① 選擇學生</label>
                    <select required name="studentIdx" defaultValue={editingTx ? students.findIndex(s => s.id === editingTx.userId) : 0} className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-[#4a4238] focus:outline-none focus:border-[#c4a484] transition-all">
                      {students.map((s, i) => <option key={s.id} value={i}>{s.name} (剩餘: {s.remainingLessons} 堂)</option>)}
                    </select>
                  </div>

                  {/* Step 2: 選老師+樂器組合 */}
                  <div className="bg-[#f0ebe4] rounded-2xl p-5 flex flex-col gap-4 border border-[#e2d5c5]">
                    <p className="text-xs font-black tracking-[0.2em] text-[#4a4238]/60 uppercase">② 選擇課程組合 (老師 + 樂器)</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black tracking-widest text-[#4a4238] mb-2">授課老師</label>
                        <select
                          className="w-full bg-white border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-bold text-[#4a4238]"
                          value={topUpTeacher?.id || ''}
                          onChange={e => {
                            const t = teachers.find(t => t.id === e.target.value) || null;
                            handleTopUpTeacherChange(t);
                          }}
                        >
                          <option value="">— 選擇老師 —</option>
                          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-black tracking-widest text-[#4a4238] mb-2">
                          樂器 {topUpTeacher && availableInstruments.length === 0 && <span className="text-red-400">(尚未設定定價)</span>}
                        </label>
                        <select
                          className="w-full bg-white border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-bold text-[#4a4238] disabled:opacity-40"
                          value={topUpInstrument}
                          disabled={!topUpTeacher || availableInstruments.length === 0}
                          onChange={e => handleTopUpInstrumentChange(e.target.value)}
                        >
                          <option value="">— 選擇樂器 —</option>
                          {availableInstruments.map(inst => <option key={inst} value={inst}>{inst}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Step 3: 堂數 + 即時計算 */}
                    {topUpPricing && (
                      <div className="flex flex-col gap-4 mt-2 animate-in fade-in duration-300">
                        {/* Tier preview */}
                        <div className="bg-white rounded-xl p-4 border border-[#ece4d9]">
                          <p className="text-[10px] font-black tracking-[0.2em] text-[#4a4238]/50 mb-3">📊 定價階梯</p>
                          <div className="flex flex-wrap gap-2">
                            {topUpPricing.tiers.map((tier, i) => {
                              const nextMin = topUpPricing.tiers[i+1]?.minLessons;
                              const label = nextMin ? `${tier.minLessons}~${nextMin-1} 堂` : `${tier.minLessons}+ 堂`;
                              const isActive = topUpLessons >= tier.minLessons && (!nextMin || topUpLessons < nextMin);
                              return (
                                <span key={i} className={`px-3 py-1 rounded-full text-xs font-black border transition-all ${isActive ? 'bg-[#4a4238] text-white border-[#4a4238]' : 'bg-white text-[#4a4238] border-[#ece4d9]'}`}>
                                  {label}: ${tier.rate.toLocaleString()}/堂
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 items-end">
                          <div>
                            <label className="block text-xs font-black tracking-widest text-[#4a4238] mb-2">③ 購買堂數</label>
                            <input
                              type="number"
                              min="1"
                              value={topUpLessons || ''}
                              onChange={e => handleTopUpLessonsChange(Number(e.target.value))}
                              className="w-full bg-white border-2 border-[#c4a484] rounded-xl px-4 py-3 font-black text-xl text-[#4a4238] focus:outline-none"
                              placeholder="輸入堂數"
                            />
                          </div>
                          <div className="bg-[#4a4238] rounded-xl px-4 py-3 text-center">
                            <p className="text-[#ece4d9]/60 text-[10px] font-black tracking-widest">自動計算總金額</p>
                            <p className="text-white text-2xl font-mono font-black">${calculatedAmount.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Fallback: manual amount if no combo selected */}
                  {!topUpPricing && (
                    <div>
                      <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">
                        ③ 儲值金額 <span className="text-[#4a4238]/40 font-normal text-xs">(未選定組合時手動輸入)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[#c4a484] font-black text-xl">$</span>
                        <input
                          type="number"
                          required={!topUpPricing}
                          name="amount"
                          defaultValue={editingTx?.amount || ''}
                          className="w-full bg-white border-2 border-[#ece4d9] text-[#4a4238] rounded-2xl px-12 py-4 font-mono font-black text-2xl focus:outline-none focus:border-[#c4a484] transition-all"
                          placeholder="例如：10000"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">收款方式</label>
                      <select required name="paymentMethod" className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-[#4a4238]">
                        <option value="CASH">💵 現金</option>
                        <option value="TRANSFER">🏦 銀行匯款</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">帳號尾數 (匯款必填)</label>
                      <input name="accountSuffix" placeholder="末五碼" className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-[#4a4238]" />
                    </div>
                  </div>

                  {!topUpPricing && (
                    <div>
                      <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">備註說明</label>
                      <input
                        required
                        name="description"
                        defaultValue={editingTx?.description || '學生儲值'}
                        className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-base text-[#4a4238] focus:outline-none focus:border-[#c4a484] transition-all"
                      />
                    </div>
                  )}
                </>
              )}

              {modalType === 'TEACHER_PAYOUT' && (
                <>
                  <div>
                    <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">選擇撥款教師</label>
                    <select required name="teacherIdx" className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-[#4a4238] focus:outline-none focus:border-[#c4a484] transition-all">
                      {teachers.map((t, i) => <option key={t.id} value={i}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">撥款金額 (-)</label>
                    <input type="number" required name="amount" defaultValue={editingTx ? Math.abs(editingTx.amount) : ''} className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-red-400 focus:outline-none focus:border-[#c4a484] transition-all" placeholder="例如：3200" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">發放方式</label>
                      <select required name="paymentMethod" className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-[#4a4238]">
                        <option value="CASH">💵 現金</option>
                        <option value="TRANSFER">🏦 銀行匯款</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">帳號尾數</label>
                      <input name="accountSuffix" placeholder="末五碼" className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-[#4a4238]" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">備註說明</label>
                    <input required name="description" defaultValue="課程薪資撥款" className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-base text-[#4a4238] focus:outline-none focus:border-[#c4a484] transition-all" />
                  </div>
                </>
              )}

              {modalType === 'OTHER_INCOME' && (
                <>
                  <div>
                    <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">收入科目 (會計科目)</label>
                    <select required name="category" defaultValue={editingTx?.category || ''} className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-[#4a4238]">
                      {categories.filter(c => !["教師薪資", "雜支"].includes(c)).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">收入金額 (+)</label>
                    <input type="number" required name="amount" defaultValue={editingTx ? Math.abs(editingTx.amount) : ''} className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-[#c4a484] focus:outline-none focus:border-[#c4a484] transition-all" placeholder="例如：2500" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">收款方式</label>
                      <select required name="paymentMethod" className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-[#4a4238]">
                        <option value="CASH">💵 現金</option>
                        <option value="TRANSFER">🏦 銀行匯款</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">帳號尾數</label>
                      <input name="accountSuffix" placeholder="末五碼" className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-[#4a4238]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">備註說明</label>
                    <input required name="description" defaultValue={editingTx?.description || ''} placeholder="例如：購買小提琴弦一套" className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-base text-[#4a4238] focus:outline-none focus:border-[#c4a484] transition-all" />
                  </div>
                </>
              )}

              {modalType === 'EXPENSE' && (
                <>
                  <div>
                    <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">支出科目 (會計科目)</label>
                    <select required name="category" defaultValue={editingTx?.category || ''} className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-[#4a4238]">
                       {categories.filter(c => !["課程營收", "樂器買賣", "場地租借", "樂譜販售", "其他收入"].includes(c)).map(c => (
                         <option key={c} value={c}>{c}</option>
                       ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">項目金額 (-)</label>
                    <input type="number" required name="amount" defaultValue={editingTx ? Math.abs(editingTx.amount) : ''} className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-red-400 focus:outline-none focus:border-[#c4a484] transition-all" placeholder="例如：1500" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">支出方式</label>
                      <select required name="paymentMethod" className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-[#4a4238]">
                        <option value="CASH">💵 現金</option>
                        <option value="TRANSFER">🏦 銀行匯款</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">帳號尾數</label>
                      <input name="accountSuffix" placeholder="末五碼" className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-[#4a4238]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">備註說明</label>
                    <input required name="description" defaultValue={editingTx?.description || "日常經營支出"} className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-base text-[#4a4238] focus:outline-none focus:border-[#c4a484] transition-all" />
                  </div>
                </>
              )}


              <button type="submit" disabled={isSubmitting} className="mt-8 bg-[#4a4238] disabled:bg-gray-400 hover:bg-[#c4a484] text-white font-bold tracking-[0.3em] py-5 px-6 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 text-lg hover:-translate-y-1">
                {isSubmitting ? '加密計算中...' : '確認並存入總帳'}
              </button>
            </form>
          </div>
        </div>
       )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-300">
             <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
               <span className="text-red-500 text-3xl">⚠️</span>
             </div>
             <h2 className="text-xl font-bold text-center text-[#4a4238] mb-2 tracking-widest">
               確定要刪除這筆{itemToDelete?.type === 'CATEGORY' ? '會計科目' : '交易紀錄'}嗎？
             </h2>
             <p className="text-center text-[#4a4238]/60 text-sm mb-6 font-bold tracking-widest">刪除後將無法復原，請謹慎操作。</p>
             <div className="flex gap-4">
               <button 
                 onClick={() => setIsDeleteModalOpen(false)}
                 className="flex-1 py-3 bg-[#ece4d9] text-[#4a4238] font-bold rounded-xl tracking-widest hover:bg-[#e2d5c5] transition-colors"
               >
                 取消
               </button>
               <button 
                 onClick={executeDelete}
                 className="flex-1 py-3 bg-red-400 text-white font-bold rounded-xl tracking-widest hover:bg-red-500 transition-colors shadow-lg shadow-red-400/30"
               >
                 確認刪除
               </button>
             </div>
           </div>
        </div>
      )}

    </main>
  );
}
