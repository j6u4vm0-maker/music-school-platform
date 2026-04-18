"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getStudents, getTeachers, getClassrooms, addUser, addClassroom, updateUser, deleteUser, updateClassroom, deleteClassroom, Student, Teacher, Classroom, StudentEnrollment } from '@/lib/services/db';
import { exportToExcel, importFromExcel } from '@/lib/utils/excel';
import { getPricing, savePricing, getTeacherPricingList, TeacherInstrumentPricing, PriceTier } from '@/lib/services/pricing';
import { saveUserProfile, logout, createUser, getAllUsers, resetPassword } from '@/lib/services/auth';
import { getStudentBindings, getTeacherBindings, unbindLineAccount, LineBinding } from '@/lib/services/line';
import { getTeacherHolidays, addTeacherHoliday, deleteTeacherHoliday, TeacherHoliday } from '@/lib/services/holidays';
import { checkLessonsOverlapWithHoliday } from '@/lib/services/schedule';
import { TEACHER_COLORS, getTeacherColor } from '@/lib/constants/colors';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';

// ============================================================
// PricingModal — 多段階梯定價設定元件
// ============================================================
function PricingModal({
  teacher, selectedInstrument, pricingData, isSubmitting,
  onClose, onInstrumentChange, onSave
}: {
  teacher: Teacher;
  selectedInstrument: string;
  pricingData: TeacherInstrumentPricing | null;
  isSubmitting: boolean;
  onClose: () => void;
  onInstrumentChange: (instrument: string) => void;
  onSave: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  // Initialize tiers from existing data or with a default single tier
  const [tiers, setTiers] = useState<PriceTier[]>(
    pricingData?.tiers && pricingData.tiers.length > 0
      ? pricingData.tiers
      : [{ minLessons: 1, rate: 800 }]
  );

  // Re-sync tiers when instrument changes and pricingData reloads
  useEffect(() => {
    setTiers(
      pricingData?.tiers && pricingData.tiers.length > 0
        ? pricingData.tiers
        : [{ minLessons: 1, rate: 800 }]
    );
  }, [pricingData]);

  const addTier = () => {
    const lastMin = tiers[tiers.length - 1]?.minLessons || 1;
    setTiers([...tiers, { minLessons: lastMin + 5, rate: Math.max(100, (tiers[tiers.length - 1]?.rate || 800) - 100) }]);
  };

  const removeTier = (index: number) => {
    if (tiers.length <= 1) return;
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: keyof PriceTier, value: number) => {
    setTiers(tiers.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#4a4238]/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[#f8f7f2] w-full max-w-lg rounded-[30px] shadow-2xl p-10 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-6 right-6 text-[#4a4238]/50 hover:text-[#4a4238] text-xl font-bold">✕</button>
        <h3 className="font-serif text-2xl font-bold tracking-[0.1em] text-[#4a4238] mb-2 border-b border-[#ece4d9] pb-4">
          設定授課定價
        </h3>
        <p className="text-xs text-[#c4a484] font-black tracking-widest mb-6">{teacher.name}</p>

        <form key={`${teacher.id}_${selectedInstrument}`} onSubmit={onSave} className="flex flex-col gap-6">
          {/* 樂器選擇 */}
          <div>
            <label className="block text-xs font-black tracking-[0.2em] text-[#4a4238] mb-2 uppercase">授課樂器</label>
            <select
              value={selectedInstrument}
              onChange={e => onInstrumentChange(e.target.value)}
              className="w-full bg-white border border-[#ece4d9] rounded-xl px-4 py-3 font-bold text-[#4a4238]"
            >
              {teacher.instruments.map(inst => <option key={inst} value={inst}>{inst}</option>)}
            </select>
          </div>

          {/* 階梯定價 */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black tracking-[0.2em] text-[#4a4238] uppercase">📊 階梯折扣設定</label>
              <button type="button" onClick={addTier} className="text-xs font-black text-[#c4a484] bg-[#c4a484]/10 hover:bg-[#c4a484]/20 px-3 py-1 rounded-full tracking-widest transition-all">
                + 新增階梯
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-[#ece4d9] overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr_1fr_40px] gap-3 px-4 py-3 bg-[#ece4d9]/40 text-[10px] font-black tracking-widest text-[#4a4238]/60 uppercase">
                <span>購買起始堂數 (含)</span>
                <span>每堂單價 ($)</span>
                <span></span>
              </div>

              {tiers.map((tier, i) => (
                <div key={i} className={`grid grid-cols-[1fr_1fr_40px] gap-3 px-4 py-3 items-center border-t border-[#ece4d9]/50 ${i === 0 ? 'bg-white' : 'bg-[#f8f7f2]'}`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="hidden"
                      name={`tier_min_${i}`}
                      value={tier.minLessons}
                    />
                    <input
                      type="number"
                      min="1"
                      value={tier.minLessons}
                      onChange={e => updateTier(i, 'minLessons', Number(e.target.value))}
                      className="w-full bg-white border border-[#ece4d9] rounded-lg px-3 py-2 font-mono font-black text-[#4a4238] text-sm"
                      readOnly={i === 0}
                    />
                    {i === 0 && <span className="text-[10px] text-[#4a4238]/40 whitespace-nowrap">起始</span>}
                  </div>
                  <div className="relative">
                    <input
                      type="hidden"
                      name={`tier_rate_${i}`}
                      value={tier.rate}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c4a484] font-black text-sm">$</span>
                    <input
                      type="number"
                      min="1"
                      value={tier.rate}
                      onChange={e => updateTier(i, 'rate', Number(e.target.value))}
                      className="w-full bg-white border border-[#c4a484]/40 rounded-lg pl-7 pr-3 py-2 font-mono font-black text-[#4a4238] text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTier(i)}
                    disabled={tiers.length <= 1}
                    className="text-red-300 hover:text-red-500 font-black disabled:opacity-20 transition-colors text-lg"
                  >✕</button>
                </div>
              ))}
            </div>

            {/* Visual guide */}
            <div className="text-[10px] text-[#4a4238]/50 leading-relaxed bg-[#ece4d9]/30 px-4 py-3 rounded-xl">
              💡 <strong>範例：</strong>第一階 1堂起 $1,000/堂，第二階 6堂起 $900/堂（買 6 堂以上自動適用 $900 計算）
            </div>
          </div>

          {/* 抽成比例 */}
          <div>
            <label className="block text-xs font-black tracking-[0.2em] text-[#4a4238] mb-2 uppercase">教師抽成 (%)</label>
            <input
              type="number"
              name="payoutRate"
              defaultValue={(pricingData?.payoutRate != null ? pricingData.payoutRate : 0.6) * 100}
              className="w-full bg-white border border-[#ece4d9] rounded-xl px-4 py-3 font-bold text-[#4a4238]"
            />
            <p className="text-[10px] text-[#4a4238]/50 mt-1">影響排程與教師對帳單的自動計算</p>
          </div>

          <button type="submit" disabled={isSubmitting} className="bg-[#4a4238] hover:bg-[#c4a484] text-white font-black tracking-widest py-4 px-6 rounded-full shadow-md transition-all">
            {isSubmitting ? '儲存中...' : '確認更新定價 ✔'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// TeacherHolidayModal — 教師休假管理元件
// ============================================================
function TeacherHolidayModal({
  teacher, onClose
}: {
  teacher: Teacher;
  onClose: () => void;
}) {
  const [holidays, setHolidays] = useState<TeacherHoliday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchHolidays = async () => {
    setIsLoading(true);
    const data = await getTeacherHolidays(teacher.id!);
    // 依日期排序
    setHolidays(data.sort((a, b) => a.date.localeCompare(b.date)));
    setIsLoading(false);
  };

  useEffect(() => {
    fetchHolidays();
  }, [teacher.id]);

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const form = new FormData(e.currentTarget);
    const date = form.get('date') as string;
    const halfDay = form.get('halfDay') as 'AM' | 'PM' | 'ALL';
    const reason = form.get('reason') as string;

    // 檢查防撞
    const conflictMsg = await checkLessonsOverlapWithHoliday(teacher.id!, date, halfDay);
    if (conflictMsg) {
      alert(`🚫 阻擋休假設定：\n${conflictMsg}`);
      setIsSubmitting(false);
      return;
    }

    try {
      await addTeacherHoliday({
        teacherId: teacher.id!,
        teacherName: teacher.name,
        date,
        halfDay,
        reason
      });
      alert('休假設定成功！');
      (e.target as HTMLFormElement).reset();
      fetchHolidays();
    } catch (err: any) {
      alert('儲存失敗：' + err.message);
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確認取消此休假？')) return;
    await deleteTeacherHoliday(id);
    fetchHolidays();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#4a4238]/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[#f8f7f2] w-full max-w-lg rounded-[30px] shadow-2xl p-10 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-6 right-6 text-[#4a4238]/50 hover:text-[#4a4238] text-xl font-bold">✕</button>
        <h3 className="font-serif text-2xl font-bold tracking-[0.1em] text-[#4a4238] mb-2 border-b border-[#ece4d9] pb-4">
          🏖️ 老師休假管理
        </h3>
        <p className="text-xs text-[#c4a484] font-black tracking-widest mb-6">{teacher.name}</p>

        {/* 新增休假表單 */}
        <div className="bg-white p-5 rounded-2xl border border-[#ece4d9] mb-6 shadow-sm">
          <h4 className="text-xs font-black tracking-[0.2em] text-[#4a4238] mb-4 uppercase">✚ 新增休假</h4>
          <form onSubmit={handleAddSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black tracking-widest text-[#4a4238]/60 mb-1">休假日期</label>
                <input required type="date" name="date" className="w-full bg-[#f8f7f2] border border-[#ece4d9] rounded-lg px-3 py-2 font-bold text-sm text-[#4a4238]" />
              </div>
              <div>
                <label className="block text-[10px] font-black tracking-widest text-[#4a4238]/60 mb-1">休假範圍</label>
                <select required name="halfDay" className="w-full bg-[#f8f7f2] border border-[#ece4d9] rounded-lg px-3 py-2 font-bold text-sm text-[#4a4238]">
                  <option value="ALL">全天</option>
                  <option value="AM">上午 (00:00-11:59)</option>
                  <option value="PM">下午 (12:00-23:59)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black tracking-widest text-[#4a4238]/60 mb-1">備註 (選填)</label>
              <input type="text" name="reason" placeholder="如：出國進修、特休..." className="w-full bg-[#f8f7f2] border border-[#ece4d9] rounded-lg px-3 py-2 font-bold text-sm text-[#4a4238]" />
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full bg-[#4a4238] text-white font-black tracking-widest py-3 rounded-xl disabled:opacity-50 transition-colors hover:bg-[#c4a484]">
              {isSubmitting ? '檢查中...' : '確認排休'}
            </button>
          </form>
        </div>

        {/* 休假清單 */}
        <h4 className="text-xs font-black tracking-[0.2em] text-[#4a4238] mb-4 uppercase">📋 已排定休假</h4>
        {isLoading ? (
          <p className="text-sm font-bold text-[#4a4238]/50 text-center py-4">讀取中...</p>
        ) : holidays.length === 0 ? (
          <p className="text-sm font-bold text-[#c4a484]/80 text-center py-4 bg-white/50 rounded-xl border border-dashed border-[#c4a484]/30">目前無任何排休</p>
        ) : (
          <div className="flex flex-col gap-2">
            {holidays.map(h => (
              <div key={h.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-[#ece4d9] shadow-sm">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-[#4a4238] tracking-widest text-sm">{h.date}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${h.halfDay === 'ALL' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                      {h.halfDay === 'AM' ? '上午' : h.halfDay === 'PM' ? '下午' : '全天'}
                    </span>
                  </div>
                  {h.reason && <p className="text-[10px] text-[#4a4238]/50">{h.reason}</p>}
                </div>
                <button onClick={() => handleDelete(h.id!)} className="text-red-400 hover:text-red-600 font-bold px-2 py-1 text-xs">取消</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DatabasePage() {
  const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'classrooms'>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [holidayTeacher, setHolidayTeacher] = useState<Teacher | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [tempEnrollments, setTempEnrollments] = useState<StudentEnrollment[]>([]);
  const [currentLineBindings, setCurrentLineBindings] = useState<LineBinding[]>([]);
  const [tempMobiles, setTempMobiles] = useState<string[]>([]);
  const [selectedColorIndex, setSelectedColorIndex] = useState<number>(-1);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

  // 取得全學院現有的科目清單
  const allInstruments = Array.from(new Set(teachers.flatMap(t => t.instruments))).sort();
  const [pricingTeacher, setPricingTeacher] = useState<Teacher | null>(null);
  const [pricingData, setPricingData] = useState<TeacherInstrumentPricing | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<string>('');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const { hasPermission, profile } = useAuth();
  const router = useRouter();

  const canEdit = hasPermission('database', 'EDIT');
  const canView = hasPermission('database', 'VIEW');
  const isAdmin = profile?.role === 'ADMIN';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      setStudents(await getStudents());
      
      const fetchedTeachers = await getTeachers();
      const teachersWithPricing = await Promise.all(fetchedTeachers.map(async (t) => {
        const pricingList = await getTeacherPricingList(t.id!);
        return { ...t, pricingList };
      }));
      setTeachers(teachersWithPricing as any);
      
      setClassrooms(await getClassrooms());
      
      setClassrooms(await getClassrooms());

      // Fetch binding status for all students
      const studentsData = await getStudents();
      const studentsWithBindings = await Promise.all(studentsData.map(async (s) => {
        const bindings = await getStudentBindings(s.id!);
        return { ...s, isLineBound: bindings.length > 0 };
      }));
      setStudents(studentsWithBindings);

      // Fetch binding status for all teachers
      const teachersWithBindings = await Promise.all(teachersWithPricing.map(async (t) => {
        const bindings = await getTeacherBindings(t.id!);
        return { ...t, isLineBound: bindings.length > 0 };
      }));
      setTeachers(teachersWithBindings as any);

    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const openCreateModal = () => {
    setEditingItem(null);
    if (activeTab === 'students') {
       setTempEnrollments([]);
       setTempMobiles([]);
       setCurrentLineBindings([]);
    }
    if (activeTab === 'teachers') {
       setSelectedColorIndex(-1);
    }
    setIsModalOpen(true);
  };

  const openEditModal = async (item: any) => {
    setEditingItem(item);
    if (activeTab === 'students') {
       setTempEnrollments(item.enrollments?.map((e: any) => ({
         ...e,
         balance: e.balance || 0,
         remainingLessons: e.remainingLessons || 0
       })) || []);
       
       setTempMobiles(item.contact_mobiles || []);

       const bindings = await getStudentBindings(item.id);
       setCurrentLineBindings(bindings);
    }
    if (activeTab === 'teachers') {
       setSelectedColorIndex(item.colorIndex ?? -1);
    }
    setIsModalOpen(true);
  };

  const openHolidayModal = (teacher: Teacher) => {
    setHolidayTeacher(teacher);
    setIsHolidayModalOpen(true);
  };

  const openPricingModal = async (teacher: Teacher) => {
    setPricingTeacher(teacher);
    const instrument = teacher.instruments[0] || '';
    setSelectedInstrument(instrument);
    if (instrument) {
      const data = await getPricing(teacher.id!, instrument);
      setPricingData(data);
    }
    setIsPricingModalOpen(true);
  };

  const handlePricingInstrumentChange = async (instrument: string) => {
    setSelectedInstrument(instrument);
    if (pricingTeacher) {
      const data = await getPricing(pricingTeacher.id!, instrument);
      setPricingData(data);
    }
  };

  const handlePricingSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pricingTeacher || !selectedInstrument) return;
    
    setIsSubmitting(true);
    const form = new FormData(e.currentTarget);
    const payoutRate = Number(form.get('payoutRate')) / 100;

    // Collect all tiers from the form (fields named tier_min_0, tier_rate_0, etc.)
    const tiers: { minLessons: number; rate: number }[] = [];
    let i = 0;
    while (form.get(`tier_min_${i}`) !== null) {
      tiers.push({
        minLessons: Number(form.get(`tier_min_${i}`)),
        rate: Number(form.get(`tier_rate_${i}`)),
      });
      i++;
    }

    if (tiers.length === 0) {
      alert('請至少設定一個定價階梯！');
      setIsSubmitting(false);
      return;
    }

    await savePricing(pricingTeacher.id!, selectedInstrument, tiers, payoutRate);
    alert(`✅ ${pricingTeacher.name} / ${selectedInstrument} 定價已更新！`);
    setIsPricingModalOpen(false);
    fetchData();
    setIsSubmitting(false);
  };

  const confirmDelete = (id: string) => {
    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const copyBindLink = (studentId: string) => {
    const url = `${window.location.origin}/line/bind?student_id=${studentId}`;
    navigator.clipboard.writeText(url);
    alert("✅ 綁定連結已複製到剪貼簿！\n您可以將此連結傳給家長，或製成 QRCode 供掃描。");
  };

  const copyTeacherBindLink = (teacherId: string) => {
    const url = `${window.location.origin}/line/bind?teacher_id=${teacherId}`;
    navigator.clipboard.writeText(url);
    alert("✅ 老師專屬綁定連結已複製！\n您可以將此連結傳給老師，引導其完成 LINE 通知設定。");
  };

  const handleUnbindLine = async (bindingId: string) => {
    if (!confirm("確定要強制解除此 LINE 綁定嗎？家長將無法再收到通知。")) return;
    try {
      await unbindLineAccount(bindingId);
      const updated = currentLineBindings.filter(b => b.id !== bindingId);
      setCurrentLineBindings(updated);
      fetchData(); // Update status on list
    } catch (err) {
      alert("解綁失敗");
    }
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (activeTab === 'classrooms') await deleteClassroom(itemToDelete);
      else await deleteUser(itemToDelete); // This refers to Student/Teacher deletion
      fetchData();
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (e) {
      alert("刪除失敗，請檢查權限");
    }
  };


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const form = new FormData(e.currentTarget);
    
    try {
      if (activeTab === 'students') {
        const parsedEnrollments = JSON.parse(form.get('enrollments_json') as string || '[]');
        const totalBalance = parsedEnrollments.reduce((sum: number, en: any) => sum + (Number(en.balance) || 0), 0);
        const totalLessons = parsedEnrollments.reduce((sum: number, en: any) => sum + (Number(en.remainingLessons) || 0), 0);

        const payload: Partial<Student> = {
          name: form.get('name') as string,
          phone: form.get('phone') as string,
          role: 'STUDENT',
          balance: totalBalance,
          remainingLessons: totalLessons,
          enrollments: parsedEnrollments,
          contact_mobiles: tempMobiles,
        };
        if (editingItem) await updateUser(editingItem.id, payload);
        else await addUser(payload as Student);

      } else if (activeTab === 'teachers') {
        const payload: Partial<Teacher> = {
          name: form.get('name') as string,
          phone: form.get('phone') as string,
          role: 'TEACHER',
          instruments: (form.get('instruments')?.toString() || '').split(',').map(s => s.trim()).filter(Boolean),
          hourlyRate: Number(form.get('hourlyRate')) || 0,
          colorIndex: selectedColorIndex >= 0 ? selectedColorIndex : null,
        };
        if (editingItem) await updateUser(editingItem.id, payload);
        else await addUser(payload as Teacher);

      } else if (activeTab === 'classrooms') {
        const payload: Partial<Classroom> = {
          name: form.get('name') as string,
          capacity: Number(form.get('capacity')) || 0,
          equipment: (form.get('equipment') as string).split(',').map(s => s.trim())
        };
        if (editingItem) await updateClassroom(editingItem.id, payload);
        else await addClassroom(payload as Classroom);
        }
      
      setIsModalOpen(false);
      setEditingItem(null);
      fetchData();
    } catch (error: any) {
      alert(`儲存失敗: ${error.message}`);
    }
    setIsSubmitting(false);
  };

  const handleExportExcel = () => {
    if (activeTab === 'students') exportToExcel(students, '學員名單');
    else if (activeTab === 'teachers') exportToExcel(teachers, '教師名單');
    else if (activeTab === 'classrooms') exportToExcel(classrooms, '教室清單');
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsImporting(true);
    const file = e.target.files[0];
    try {
      const data = await importFromExcel(file);
      if (data.length === 0) {
        alert("找不到資料或檔案格式為空");
        setIsImporting(false);
        return;
      }
      
      let count = 0;
      for (const row of data) {
        if (!row.name && !row.姓名 && !row.Name) continue; 
        const nameVal = row.name || row.姓名 || row.Name;
        const phoneVal = row.phone || row.電話 || row.聯絡電話 || '';

        if (activeTab === 'students') {
           await addUser({
             name: nameVal, phone: phoneVal, role: 'STUDENT',
             balance: Number(row.balance || row.餘額) || 0,
             remainingLessons: Number(row.remainingLessons || row.剩餘堂數) || 0
           } as Student);
           count++;
        } else if (activeTab === 'teachers') {
           await addUser({
             name: nameVal, phone: phoneVal, role: 'TEACHER',
             hourlyRate: Number(row.hourlyRate || row.鐘點費或定價) || 0,
             instruments: [row.instruments || row.教授科目 || '']
           } as Teacher);
           count++;
        } else if (activeTab === 'classrooms') {
           await addClassroom({
             name: nameVal,
             capacity: Number(row.capacity || row.容納人數) || 0,
             equipment: [row.equipment || row.附屬設備 || '']
           } as Classroom);
           count++;
        }
      }
      alert(`🎉 成功解析並批次匯入了 ${count} 筆資料！`);
      fetchData();
    } catch (err) {
      alert("解析 Excel 失敗，請確認檔案格式正確。");
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsImporting(false);
  };

  const renderRows = () => {
    if (activeTab === 'students') {
      return students.map((s) => (
        <tr key={s.id} className="border-b border-[#ece4d9] hover:bg-[#c4a484]/10 transition-colors">
          <td className="py-4 px-6 font-bold text-[#4a4238]">{s.name}</td>
          <td className="py-4 px-6 tracking-widest text-sm">{s.phone || '-'}</td>
          <td className="py-4 px-6 min-w-[200px]" colSpan={3}>
             <div className="flex flex-wrap gap-2">
               {s.enrollments && s.enrollments.length > 0 ? (
                 s.enrollments.map((en, i) => (
                   <div key={i} className="flex flex-col bg-white border border-[#ece4d9] rounded-lg px-3 py-2 shadow-sm group/badge hover:border-[#c4a484] transition-all min-w-[140px]">
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-[10px] font-black tracking-widest text-[#4a4238]/60 uppercase">{en.instrument}</span>
                        <span className="text-xs font-bold text-[#4a4238]">{en.teacherName}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-mono mt-1 border-t border-[#ece4d9]/50 pt-1">
                        <span className="text-[#c4a484] font-bold">{en.remainingLessons || 0} 堂</span>
                        <span className="text-emerald-600 font-bold">${(en.balance || 0).toLocaleString()}</span>
                      </div>
                   </div>
                 ))
               ) : (
                 <span className="text-xs opacity-40 italic">尚未配置科目</span>
               )}
             </div>
          </td>
          <td className="py-4 px-6 text-right whitespace-nowrap">
            {canEdit && (
              <button 
                onClick={() => copyBindLink(s.id!)} 
                className={`font-bold px-3 transition-colors ${s.isLineBound ? 'text-green-500 hover:text-green-700' : 'text-[#c4a484] hover:text-[#4a4238]'}`}
                title={s.isLineBound ? "已綁定 LINE (點擊複製連結)" : "點擊複製綁定連結"}
              >
                {s.isLineBound ? '✅ LINE' : '🔗 連結'}
              </button>
            )}
            {canEdit && <button onClick={() => openEditModal(s)} className="text-blue-500 hover:text-blue-700 font-bold px-3">編輯 ✎</button>}
            {canEdit && <button onClick={() => confirmDelete(s.id!)} className="text-red-400 hover:text-red-600 font-bold pr-2">刪除 ❌</button>}
          </td>
        </tr>
      ));
    }
    if (activeTab === 'teachers') {
      return teachers.map((t) => {
        const colorObj = getTeacherColor(t.id, teachers);
        return (
        <tr key={t.id} className="border-b border-[#ece4d9] hover:bg-[#c4a484]/10 transition-colors">
          <td className="py-4 px-6 font-bold text-[#4a4238] flex items-center gap-3">
            <span className="w-3.5 h-3.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: colorObj.bg, border: `1px solid ${colorObj.border}` }} title={colorObj.name}></span>
            {t.name}
          </td>
          <td className="py-4 px-6 tracking-widest text-sm">{t.phone || '-'}</td>
          <td className="py-4 px-6 text-[#c4a484] font-bold text-sm tracking-widest">{t.instruments.join(', ')}</td>
          <td className="py-4 px-6 font-mono text-[#4a4238] font-bold">
            {(t as any).pricingList && (t as any).pricingList.length > 0 ? (
               <div className="flex flex-col gap-1 mt-1 mb-1">
                 {(t as any).pricingList.map((p: any) => (
                   <span key={p.instrument} className="text-xs bg-[#c4a484]/10 border border-[#c4a484]/30 px-2 py-0.5 rounded-md inline-block mr-1 mb-1 text-[#4a4238]">
                     {p.instrument}: <span className="text-[#c4a484]">${p.tiers?.[0]?.rate || t.hourlyRate}</span>/Hr
                     <span className="ml-2 text-[10px] bg-[#4a4238] text-white px-1.5 py-0.5 rounded">抽: {p.payoutRate != null ? Math.round(p.payoutRate * 100) : 60}%</span>
                   </span>
                 ))}
               </div>
            ) : (
               <span className="opacity-50 text-xs">$ {t.hourlyRate.toLocaleString()} / Hr (未設進階定價)</span>
            )}
          </td>
          <td className="py-4 px-6 text-right whitespace-nowrap">
            {canEdit && (
              <button 
                onClick={() => copyTeacherBindLink(t.id!)} 
                className={`font-bold px-3 transition-all ${t.isLineBound ? 'text-green-500 hover:text-green-700' : 'text-[#c4a480] hover:text-[#4a4238]'}`}
                title={t.isLineBound ? "老師已綁定 LINE (點擊可重新複製連結)" : "點擊複製老師綁定連結"}
              >
                {t.isLineBound ? '✅ LINE' : '🔗 連結'}
              </button>
            )}
            {canEdit && <Link href={`/holidays?teacherId=${t.id}`} className="text-purple-500 hover:text-purple-700 font-bold px-3">🏖️ 休假</Link>}
            {canEdit && <button onClick={() => openPricingModal(t)} className="text-emerald-500 hover:text-emerald-700 font-bold px-3">💰 定價</button>}
            {canEdit && <button onClick={() => openEditModal(t)} className="text-blue-500 hover:text-blue-700 font-bold px-3">編輯 ✎</button>}
            {canEdit && <button onClick={() => confirmDelete(t.id!)} className="text-red-400 hover:text-red-600 font-bold pr-2">刪除 ❌</button>}
          </td>
        </tr>
        );
      });
    }
    return classrooms.map((c) => (
      <tr key={c.id} className="border-b border-[#ece4d9] hover:bg-[#c4a484]/10 transition-colors">
        <td className="py-4 px-6 font-bold text-[#4a4238]">{c.name}</td>
        <td className="py-4 px-6 text-[#c4a484] font-black tracking-widest text-sm">{c.capacity} 人</td>
        <td className="py-4 px-6 text-[#4a4238]/70 text-sm tracking-widest">{c.equipment.join(', ')}</td>
        <td className="py-4 px-6 font-mono text-gray-400 text-xs">{c.id}</td>
        <td className="py-4 px-6 text-right">
            {canEdit && <button onClick={() => openEditModal(c)} className="text-blue-500 hover:text-blue-700 font-bold px-3">編輯 ✎</button>}
            {canEdit && <button onClick={() => confirmDelete(c.id!)} className="text-red-400 hover:text-red-600 font-bold pr-2">刪除 ❌</button>}
        </td>
      </tr>
    ));
  };

  return (
    <main className="flex min-h-screen flex-col items-center pb-24 relative overflow-x-hidden bg-[#f8f7f2]">
      <div className="absolute top-[10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#ece4d9] blur-[150px] opacity-70 -z-10"></div>
      <input type="file" accept=".xlsx, .xls" ref={fileInputRef} className="hidden" onChange={handleImportExcel} />

       {/* Navbar */}
       <Navbar pageTitle="人事與資源庫" />

       {!canView ? (
         <div className="flex-grow flex items-center justify-center p-20">
            <div className="bg-white p-12 rounded-[40px] shadow-2xl border-2 border-red-50/50 text-center">
               <h3 className="text-4xl mb-4">🚫</h3>
               <p className="font-black text-[#4a4238] tracking-[0.2em]">抱歉，您的帳號目前無權限訪問資料庫模組。</p>
               <p className="text-xs mt-4 opacity-40">請聯繫系統管理員以取得授權。</p>
            </div>
         </div>
       ) : (
       <div className="w-full max-w-7xl px-4 z-10 flex flex-col items-center">
        <div className="flex gap-4 md:gap-8 mb-8 w-full border-b-2 border-[#ece4d9] px-4">
          {[
            { id: 'students', label: '學員名單' },
            { id: 'teachers', label: '師資陣容' },
            { id: 'classrooms', label: '空間設施' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`pb-4 text-sm md:text-base font-bold tracking-[0.2em] transition-all relative ${activeTab === tab.id ? 'text-[#4a4238]' : 'text-[#4a4238]/40 hover:text-[#c4a484]'}`}>
              {tab.label}
              {activeTab === tab.id && <div className="absolute bottom-[-2px] left-0 w-full h-[3px] bg-[#c4a484] rounded-t-full shadow-[0_-2px_10px_rgba(196,164,132,0.5)]"></div>}
            </button>
          ))}
        </div>

        <div className="elegant-card w-full p-8 md:p-12 min-h-[60vh] flex flex-col">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-[#ece4d9] pb-6">
            <h3 className="font-serif text-2xl font-bold tracking-[0.1em] text-[#4a4238]">
              {activeTab === 'students' ? '現任學員名冊' : activeTab === 'teachers' ? '專署師資清單' : '教室與設備管理'}
            </h3>
            
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={triggerFileInput} 
                disabled={isImporting}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6 py-3 rounded-full text-sm tracking-widest shadow-md transition-all hover:-translate-y-0.5 disabled:opacity-50">
                📥 {isImporting ? '上傳中...' : '匯入 Excel'}
              </button>
              <button 
                onClick={handleExportExcel} 
                className="bg-[#c4a484] hover:bg-[#b09070] text-white font-bold px-6 py-3 rounded-full text-sm tracking-widest shadow-md transition-all hover:-translate-y-0.5">
                📤 整個匯出報表
              </button>
               <div className="w-[2px] bg-[#ece4d9] mx-2"></div>
               {canEdit && (
                 <button onClick={openCreateModal} className="bg-[#4a4238] hover:bg-[#363028] text-white font-bold px-8 py-3 rounded-full text-sm tracking-widest shadow-lg transition-all hover:-translate-y-0.5">
                   ＋ 新增資料
                 </button>
               )}
             </div>
          </div>

          <div className="flex-grow w-full">
            {isLoading ? (
               <div className="animate-pulse flex items-center justify-center h-48 text-[#4a4238]/50 font-bold tracking-widest">讀取加密資料庫中...</div>
            ) : activeTab === 'teachers' ? (
              /* ============================================================ */
              /* 師資陣容：專業儀表板分欄模式 (Dashboard Split View) */
              /* ============================================================ */
              <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-320px)] min-h-[500px]">
                
                {/* 左側：名單導覽列 (Master List) */}
                <div className="w-full md:w-72 flex flex-col bg-white/50 rounded-2xl border border-[#ece4d9] overflow-hidden">
                  <div className="p-4 bg-[#ece4d9]/30 border-b border-[#ece4d9]">
                    <span className="text-[10px] font-black tracking-widest text-[#4a4238]/50 uppercase">快速導覽清單 ({teachers.length})</span>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {teachers.map(t => {
                      const colorObj = getTeacherColor(t.id, teachers);
                      const isSelected = selectedTeacherId === t.id;
                      return (
                        <button 
                          key={t.id}
                          onClick={() => setSelectedTeacherId(t.id!)}
                          className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 mb-1 group border ${isSelected ? 'bg-white shadow-md' : 'hover:bg-[#ece4d9]/40 border-transparent'}`}
                          style={isSelected ? { borderColor: colorObj.bg } : {}}
                        >
                          <span 
                            className={`w-3 h-3 rounded-full shrink-0 shadow-sm transition-transform ${isSelected ? 'scale-125' : 'group-hover:scale-110'}`} 
                            style={{ backgroundColor: colorObj.bg, border: `1px solid ${colorObj.border}` }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className={`font-bold text-sm truncate ${isSelected ? 'text-[#4a4238]' : 'text-[#4a4238]/70'}`}>{t.name}</div>
                            <div className="text-[10px] text-[#c4a480] font-black tracking-widest truncate">{t.instruments.slice(0, 2).join(', ')}{t.instruments.length > 2 ? '...' : ''}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 右側：詳細資訊終端 (Detail Pane) */}
                <div className="flex-1 bg-white rounded-3xl border border-[#ece4d9] shadow-sm overflow-hidden flex flex-col">
                  {selectedTeacherId ? (
                    (() => {
                      const t = teachers.find(teacher => teacher.id === selectedTeacherId);
                      if (!t) return <div className="flex-1 flex items-center justify-center opacity-30">找不到老師資料</div>;
                      const colorObj = getTeacherColor(t.id, teachers);
                      
                      return (
                        <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
                          <div className="p-8 pb-6 border-b border-[#f8f7f2] flex flex-col md:flex-row justify-between items-start md:items-end gap-4 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 blur-3xl -z-10 rounded-full translate-x-1/2 -translate-y-1/2" style={{ backgroundColor: `${colorObj.bg}33` }}></div>
                            
                            <div className="flex items-center gap-6">
                              <div className="relative">
                                <div className="w-20 h-20 rounded-[24px] shadow-lg flex items-center justify-center text-3xl text-white font-serif font-black" style={{ backgroundColor: colorObj.bg, border: `3px solid white` }}>
                                  {t.name.charAt(0)}
                                </div>
                                <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-2 border-white flex items-center justify-center shadow-md ${t.isLineBound ? 'bg-emerald-500' : 'bg-[#ece4d9]'}`}>
                                  <span className="text-[10px]">{t.isLineBound ? '✅' : '🔗'}</span>
                                </div>
                              </div>
                              <div>
                                <h4 className="text-3xl font-serif font-black text-[#4a4238] tracking-[0.1em] mb-1">{t.name}</h4>
                                <div className="flex items-center gap-4 text-xs font-bold text-[#4a4238]/40">
                                  <span>📞 {t.phone || '尚未提供電話'}</span>
                                  <span className="w-1 h-1 rounded-full bg-[#ece4d9]"></span>
                                  <span style={{ color: colorObj.bg }}>ID: {t.id?.slice(-6).toUpperCase()}</span>
                                </div>
                              </div>
                            </div>

                            {/* 操作快捷列 */}
                            <div className="flex flex-wrap gap-2">
                              {canEdit && (
                                <>
                                  <button onClick={() => copyTeacherBindLink(t.id!)} className={`flex items-center gap-1.5 text-[11px] font-black px-4 py-2 rounded-full border transition-all ${t.isLineBound ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-500 hover:text-white' : 'bg-[#f8f7f2] text-[#c4a480] border-[#ece4d9] hover:border-[#c4a480] hover:text-[#4a4238]'}`}>
                                    {t.isLineBound ? '已綁定 LINE' : '💬 連結 LINE'}
                                  </button>
                                  <Link href={`/holidays?teacherId=${t.id}`} className="flex items-center gap-1.5 text-[11px] font-black px-4 py-2 rounded-full border border-[#ece4d9] text-purple-400 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50 transition-all">
                                    🏖️ 安排休假
                                  </Link>
                                  <button onClick={() => openPricingModal(t)} className="flex items-center gap-1.5 text-[11px] font-black px-4 py-2 rounded-full border border-[#ece4d9] text-emerald-500 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-all">
                                    💰 定價比例
                                  </button>
                                  <button onClick={() => openEditModal(t)} className="flex items-center gap-1.5 text-[11px] font-black px-4 py-2 rounded-full border border-[#ece4d9] text-blue-400 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all">
                                    ✎ 編輯檔案
                                  </button>
                                  <button onClick={() => confirmDelete(t.id!)} className="flex items-center gap-1.5 text-[11px] font-black px-4 py-2 rounded-full border border-[#ece4d9] text-red-300 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-all">
                                    ✕ 刪除
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* 詳情本體：科目與定價 */}
                          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#f8f7f2]/30">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                              {/* 專長樂器清單 */}
                              <div className="flex flex-col gap-4">
                                <h5 className="text-xs font-black tracking-[0.2em] text-[#4a4238]/40 border-b border-[#ece4d9] pb-2 uppercase">🎓 授課專長與資歷</h5>
                                <div className="flex flex-wrap gap-2">
                                  {t.instruments.length > 0 ? t.instruments.map(inst => (
                                    <span key={inst} className="bg-white border border-[#ece4d9] px-4 py-2 rounded-xl text-sm font-bold text-[#4a4238] shadow-sm">
                                      🎸 {inst}
                                    </span>
                                  )) : <span className="text-xs italic opacity-30">尚未填寫授課科目</span>}
                                </div>
                              </div>

                              {/* 定價分派清單 */}
                              <div className="flex flex-col gap-4">
                                <h5 className="text-xs font-black tracking-[0.2em] text-[#4a4238]/40 border-b border-[#ece4d9] pb-2 uppercase">📊 定價策略與分拆</h5>
                                <div className="flex flex-col gap-3">
                                  {(t as any).pricingList && (t as any).pricingList.length > 0 ? (
                                    (t as any).pricingList.map((p: any) => (
                                      <div key={p.instrument} className="bg-white p-4 rounded-2xl border border-[#ece4d9] shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-center mb-3">
                                          <span className="font-black text-[#4a4238] tracking-widest">{p.instrument}</span>
                                          <span className="text-[10px] bg-[#4a4238] text-white px-3 py-1 rounded-full font-bold">抽成: {p.payoutRate != null ? Math.round(p.payoutRate * 100) : 60}%</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                          {p.tiers?.map((tier: any, idx: number) => (
                                            <div key={idx} className="bg-[#f8f7f2] p-2 rounded-lg text-center border border-[#ece4d9]/50">
                                              <div className="text-[9px] font-black text-[#c4a480] uppercase tracking-tighter">{tier.minLessons}堂以上</div>
                                              <div className="font-mono font-black text-[#4a4238] text-sm">${tier.rate}</div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-center py-6 bg-white rounded-2xl border border-dashed border-[#ece4d9]">
                                      <p className="font-mono text-xl font-black text-[#4a4238]">$ {t.hourlyRate.toLocaleString()}</p>
                                      <p className="text-[10px] text-[#4a4238]/50 mt-1">基礎每小時定價 (未設定進階科目與階梯定價)</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-40">
                      <div className="text-5xl mb-6">📂</div>
                      <h4 className="text-xl font-bold tracking-widest mb-2">請選擇一位老師</h4>
                      <p className="text-sm">點擊左側名單以查看詳細檔案與管理設定</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <table className="w-full text-left font-sans text-[#4a4238]/90">
                <thead className="bg-[#ece4d9]/50 text-[#4a4238] border-y-2 border-[#ece4d9] uppercase tracking-widest text-xs">
                  <tr>
                    <th className="py-4 px-6 font-black">{activeTab === 'classrooms' ? '識別名稱' : '全名'}</th>
                    <th className="py-4 px-6 font-black">{activeTab === 'classrooms' ? '容載人數' : '聯絡電話'}</th>
                    <th className="py-4 px-6 font-black">{activeTab === 'students' ? '主修科目與負責老師 (分帳戶)' : activeTab === 'teachers' ? '專長科目' : '附屬設備'}</th>
                    {activeTab !== 'students' && <th className="py-4 px-6 font-black">{activeTab === 'teachers' ? '定價(含抽成)' : '系統 ID'}</th>}
                    {activeTab !== 'students' && <th className="py-4 px-6 font-black"></th>}
                    <th className="py-4 px-6 text-right font-black">資料操作</th>
                  </tr>
                </thead>
                <tbody>
                  {renderRows()}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
       )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#4a4238]/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#f8f7f2] w-full max-w-2xl rounded-[30px] shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden">
            <div className="shrink-0 p-8 pb-4 border-b border-[#ece4d9] relative z-20 bg-[#f8f7f2]">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-[#4a4238]/50 hover:text-[#4a4238] font-black">✕</button>
              <h3 className="font-serif text-2xl font-bold tracking-[0.1em] text-[#4a4238]">
                {editingItem ? '編輯修改資料 ✎' : '新建資料卡'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col overflow-y-auto custom-scrollbar flex-1 relative">
              <div className="flex flex-col gap-5 p-8">
              <div>
                <label className="block text-sm font-bold tracking-widest text-[#4a4238] mb-2">{activeTab === 'classrooms' ? '教室名稱' : '姓名'}</label>
                <input required name="name" defaultValue={editingItem?.name || ''} className="w-full bg-white border border-[#ece4d9] rounded-xl px-4 py-3 focus:outline-none focus:border-[#c4a484] transition-colors" placeholder="輸入名稱..." />
              </div>
              
              {activeTab !== 'classrooms' && (
                <div>
                  <label className="block text-sm font-bold tracking-widest text-[#4a4238] mb-2">聯絡電話</label>
                  <input name="phone" defaultValue={editingItem?.phone || ''} className="w-full bg-white border border-[#ece4d9] rounded-xl px-4 py-3 focus:outline-none focus:border-[#c4a484] transition-colors" placeholder="09XX-XXX-XXX" />
                </div>
              )}

              {activeTab === 'students' && (
                <>
                  <div className="bg-[#ece4d9]/30 p-4 rounded-xl border border-[#ece4d9]">
                    <div className="flex justify-between items-center mb-3">
                       <label className="text-xs font-black tracking-widest text-[#4a4238]">主修科目與負責老師</label>
                       <button type="button" onClick={() => setTempEnrollments([...tempEnrollments, { instrument: '', teacherId: '', teacherName: '', remainingLessons: 0, balance: 0 }])} className="text-[10px] bg-[#4a4238] text-white px-3 py-1.5 rounded-md font-bold hover:bg-[#c4a484] transition-colors">+ 新增組合</button>
                    </div>
                    
                    <input type="hidden" name="enrollments_json" value={JSON.stringify(tempEnrollments)} />

                    <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                       {tempEnrollments.length === 0 && <p className="text-center py-4 opacity-40 text-xs italic">尚未新增任何學習科目</p>}
                       {tempEnrollments.map((en, index) => (
                         <div key={index} className="flex flex-col gap-3 bg-white p-4 rounded-lg shadow-sm border border-[#ece4d9]/80 relative group">
                            <button type="button" onClick={() => setTempEnrollments(tempEnrollments.filter((_, i) => i !== index))} className="absolute top-2 right-2 text-[#4a4238]/30 hover:text-red-500 w-6 h-6 flex items-center justify-center font-black text-sm transition-colors z-10" title="移除此科目">✕</button>
                            
                            <div className="grid grid-cols-2 gap-3 mt-1">
                              {/* 主修科目選單 */}
                              <div>
                                 <span className="text-[10px] font-black opacity-40 block mb-1 tracking-widest">主修科目</span>
                                 <select 
                                   value={en.instrument} 
                                   onChange={(e) => {
                                      const newList = [...tempEnrollments];
                                      newList[index].instrument = e.target.value;
                                      newList[index].teacherId = '';
                                      newList[index].teacherName = '';
                                      setTempEnrollments(newList);
                                   }}
                                   className="w-full text-xs font-bold bg-[#f8f7f2] border border-[#ece4d9] rounded-md px-2 py-1.5 focus:border-[#c4a484] focus:outline-none transition-colors"
                                 >
                                    <option value="">— 選擇樂器 —</option>
                                    {allInstruments.map(inst => <option key={inst} value={inst}>{inst}</option>)}
                                 </select>
                              </div>
                              
                              {/* 負責老師選單 */}
                              <div>
                                 <span className="text-[10px] font-black opacity-40 block mb-1 tracking-widest">負責老師</span>
                                 <select 
                                   value={en.teacherId} 
                                   onChange={(e) => {
                                      const teacher = teachers.find(t => t.id === e.target.value);
                                      const newList = [...tempEnrollments];
                                      newList[index].teacherId = e.target.value;
                                      newList[index].teacherName = teacher?.name || '';
                                      setTempEnrollments(newList);
                                   }}
                                   className="w-full text-xs font-bold bg-[#f8f7f2] border border-[#ece4d9] rounded-md px-2 py-1.5 focus:border-[#c4a484] focus:outline-none transition-colors"
                                   disabled={!en.instrument}
                                 >
                                    <option value="">— 選擇老師 —</option>
                                    {teachers
                                      .filter(t => t.instruments.includes(en.instrument))
                                      .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                                    }
                                 </select>
                              </div>

                              {/* 剩餘堂數 */}
                              <div>
                                 <span className="text-[10px] font-black text-[#c4a484] block mb-1 tracking-widest">剩餘堂數</span>
                                 <input 
                                   type="number" 
                                   value={en.remainingLessons ?? 0}
                                   onChange={(e) => {
                                      const newList = [...tempEnrollments];
                                      newList[index].remainingLessons = Number(e.target.value);
                                      setTempEnrollments(newList);
                                   }}
                                   className="w-full text-xs font-bold bg-[#f8f7f2] border border-[#ece4d9] rounded-md px-2 py-1.5 focus:border-[#c4a484] focus:outline-none transition-colors" 
                                 />
                              </div>

                              {/* 儲值金餘額 */}
                              <div>
                                 <span className="text-[10px] font-black text-emerald-600 block mb-1 tracking-widest">儲值餘額 ($)</span>
                                 <input 
                                   type="number" 
                                   value={en.balance ?? 0}
                                   onChange={(e) => {
                                      const newList = [...tempEnrollments];
                                      newList[index].balance = Number(e.target.value);
                                      setTempEnrollments(newList);
                                   }}
                                   className="w-full text-xs font-bold bg-[#f8f7f2] border border-[#ece4d9] rounded-md px-2 py-1.5 focus:border-[#c4a484] focus:outline-none transition-colors" 
                                 />
                              </div>
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>

                  {/* 授權 LINE 綁定電話管理 */}
                  <div className="mt-4 bg-[#f8f7f2] p-6 rounded-2xl border border-[#ece4d9]">
                    <div className="flex justify-between items-center mb-4">
                       <label className="text-xs font-black tracking-widest text-[#4a4238]">📱 授權 LINE 綁定電話</label>
                       <button 
                         type="button" 
                         onClick={() => setTempMobiles([...tempMobiles, ''])}
                         className="text-[10px] font-black text-[#c4a484] bg-white border border-[#ece4d9] px-3 py-1 rounded-lg hover:shadow-md transition-all"
                       >
                         + 新增號碼
                       </button>
                    </div>
                    <div className="flex flex-col gap-2">
                       {tempMobiles.length === 0 && <p className="text-[10px] text-[#4a4238]/40 italic">尚未設定授權號碼，目前無法進行 LINE 綁定。</p>}
                       {tempMobiles.map((m, idx) => (
                         <div key={idx} className="flex gap-2 items-center">
                            <input 
                              type="tel"
                              value={m}
                              onChange={(e) => {
                                const newList = [...tempMobiles];
                                newList[idx] = e.target.value;
                                setTempMobiles(newList);
                              }}
                              placeholder="例如 09xxxxxxxx"
                              className="flex-1 text-xs font-mono bg-white border border-[#ece4d9] rounded-lg px-3 py-2 focus:outline-none focus:border-[#c4a484]"
                            />
                            <button type="button" onClick={() => setTempMobiles(tempMobiles.filter((_, i) => i !== idx))} className="text-red-300 hover:text-red-500 font-bold px-2">✕</button>
                         </div>
                       ))}
                    </div>
                    <p className="text-[9px] text-[#c4a484] mt-3 font-bold uppercase tracking-tighter">※ 家長掃碼時輸入以上任一號碼即可通過驗證。</p>
                  </div>

                  {/* LINE 綁定管理區塊 */}
                  <div className="mt-4 pt-4 border-t border-[#ece4d9]">
                    <label className="block text-[10px] font-black tracking-[0.2em] text-[#4a4238]/40 mb-3 uppercase">LINE 通知對象管理</label>
                    <div className="flex flex-col gap-2">
                       {currentLineBindings.length === 0 ? (
                         <div className="text-[11px] text-[#4a4238]/40 italic py-2">
                           目前尚未有家長綁定通知。
                         </div>
                       ) : (
                         currentLineBindings.map(b => (
                           <div key={b.id} className="flex justify-between items-center bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                              <div className="flex items-center gap-3">
                                 <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-md font-bold">{b.role}</span>
                                 <span className="text-xs font-mono text-[#4a4238] opacity-60">{b.lineUid.substring(0, 8)}...</span>
                              </div>
                              <button 
                                type="button" 
                                onClick={() => handleUnbindLine(b.id!)}
                                className="text-[10px] font-bold text-red-400 hover:text-red-600 border border-red-200 px-3 py-1 rounded-lg hover:bg-white transition-all shadow-sm"
                              >
                                強制解綁 ✖
                              </button>
                           </div>
                         ))
                       )}
                       <div className="mt-2 p-3 bg-[#f8f7f2] rounded-xl border border-dashed border-[#ece4d9] flex justify-between items-center text-[11px]">
                          <span className="text-[#4a4238]/60 font-bold lowercase tracking-wider">綁定專屬連結：</span>
                          <button 
                            type="button" 
                            onClick={() => copyBindLink(editingItem?.id)}
                            className="bg-white text-[#c4a484] px-3 py-1 rounded-md border border-[#c4a484]/30 font-black hover:bg-[#c4a484] hover:text-white transition-all"
                          >
                            點擊複製 Link
                          </button>
                       </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'teachers' && (
                <>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-bold tracking-widest text-[#4a4238] mb-2">授課定價</label>
                    <input type="number" name="hourlyRate" defaultValue={editingItem?.hourlyRate ?? 800} className="w-full bg-white border border-[#ece4d9] rounded-xl px-4 py-3" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-bold tracking-widest text-[#4a4238] mb-2">專長科目</label>
                    <input name="instruments" defaultValue={editingItem?.instruments?.join(', ') || ''} className="w-full bg-white border border-[#ece4d9] rounded-xl px-4 py-3" placeholder="聲樂, 鋼琴" />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-bold tracking-widest text-[#4a4238] mb-2">專屬顏色設定 (將同步至所有系統)</label>
                  <div className="flex flex-wrap gap-3 p-4 bg-[#f8f7f2]/50 border border-[#ece4d9] rounded-xl">
                    <button type="button" onClick={() => setSelectedColorIndex(-1)} className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${selectedColorIndex === -1 ? 'border-[#4a4238] scale-110 shadow-md' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105'}`} style={{ backgroundColor: '#4a4238' }} title="由系統自動分配">
                       {selectedColorIndex === -1 ? <span className="text-white text-sm font-bold">✓</span> : <span className="text-white/40 text-[10px] font-bold">自動</span>}
                    </button>
                    {TEACHER_COLORS.map((tc, idx) => (
                      <button key={idx} type="button" onClick={() => setSelectedColorIndex(idx)} title={tc.name} className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${selectedColorIndex === idx ? 'border-[#4a4238] scale-110 shadow-md' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105'}`} style={{ backgroundColor: tc.bg }}>
                        {selectedColorIndex === idx && <span className="text-white text-sm font-bold">✓</span>}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#4a4238]/60 mt-2 font-bold px-1">第一顆為「自動模式」，系統會依序配發顏色表中的顏色。</p>
                </div>
                </>
              )}

              {activeTab === 'classrooms' && (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-bold tracking-widest text-[#4a4238] mb-2">容載量 (人)</label>
                    <input type="number" name="capacity" defaultValue={editingItem?.capacity ?? 4} className="w-full bg-white border border-[#ece4d9] rounded-xl px-4 py-3" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-bold tracking-widest text-[#4a4238] mb-2">附屬設備</label>
                    <input name="equipment" defaultValue={editingItem?.equipment?.join(', ') || ''} className="w-full bg-white border border-[#ece4d9] rounded-xl px-4 py-3" placeholder="直立鋼琴, 白板" />
                  </div>
                </div>
              )}
              </div>
              <div className="sticky bottom-0 bg-[#f8f7f2] p-6 border-t border-[#ece4d9] flex justify-end gap-3 z-20 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-full text-sm font-bold tracking-widest text-[#4a4238]/60 hover:text-[#4a4238] hover:bg-[#ece4d9] transition-all">
                  取消
                </button>
                <button type="submit" disabled={isSubmitting} className="bg-[#4a4238] hover:bg-[#c4a484] text-white font-bold text-sm tracking-widest py-3 px-8 rounded-full shadow-md flex-1 md:flex-none">
                  {isSubmitting ? '處理中...' : (editingItem ? '儲存變更 ✔' : '建立資料檔案')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isPricingModalOpen && pricingTeacher && (
        <PricingModal
          teacher={pricingTeacher}
          selectedInstrument={selectedInstrument}
          pricingData={pricingData}
          isSubmitting={isSubmitting}
          onClose={() => setIsPricingModalOpen(false)}
          onInstrumentChange={handlePricingInstrumentChange}
          onSave={handlePricingSave}
        />
      )}
      

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-300">
             <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
               <span className="text-red-500 text-3xl">⚠️</span>
             </div>
             <h2 className="text-xl font-bold text-center text-[#4a4238] mb-2 tracking-widest">確定要刪除這筆資料嗎？</h2>
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
