import { useState, useEffect } from 'react';
import {
  getTransactions,
  addTransaction,
  updateStudentBalance,
  getCategories,
  addCategory,
  deleteCategory,
  updateTransaction,
  deleteTransaction
} from '@/lib/services/finance';
import { getStudents, getTeachers } from '@/lib/services/db';
import { Student, Teacher } from '@/lib/types/user';
import { Transaction } from '@/lib/types/finance';
import { exportToExcel, importFromExcel } from '@/lib/utils/excel';
import { getMonthTeacherStats, getLessonsByMonth } from '@/lib/services/schedule';

export const useFinance = (canEdit: boolean) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'TOP_UP' | 'TEACHER_PAYOUT' | 'EXPENSE' | 'OTHER_INCOME'>('TOP_UP');

  const [categories, setCategories] = useState<string[]>([]);
  const [filterRange, setFilterRange] = useState<'ALL' | 'WEEK' | 'MONTH' | 'CUSTOM'>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  const [viewMode, setViewMode] = useState<'LIST' | 'ANALYTICS'>('LIST');
  const [analyticsMonth, setAnalyticsMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [monthLessons, setMonthLessons] = useState<any[]>([]);
  const [monthAccruedStats, setMonthAccruedStats] = useState<any[]>([]);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'CATEGORY' | 'TRANSACTION', id: string } | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const txs = await getTransactions();
      setTransactions(txs);

      const accrued = await getMonthTeacherStats(analyticsMonth);
      setMonthAccruedStats(accrued as any);

      const mLessons = await getLessonsByMonth(analyticsMonth);
      setMonthLessons(mLessons);

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

  useEffect(() => {
    fetchData();
  }, [analyticsMonth]);

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
    setIsModalOpen(true);
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

  const handleImportExcel = async (file: File) => {
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
          userId: 'SYSTEM',
          createdAt: Date.now()
        } as Transaction);
      }
      fetchData();
      alert(`成功載入 ${data.length} 筆資料`);
    } catch (err) {
      alert('Excel 載入失敗，請檢查格式是否正確。');
    }
    setIsLoading(false);
  };

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
    if (filterRange === 'CUSTOM') {
      if (!startDate || !endDate) return true;
      return t.date >= startDate && t.date <= endDate;
    }
    return true;
  })
    .filter(t => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const category = (t.category || (t.type === 'TOP_UP' ? '課程營收' : '一般項目')).toLowerCase();
      const userName = (t.userName || '').toLowerCase();
      const description = (t.description || '').toLowerCase();
      return category.includes(q) || userName.includes(q) || description.includes(q);
    })
    .sort((a, b) => {
      if (sortOrder === 'ASC') return a.date.localeCompare(b.date);
      return b.date.localeCompare(a.date);
    });

  const handleSaveTransaction = async (formData: any) => {
    const { amount, description, paymentMethod, accountSuffix, category: formCategory, targetIdx, topUpLessons, topUpTeacherId, topUpInstrument, calculatedAmount } = formData;
    const date = new Date().toISOString().split('T')[0];

    try {
      if (modalType === 'TOP_UP') {
        const student = students[targetIdx];
        const lessons = topUpLessons || 0;
        const finalAmount = calculatedAmount > 0 ? calculatedAmount : amount;

        if (editingTx) {
          await updateTransaction(editingTx.id!, {
            userId: student.id!,
            userName: student.name,
            amount: finalAmount,
            description: description,
            paymentMethod,
            accountSuffix,
            teacherId: topUpTeacherId,
            instrument: topUpInstrument || undefined,
          });
        } else {
          await addTransaction({
            userId: student.id!,
            userName: student.name,
            type: 'TOP_UP',
            category: '預收款(儲值)',
            amount: finalAmount,
            description: description,
            paymentMethod,
            accountSuffix,
            date,
            teacherId: topUpTeacherId || undefined,
            instrument: topUpInstrument || undefined,
            createdAt: Date.now()
          });
          await updateStudentBalance(student.id!, finalAmount, lessons, topUpTeacherId, topUpInstrument);
        }

      } else if (modalType === 'TEACHER_PAYOUT') {
        const teacher = teachers[targetIdx];
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
            date,
            createdAt: Date.now()
          } as Transaction);
        }

      } else if (modalType === 'EXPENSE') {
        if (editingTx) {
          await updateTransaction(editingTx.id!, {
            amount: -Math.abs(amount),
            description: description,
            category: formCategory,
            paymentMethod,
            accountSuffix
          });
        } else {
          await addTransaction({
            userId: 'SYSTEM',
            userName: '營運系統',
            type: 'EXPENSE',
            category: formCategory,
            amount: -Math.abs(amount),
            description: description,
            paymentMethod,
            accountSuffix,
            date,
            createdAt: Date.now()
          } as Transaction);
        }
      } else if (modalType === 'OTHER_INCOME') {
        let finalType: Transaction['type'] = 'OTHER_INCOME';
        if (formCategory === '樂器買賣') finalType = 'SALES';
        if (formCategory === '樂譜販售') finalType = 'SALES';
        if (formCategory === '場地租借') finalType = 'RENTAL';

        if (editingTx) {
          await updateTransaction(editingTx.id!, {
            userId: 'SYSTEM',
            userName: '客座/零售/租借',
            type: finalType,
            category: formCategory,
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
            category: formCategory,
            amount: amount,
            description: description,
            paymentMethod,
            accountSuffix,
            date,
            createdAt: Date.now()
          } as Transaction);
        }
      }

      setIsModalOpen(false);
      setEditingTx(null);
      await fetchData();
    } catch (e) {
      alert("儲存失敗，請檢查 Firebase 權限。");
    }
  };

  const totalIncome = filteredTransactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = Math.abs(filteredTransactions.filter(t => t.amount < 0).reduce((acc, t) => acc + t.amount, 0));
  const netRevenue = totalIncome - totalExpense;

  const currentMonthTxs = transactions.filter(t => t.date.startsWith(analyticsMonth));
  const analyticsRevenueTxs = currentMonthTxs.filter(t => t.amount > 0);
  const analyticsExpenseTxs = currentMonthTxs.filter(t => t.amount < 0);
  const totalRevenueMonth = analyticsRevenueTxs.reduce((sum, t) => sum + t.amount, 0);
  const totalExpenseMonth = Math.abs(analyticsExpenseTxs.reduce((sum, t) => sum + t.amount, 0));
  const netProfitMonth = totalRevenueMonth - totalExpenseMonth;

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

  return {
    transactions, setTransactions,
    students, teachers,
    isLoading,
    isModalOpen, setIsModalOpen,
    modalType, setModalType,
    categories, setCategories,
    filterRange, setFilterRange,
    startDate, setStartDate,
    endDate, setEndDate,
    newCategoryName, setNewCategoryName,
    editingTx, setEditingTx,
    searchQuery, setSearchQuery,
    sortOrder, setSortOrder,
    viewMode, setViewMode,
    analyticsMonth, setAnalyticsMonth,
    monthLessons, monthAccruedStats,
    isDeleteModalOpen, setIsDeleteModalOpen,
    executeDelete, openEditModal,
    handleExportExcel, handleImportExcel,
    filteredTransactions,
    handleSaveTransaction,
    totalIncome, totalExpense, netRevenue,
    totalRevenueMonth, totalExpenseMonth, netProfitMonth,
    revenueByCategory, expenseByCategory,
    handleAddCategory, confirmDeleteCategory, confirmDeleteTransaction,
    fetchData
  };
};
