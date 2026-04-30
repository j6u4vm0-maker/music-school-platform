import { useState, useEffect } from 'react';
import { getLessonsByDate, updateLessonStatus, Lesson } from '@/lib/services/schedule';
import { getDailyClosingStatus, setDailyClosingStatus, settleLessonTransaction } from '@/lib/services/finance';

export const useLedger = (canEdit: boolean, userId: string) => {
  const [date, setDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLocked, setIsLocked] = useState(false);
  const [isSettling, setIsSettling] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const fetchedLessons = await getLessonsByDate(date);
      setLessons(fetchedLessons);
      const lockedStatus = await getDailyClosingStatus(date);
      setIsLocked(lockedStatus);
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [date]);

  const handleUpdate = async (id: string, field: string, value: any) => {
    if (isLocked) {
      alert('🔒 本日帳務已入帳鎖定，無法進行任何修改。');
      return;
    }
    const lesson = lessons.find(l => l.id === id);
    if (!lesson) return;

    if (field === 'isSigned') {
      if (lesson.isSettled) {
        alert('⚠️ 這筆課程已結算，無法再變更簽到狀態。');
        return;
      }

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

  const shiftDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toLocaleDateString('en-CA'));
    setSelectedIds(new Set());
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
      await setDailyClosingStatus(date, !isLocked, userId);
      setIsLocked(!isLocked);
    } catch(err) {
      alert('鎖定狀態變更失敗：請檢查網路。');
    }
  };

  const totalLessons = lessons.reduce((acc, l) => acc + l.lessonsCount, 0);
  const totalRevenue = lessons.reduce((acc, l) => acc + (l.unitPrice * l.lessonsCount), 0);
  const totalPayout = lessons.reduce((acc, l) => acc + l.teacherPayout, 0);
  
  const cashTotal = lessons.filter(l => l.paymentMethod === 'CASH').reduce((acc, l) => acc + (l.unitPrice * l.lessonsCount), 0);
  const transferTotal = lessons.filter(l => l.paymentMethod === 'TRANSFER').reduce((acc, l) => acc + (l.unitPrice * l.lessonsCount), 0);

  return {
    date, setDate,
    lessons, setLessons,
    isLoading,
    selectedIds, setSelectedIds,
    isLocked, setIsLocked,
    isSettling,
    fetchData,
    handleUpdate,
    handleSignInAll,
    shiftDate,
    handleToggleSelect,
    handleSelectAll,
    handleBatchSignIn,
    handleToggleLock,
    totalLessons,
    totalRevenue,
    totalPayout,
    cashTotal,
    transferTotal
  };
};
