import { useState, useEffect } from 'react';
import { 
  getStudents, getTeachers, getClassrooms, 
  addUser, addClassroom, updateUser, deleteUser, updateClassroom, deleteClassroom, 
  Student, Teacher, Classroom 
} from '@/lib/services/db';
import { getStudentBindings, getTeacherBindings, unbindLineAccount, LineBinding } from '@/lib/services/line';
import { getTeacherPricingList, getPricing, savePricing, TeacherInstrumentPricing } from '@/lib/services/pricing';
import { exportToExcel, importFromExcel } from '@/lib/utils/excel';

export const useDatabase = (canEdit: boolean) => {
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
  const [tempEnrollments, setTempEnrollments] = useState<any[]>([]);
  const [currentLineBindings, setCurrentLineBindings] = useState<LineBinding[]>([]);
  const [tempMobiles, setTempMobiles] = useState<string[]>([]);
  const [selectedColorIndex, setSelectedColorIndex] = useState<number>(-1);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

  const [pricingTeacher, setPricingTeacher] = useState<Teacher | null>(null);
  const [pricingData, setPricingData] = useState<TeacherInstrumentPricing | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<string>('');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const fetchedStudents = await getStudents();
      const fetchedTeachers = await getTeachers();
      const fetchedClassrooms = await getClassrooms();

      // Parallel fetch extra data
      const [studentsWithBindings, teachersWithPricing] = await Promise.all([
        Promise.all(fetchedStudents.map(async (s) => {
          const bindings = await getStudentBindings(s.id!);
          return { ...s, isLineBound: bindings.length > 0 };
        })),
        Promise.all(fetchedTeachers.map(async (t) => {
          const pricingList = await getTeacherPricingList(t.id!);
          const bindings = await getTeacherBindings(t.id!);
          return { ...t, pricingList, isLineBound: bindings.length > 0 };
        }))
      ]);

      setStudents(studentsWithBindings);
      setTeachers(teachersWithPricing as any);
      setClassrooms(fetchedClassrooms);

    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const handlePricingSave = async (formData: FormData) => {
    if (!pricingTeacher || !selectedInstrument) return;
    
    setIsSubmitting(true);
    const payoutRate = Number(formData.get('payoutRate')) / 100;
    const tiers: { minLessons: number; rate: number }[] = [];
    let i = 0;
    while (formData.get(`tier_min_${i}`) !== null) {
      tiers.push({
        minLessons: Number(formData.get(`tier_min_${i}`)),
        rate: Number(formData.get(`tier_rate_${i}`)),
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
    await fetchData();
    setIsSubmitting(false);
  };

  const handleUnbindLine = async (bindingId: string) => {
    if (!confirm("確定要強制解除此 LINE 綁定嗎？家長將無法再收到通知。")) return;
    try {
      await unbindLineAccount(bindingId);
      setCurrentLineBindings(prev => prev.filter(b => b.id !== bindingId));
      await fetchData();
    } catch (err) {
      alert("解綁失敗");
    }
  };

  const confirmDelete = (id: string) => {
    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (activeTab === 'classrooms') await deleteClassroom(itemToDelete);
      else await deleteUser(itemToDelete);
      await fetchData();
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (e) {
      alert("刪除失敗，請檢查權限");
    }
  };

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    try {
      if (activeTab === 'students') {
        const parsedEnrollments = JSON.parse(formData.get('enrollments_json') as string || '[]');
        const totalBalance = parsedEnrollments.reduce((sum: number, en: any) => sum + (Number(en.balance) || 0), 0);
        const totalLessons = parsedEnrollments.reduce((sum: number, en: any) => sum + (Number(en.remainingLessons) || 0), 0);

        const payload: Partial<Student> = {
          name: formData.get('name') as string,
          phone: formData.get('phone') as string,
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
          name: formData.get('name') as string,
          phone: formData.get('phone') as string,
          role: 'TEACHER',
          instruments: (formData.get('instruments')?.toString() || '').split(',').map(s => s.trim()).filter(Boolean),
          hourlyRate: Number(formData.get('hourlyRate')) || 0,
          colorIndex: selectedColorIndex >= 0 ? selectedColorIndex : null,
        };
        if (editingItem) await updateUser(editingItem.id, payload);
        else await addUser(payload as Teacher);

      } else if (activeTab === 'classrooms') {
        const payload: Partial<Classroom> = {
          name: formData.get('name') as string,
          capacity: Number(formData.get('capacity')) || 0,
          equipment: (formData.get('equipment') as string).split(',').map(s => s.trim())
        };
        if (editingItem) await updateClassroom(editingItem.id, payload);
        else await addClassroom(payload as Classroom);
      }
      
      setIsModalOpen(false);
      setEditingItem(null);
      await fetchData();
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

  const handleImportExcel = async (file: File) => {
    setIsImporting(true);
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
      await fetchData();
    } catch (err) {
      alert("解析 Excel 失敗，請確認檔案格式正確。");
    }
    setIsImporting(false);
  };

  return {
    activeTab, setActiveTab,
    students, teachers, classrooms, isLoading,
    isModalOpen, setIsModalOpen,
    isPricingModalOpen, setIsPricingModalOpen,
    isHolidayModalOpen, setIsHolidayModalOpen,
    holidayTeacher, setHolidayTeacher,
    isSubmitting,
    editingItem, setEditingItem,
    tempEnrollments, setTempEnrollments,
    currentLineBindings, setCurrentLineBindings,
    tempMobiles, setTempMobiles,
    selectedColorIndex, setSelectedColorIndex,
    selectedTeacherId, setSelectedTeacherId,
    pricingTeacher, pricingData, selectedInstrument,
    isDeleteModalOpen, setIsDeleteModalOpen,
    isImporting,
    fetchData,
    openCreateModal, openEditModal, openHolidayModal, openPricingModal,
    handlePricingInstrumentChange, handlePricingSave,
    handleUnbindLine, confirmDelete, executeDelete, handleSubmit,
    handleExportExcel, handleImportExcel
  };
};
