import { useState, useEffect } from 'react';
import { getStudents, getTeachers, getClassrooms } from '@/lib/services/db';
import { getLessonsByDateRange } from '@/lib/services/schedule';
import { multiSheetExport } from '@/lib/utils/excel';
import { modules, Module } from '@/lib/constants/modules';
import { arrayMove, DragEndEvent } from '@dnd-kit/sortable';

export const useDashboard = () => {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedModules, setSelectedModules] = useState<string[]>(['students', 'teachers', 'classrooms', 'lessons']);
  const [isExporting, setIsExporting] = useState(false);
  const [orderedModules, setOrderedModules] = useState<Module[]>(modules);

  useEffect(() => {
    const savedOrder = localStorage.getItem('7th_dashboard_order');
    if (savedOrder) {
      try {
        const orderArray = JSON.parse(savedOrder);
        const sorted = [...modules].sort((a, b) => {
          return orderArray.indexOf(a.href) - orderArray.indexOf(b.href);
        });
        setOrderedModules(sorted);
      } catch (e) {
        setOrderedModules(modules);
      }
    }
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = orderedModules.findIndex(m => m.href === active.id);
      const newIndex = orderedModules.findIndex(m => m.href === over?.id);
      const newOrdered = arrayMove(orderedModules, oldIndex, newIndex);
      setOrderedModules(newOrdered);
      localStorage.setItem('7th_dashboard_order', JSON.stringify(newOrdered.map(m => m.href)));
    }
  };

  const exportOptions = [
    { id: 'students', label: '學員名冊', get: async () => await getStudents() },
    { id: 'teachers', label: '教師檔案', get: async () => await getTeachers() },
    { id: 'classrooms', label: '教室配置', get: async () => await getClassrooms() },
    { id: 'lessons', label: '全年度課表資料', get: async () => {
        const now = new Date();
        return await getLessonsByDateRange(`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`);
      } 
    },
  ];

  const handleSelectAll = () => {
    if (selectedModules.length === exportOptions.length) setSelectedModules([]);
    else setSelectedModules(exportOptions.map(o => o.id));
  };

  const handleExport = async () => {
    if (selectedModules.length === 0) return;
    setIsExporting(true);
    try {
      const sheets: { [key: string]: any[] } = {};
      for (const opt of exportOptions) {
        if (selectedModules.includes(opt.id)) {
          const data = await opt.get();
          sheets[opt.label] = data;
        }
      }
      multiSheetExport(sheets, `第七樂章_系統資料備份_${new Date().toISOString().split('T')[0]}`);
      setIsExportModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("匯出失敗，請檢查權限設定");
    } finally {
      setIsExporting(false);
    }
  };

  return {
    isExportModalOpen, setIsExportModalOpen,
    selectedModules, setSelectedModules,
    isExporting,
    orderedModules, setOrderedModules,
    handleDragEnd,
    exportOptions,
    handleSelectAll,
    handleExport
  };
};
