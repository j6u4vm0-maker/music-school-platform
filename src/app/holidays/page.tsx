"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { getTeachers, Teacher } from '@/lib/services/db';
import { 
  getTeacherHolidays, 
  addTeacherHoliday, 
  addTeacherHolidayBatch, 
  deleteTeacherHoliday, 
  deleteTeacherHolidaysByRule,
  TeacherHoliday 
} from '@/lib/services/holidays';
import { 
  checkLessonsConflictBatch, 
  getLessonsByDateRange,
  Lesson 
} from '@/lib/services/schedule';
import { getTeacherColor, TEACHER_COLORS } from '@/lib/constants/colors';
import { useAuth } from '@/components/providers/AuthProvider';

// ── 組件：衝突清單 ──────────────────────────────────────────────
function ConflictList({ lessons }: { lessons: Lesson[] }) {
  if (lessons.length === 0) return null;

  return (
    <div className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-5 animate-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-red-500 text-xl">⚠️</span>
        <h4 className="font-bold text-red-800 tracking-widest text-sm">偵測到課程衝突</h4>
      </div>
      <p className="text-[10px] text-red-600/70 font-bold mb-4 leading-relaxed uppercase tracking-tighter">
        以下時段已有預約課程，請先移除或更換課程時間後再進行排休。
      </p>
      <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
        {lessons.map(l => (
          <div key={l.id} className="flex justify-between items-center bg-white/80 p-3 rounded-xl border border-red-100 shadow-sm">
            <div>
              <div className="text-xs font-black text-red-900 mb-0.5">{l.studentName} 同學</div>
              <div className="text-[10px] text-red-700/60 font-mono">{l.date} | {l.startTime}-{l.endTime}</div>
            </div>
            <div className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-black uppercase">{l.courseName}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 組件：迷你日曆單元格腳標 ──────────────────────────────────────────
function DayBadge({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-white/40 px-1.5 py-0.5 rounded-full border border-white/50 shadow-sm backdrop-blur-sm">
       <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }}></div>
       <span className="text-[8px] font-black tracking-tighter opacity-80">{label}</span>
    </div>
  );
}

// ── 主頁面邏輯組件 ──────────────────────────────────────────────
function HolidaysContent() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('holidays', 'VIEW');
  const canEdit = hasPermission('holidays', 'EDIT');

  const searchParams = useSearchParams();
  const router = useRouter();
  const teacherParamId = searchParams.get('teacherId');

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [holidays, setHolidays] = useState<TeacherHoliday[]>([]);
  const [monthLessons, setMonthLessons] = useState<Lesson[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // 表單狀態
  const [mode, setMode] = useState<'SINGLE' | 'RANGE' | 'RECURRING'>('SINGLE');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [halfDay, setHalfDay] = useState<'AM' | 'PM' | 'ALL'>('ALL');
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [conflicts, setConflicts] = useState<Lesson[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const selectedTeacher = useMemo(() => teachers.find(t => t.id === selectedTeacherId), [teachers, selectedTeacherId]);

  useEffect(() => {
    getTeachers().then(setTeachers);
  }, []);

  // 當 teacherParamId 改變時同步選取
  useEffect(() => {
    if (teacherParamId && teachers.length > 0) {
       setSelectedTeacherId(teacherParamId);
    }
  }, [teacherParamId, teachers]);

  useEffect(() => {
    if (selectedTeacherId) {
       fetchTeacherData();
    } else {
       setHolidays([]);
       setMonthLessons([]);
    }
  }, [selectedTeacherId, currentDate]);

  const fetchTeacherData = async () => {
    setIsLoading(true);
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startStr = firstDay.toISOString().split('T')[0];
    const endStr = lastDay.toISOString().split('T')[0];

    try {
        const [hData, lData] = await Promise.all([
          getTeacherHolidays(selectedTeacherId),
          getLessonsByDateRange(startStr, endStr)
        ]);

        setHolidays(hData);
        setMonthLessons(lData.filter(l => l.teacherId === selectedTeacherId));
    } catch (err: any) {
        console.error("Fetch error:", err);
        if (err.message?.includes("index")) {
            alert("⚠️ 資料庫索引尚未建立，請聯繫管理員建立 Firestore 索引 (TeacherId + Date)。");
        }
    }
    setIsLoading(false);
  };

  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  const toggleWeekday = (d: number) => {
    if (selectedWeekdays.includes(d)) {
      setSelectedWeekdays(selectedWeekdays.filter(x => x !== d));
    } else {
      setSelectedWeekdays([...selectedWeekdays, d]);
    }
  };

  // 生成待檢查日期清單
  const generateDatesToCheck = () => {
    if (!startDate) return [];
    const dates: { date: string, halfDay: 'AM' | 'PM' | 'ALL' }[] = [];
    const start = new Date(startDate);
    const end = mode === 'SINGLE' ? new Date(startDate) : new Date(endDate || startDate);
    
    let curr = new Date(start);
    while (curr <= end) {
      const dateStr = curr.toISOString().split('T')[0];
      if (mode === 'RECURRING') {
        if (selectedWeekdays.includes(curr.getDay())) {
          dates.push({ date: dateStr, halfDay });
        }
      } else {
        dates.push({ date: dateStr, halfDay });
      }
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  };

  const handleCheckConflict = async () => {
    if (!selectedTeacherId || !startDate) {
        alert("請先選擇老師與日期！");
        return;
    }
    const dates = generateDatesToCheck();
    if (dates.length === 0) {
        alert("找不到有效日期，請確認日期範圍與星期設定。");
        return;
    }
    
    setIsSubmitting(true);
    try {
        const found = await checkLessonsConflictBatch(selectedTeacherId, dates);
        setConflicts(found);
        if (found.length === 0) {
            alert("✅ 檢查通過！此時段無任何排課衝突。");
        }
    } catch (err: any) {
        console.error("Conflict check error:", err);
        const isIndexError = err.message?.includes("index") || err.code === "failed-precondition";
        const errorMsg = isIndexError 
            ? "❌ 檢查失敗：開發者中心索引未建立。請點擊控制台連結建立索引後再試。" 
            : `❌ 檢查失敗：${err.message}`;
        alert(errorMsg);
    }
    setIsSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId) return;

    const dates = generateDatesToCheck();
    if (dates.length === 0) return;

    // 最後一次衝突檢核
    const found = await checkLessonsConflictBatch(selectedTeacherId, dates);
    if (found.length > 0) {
        setConflicts(found);
        alert("🚫 仍有衝突課程，請修正後再排休。");
        return;
    }

    setIsSubmitting(true);
    try {
        if (editingId && mode === 'SINGLE') {
            await deleteTeacherHoliday(editingId);
        }

        const payload = dates.map(d => ({
            teacherId: selectedTeacherId,
            teacherName: selectedTeacher?.name || '',
            date: d.date,
            halfDay: d.halfDay,
            reason
        }));

        if (payload.length > 1) {
            await addTeacherHolidayBatch(payload);
        } else {
            await addTeacherHoliday(payload[0]);
        }

        alert(editingId ? "✅ 內容已成功修改！" : "✅ 排休設定成功！");
        setEditingId(null);
        resetForm();
        fetchTeacherData();
    } catch (err) {
        alert("儲存失敗");
    }
    setIsSubmitting(false);
  };

  const loadHoliday = (h: TeacherHoliday) => {
    setEditingId(h.id!);
    setStartDate(h.date);
    setHalfDay(h.halfDay);
    setReason(h.reason || '');
    setMode('SINGLE');
    setConflicts([]);
  };

  const resetForm = () => {
    setStartDate('');
    setEndDate('');
    setReason('');
    setConflicts([]);
    setSelectedWeekdays([]);
  };

  const handleDelete = async (h: TeacherHoliday) => {
    const msg = h.ruleId 
        ? "這是一筆批次排休，確定要刪除「整組」相關休假嗎？" 
        : "確定要刪除這筆排休嗎？";
    if (!confirm(msg)) return;

    if (h.ruleId) {
        await deleteTeacherHolidaysByRule(h.ruleId);
    } else {
        await deleteTeacherHoliday(h.id!);
    }
    fetchTeacherData();
  };

  // ── 日曆渲染邏輯 ──────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay();
    
    const days = [];
    // 填充空白
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    // 填充日期
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        day: i,
        date: dateStr,
        holiday: holidays.find(h => h.date === dateStr),
        lessons: monthLessons.filter(l => l.date === dateStr)
      });
    }
    return days;
  }, [currentDate, holidays, monthLessons]);

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  return (
    <main className="min-h-screen bg-[#f8f7f2] flex flex-col relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none -z-10">
        <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-rose-100 blur-[150px] opacity-40" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40vw] h-[40vw] rounded-full bg-[#c4a484]/10 blur-[120px] opacity-40" />
      </div>

      {!canView ? (
         <div className="flex-grow flex items-center justify-center p-20 z-50">
            <div className="bg-white p-12 rounded-[40px] shadow-2xl border-2 border-red-50/50 text-center">
               <h3 className="text-4xl mb-4">🚫</h3>
               <p className="font-black text-[#4a4238] tracking-[0.2em]">抱歉，您的帳號目前無權限訪問教師排休模組。</p>
               <p className="text-xs mt-4 opacity-40">請聯繫系統管理員以取得授權。</p>
               <Link href="/" className="mt-8 inline-block bg-[#4a4238] text-white px-8 py-3 rounded-full font-bold tracking-widest hover:bg-[#c4a484] transition-all">返回首頁</Link>
            </div>
         </div>
      ) : (
      <>

      {/* Navbar */}
      <div className="w-full max-w-7xl mx-auto px-6 pt-6 z-50">
        <nav className="glass-nav px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link href="/" className="w-10 h-10 rounded-full border border-[#4a4238] flex items-center justify-center font-serif text-lg font-bold text-[#4a4238] hover:bg-[#4a4238] hover:text-white transition-all">←</Link>
            <div>
              <h1 className="font-serif font-black text-xl tracking-[0.1em] text-[#4a4238]">老師排休管理系統</h1>
              <p className="text-rose-500 text-[10px] tracking-[0.3em] font-black uppercase">Teacher Holidays & Range Management</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-[#4a4238]/5 px-5 py-2.5 rounded-full border border-[#4a4238]/10">
             <span className="text-xs font-black text-[#4a4238]/60 uppercase tracking-widest">目前日期:</span>
             <span className="text-sm font-black text-[#4a4238] tracking-widest">{new Date().toLocaleDateString('zh-TW')}</span>
          </div>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 flex flex-col lg:flex-row gap-8">
        
        {/* Left Panel: Controls */}
        <aside className="w-full lg:w-96 flex flex-col gap-6 shrink-0">
          
          {/* Teacher Selector Card */}
          <div className="bg-white rounded-[32px] p-8 shadow-xl shadow-[#4a4238]/5 border border-white/80">
            <label className="block text-[10px] font-black tracking-[0.3em] text-rose-500 mb-4 uppercase">STEP 1: 選擇授課教師</label>
            <select 
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full bg-[#f8f7f2] border border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-[#4a4238] focus:ring-2 focus:ring-rose-500/20 transition-all outline-none"
            >
              <option value="">選擇一位老師...</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id!}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Form Card */}
          {canEdit ? (
            <div className={`bg-white rounded-[32px] p-8 shadow-xl shadow-[#4a4238]/5 border border-white/80 transition-opacity duration-500 ${!selectedTeacherId ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
              <label className="block text-[10px] font-black tracking-[0.3em] text-rose-500 mb-5 uppercase">STEP 2: 設定排休時段</label>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Mode Switcher */}
                <div className="flex p-1.5 bg-[#f8f7f2] rounded-2xl border border-[#ece4d9] gap-1">
                  {(['SINGLE', 'RANGE', 'RECURRING'] as const).map(m => (
                    <button key={m} type="button" onClick={() => { setMode(m); setConflicts([]); }} className={`flex-1 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${mode === m ? 'bg-[#4a4238] text-white shadow-md shadow-[#4a4238]/30' : 'text-[#4a4238]/40 hover:bg-[#4a4238]/5'}`}>
                      {m === 'SINGLE' ? '單日' : m === 'RANGE' ? '連假' : '重複'}
                    </button>
                  ))}
                </div>

                {/* Date Inputs */}
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-[#4a4238]/50 mb-2 uppercase tracking-widest">{mode === 'SINGLE' ? '休假日期' : '開始日期 (Start)'}</label>
                    <input required type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setConflicts([]); }} className="w-full bg-[#f8f7f2] border border-[#ece4d9] rounded-xl px-4 py-3 font-bold text-sm text-[#4a4238]" />
                  </div>
                  {mode !== 'SINGLE' && (
                    <div>
                      <label className="block text-[10px] font-black text-[#4a4238]/50 mb-2 uppercase tracking-widest">{mode === 'RECURRING' ? '重複截止日 (Until)' : '結束日期 (End)'}</label>
                      <input required type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setConflicts([]); }} className="w-full bg-[#f8f7f2] border border-[#ece4d9] rounded-xl px-4 py-3 font-bold text-sm text-[#4a4238]" />
                    </div>
                  )}
                </div>

                {/* Recurrence Days */}
                {mode === 'RECURRING' && (
                  <div>
                    <label className="block text-[10px] font-black text-[#4a4238]/50 mb-2 uppercase tracking-widest">重複星期 (Weekdays)</label>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5, 6, 0].map(d => (
                        <button key={d} type="button" onClick={() => toggleWeekday(d)} className={`w-8 h-8 rounded-full text-[10px] font-black transition-all border ${selectedWeekdays.includes(d) ? 'bg-[#4a4238] border-[#4a4238] text-white shadow-md' : 'bg-white border-[#ece4d9] text-[#4a4238]/40'}`}>
                          {weekdays[d]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* HalfDay Picker */}
                <div>
                  <label className="block text-[10px] font-black text-[#4a4238]/50 mb-2 uppercase tracking-widest">休假範圍時段</label>
                  <select value={halfDay} onChange={e => setHalfDay(e.target.value as any)} className="w-full bg-[#f8f7f2] border border-[#ece4d9] rounded-xl px-4 py-3 font-bold text-sm text-[#4a4238]">
                      <option value="ALL">全天 (整日排休)</option>
                      <option value="AM">上午 (12:00 以前)</option>
                      <option value="PM">下午 (12:00 以後)</option>
                  </select>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-[10px] font-black text-[#4a4238]/50 mb-2 uppercase tracking-widest">備註原因 (Reason)</label>
                  <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="範例：特休、家裡有事..." className="w-full bg-[#f8f7f2] border border-[#ece4d9] rounded-xl px-4 py-3 font-bold text-sm text-[#4a4238]" />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 pt-2">
                  <button type="button" onClick={handleCheckConflict} disabled={isSubmitting || !startDate} className="w-full py-4 bg-white border-2 border-rose-500/30 text-rose-500 font-black tracking-[0.2em] rounded-2xl text-[10px] uppercase hover:bg-rose-50 transition-all shadow-sm">
                     ⚡ 即時檢查課程衝突
                  </button>
                  <button type="submit" disabled={isSubmitting || (mode === 'RECURRING' && selectedWeekdays.length === 0)} className="w-full py-5 bg-[#4a4238] text-white font-black tracking-[0.3em] rounded-2xl text-xs uppercase shadow-xl shadow-[#4a4238]/20 hover:bg-[#c4a484] transition-all disabled:opacity-50">
                     {isSubmitting ? '處理中 Processing...' : editingId ? '確認修改內容 Update' : '確認發布排休 Apply'}
                  </button>
                  {editingId && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setEditingId(null); resetForm(); }} className="flex-1 py-3 text-[10px] font-black text-[#4a4238]/40 hover:text-red-500 transition-colors uppercase tracking-widest">
                         取消修改 Cancel
                      </button>
                      <button type="button" onClick={() => { 
                        const h = holidays.find(x => x.id === editingId);
                        if (h) handleDelete(h);
                      }} className="flex-1 py-3 text-[10px] font-black text-red-400 hover:text-red-600 transition-colors uppercase tracking-widest">
                         刪除此筆 Delete
                      </button>
                    </div>
                  )}
                </div>
              </form>

              <ConflictList lessons={conflicts} />
            </div>
          ) : (
            <div className="bg-white/50 backdrop-blur-sm rounded-[32px] p-8 border border-white/80 shadow-inner flex flex-col items-center text-center">
               <div className="w-12 h-12 bg-[#4a4238]/5 rounded-full flex items-center justify-center mb-4 text-xl">🔒</div>
               <p className="text-[10px] font-black text-[#4a4238]/40 tracking-widest uppercase">唯讀模式 Read Only</p>
               <p className="text-xs text-[#4a4238]/60 mt-2 font-bold px-4 leading-relaxed">您的帳號僅具備檢視權限，如需調整排休請聯繫管理員。</p>
            </div>
          )}
        </aside>

        {/* Right Panel: Calendar & List */}
        <div className="flex-1 flex flex-col gap-8 min-w-0">
          
          {/* Main Calendar Card */}
          <div className="bg-white rounded-[40px] p-10 shadow-2xl shadow-[#4a4238]/5 border border-white/80 flex flex-col">
            
            {/* Calendar Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10 pb-8 border-b border-rose-100/50">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center text-2xl font-serif font-black shadow-inner">
                   {currentDate.getMonth() + 1}
                </div>
                <div>
                  <h3 className="font-serif text-3xl font-black text-[#4a4238] tracking-widest">
                    {currentDate.getFullYear()}年 {currentDate.toLocaleDateString('zh-TW', { month: 'long' })}
                  </h3>
                  <p className="text-[10px] font-black text-[#c4a484] tracking-[0.4em] uppercase mt-1">Global Holiday View</p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-[#f8f7f2] p-1.5 rounded-2xl border border-[#ece4d9]">
                <button onClick={() => changeMonth(-1)} className="w-12 h-12 rounded-xl flex items-center justify-center text-[#4a4238] hover:bg-white transition-all shadow-sm">←</button>
                <button onClick={() => setCurrentDate(new Date())} className="px-6 text-[10px] font-black tracking-widest text-[#4a4238]/60 hover:text-[#4a4238] uppercase transition-colors">Today</button>
                <button onClick={() => changeMonth(1)} className="w-12 h-12 rounded-xl flex items-center justify-center text-[#4a4238] hover:bg-white transition-all shadow-sm">→</button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex gap-6 mb-8 px-2">
               <div className="flex items-center gap-3">
                  <div className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-sm"></div>
                  <span className="text-[11px] font-black text-[#4a4238] tracking-widest">老師休假 Holiday</span>
               </div>
               <div className="flex items-center gap-3">
                  <div className="w-3.5 h-3.5 rounded-full bg-blue-500 shadow-sm"></div>
                  <span className="text-[11px] font-black text-[#4a4238] tracking-widest">正常排課 Lesson</span>
               </div>
            </div>

            {/* Calendar Grid */}
            <div className={`grid grid-cols-7 gap-px bg-[#ece4d9]/50 border border-[#ece4d9]/50 rounded-[28px] overflow-hidden shadow-inner transition-opacity duration-300 ${isLoading ? 'opacity-40' : 'opacity-100'}`}>
              {/* Weekday Labels */}
              {weekdays.map(w => (
                <div key={w} className="bg-[#fcf8f3] py-4 text-center text-[10px] font-black text-[#c4a484] uppercase tracking-[0.3em] border-b border-[#ece4d9]/50">
                  {w}
                </div>
              ))}
              
              {/* Day Cells */}
              {calendarDays.map((day, idx) => (
                <div key={idx} className={`min-h-[140px] p-3 transition-all relative group
                  ${!day ? 'bg-[#fcf8f3]/20' : 'bg-white hover:bg-rose-50/20'}`}>
                   {day && (
                     <>
                        <span className={`text-base font-serif font-black mb-2 block 
                          ${day.holiday ? 'text-rose-500' : 'text-[#4a4238]'}`}>
                          {day.day}
                        </span>
                        
                        <div className="flex flex-col gap-1.5 overflow-hidden">
                           {day.holiday && (
                              <div className="group/item relative">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border animate-in zoom-in-95 duration-300
                                  ${day.holiday.halfDay === 'ALL' 
                                    ? 'bg-rose-500 text-white border-rose-600 shadow-sm' 
                                    : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                                  <div className={`w-1.5 h-1.5 rounded-full ${day.holiday.halfDay === 'ALL' ? 'bg-white' : 'bg-rose-500'}`}></div>
                                  <span className="text-[10px] font-black tracking-widest truncate">
                                    {day.holiday.halfDay === 'ALL' ? '整日排休' : day.holiday.halfDay === 'AM' ? '上午排休' : '下午排休'}
                                  </span>
                                  {day.holiday.ruleId && <span className="absolute -top-1 -right-1 bg-white text-rose-500 text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full shadow-sm border border-rose-100">R</span>}
                                </div>
                                {canEdit && (
                                  <button 
                                    onClick={() => handleDelete(day.holiday!)}
                                    className="absolute inset-0 bg-rose-600/90 text-white opacity-0 group-hover/item:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-[10px] font-black tracking-widest cursor-pointer z-10"
                                  >
                                    點擊刪除已設排休
                                  </button>
                                )}
                              </div>
                           )}

                           {day.lessons.slice(0, 3).map(l => (
                              <div key={l.id} className="flex items-center gap-2 px-2 py-1.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100/50">
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                <span className="text-[9px] font-bold tracking-widest truncate">{l.studentName}｜{l.startTime}</span>
                              </div>
                           ))}

                           {day.lessons.length > 3 && (
                             <span className="text-[8px] font-black text-blue-400 pl-2 uppercase tracking-widest">+ 還有 {day.lessons.length - 3} 堂課</span>
                           )}
                        </div>

                        {/* Hover Overlay Detail */}
                        {day.lessons.length > 0 && !day.holiday && (
                          <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                             <div className="bg-[#4a4238] text-white text-[8px] font-black px-2 py-1 rounded-full shadow-lg">
                                {day.lessons.length} LESSONS
                             </div>
                          </div>
                        )}
                     </>
                   )}
                </div>
              ))}
            </div>
          </div>

          {/* Teacher Info Floating Footer */}
          {!selectedTeacherId && (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#ece4d9]/20 rounded-[40px] border-2 border-dashed border-[#ece4d9]/50 min-h-[400px]">
               <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6">
                  <span className="text-3xl">👤</span>
               </div>
               <h4 className="font-serif text-2xl font-black text-[#4a4238]/30 tracking-widest">請先在左側選擇要管理的老師</h4>
               <p className="text-[#4a4238]/20 text-xs font-bold tracking-widest mt-2 uppercase">Please Select a Teacher to manage holidays</p>
            </div>
          )}

        </div>
      </div>
      </>
      )}
      
      {/* Visual background details */}
      <div className="fixed bottom-0 right-0 p-10 pointer-events-none opacity-5">
         <h1 className="font-serif text-9xl font-black text-[#4a4238]">Holidays</h1>
      </div>
    </main>
  );
}

// ── 最終組件導出（處理 Suspense） ──────────────────────────────────────────────
export default function HolidaysPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f8f7f2] font-serif font-black text-[#4a4238] tracking-widest uppercase animate-pulse">載入模組元件中 Loading Module...</div>}>
      <HolidaysContent />
    </Suspense>
  );
}
