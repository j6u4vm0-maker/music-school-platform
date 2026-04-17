import { Teacher } from '../services/db';

export const TEACHER_COLORS = [
  { bg: '#4f46e5', light: '#e0e7ff', text: '#312e81', border: '#818cf8', name: '蓚藍' }, 
  { bg: '#0891b2', light: '#cffafe', text: '#164e63', border: '#22d3ee', name: '天藍' }, 
  { bg: '#059669', light: '#d1fae5', text: '#064e3b', border: '#34d399', name: '翠綠' }, 
  { bg: '#d97706', light: '#fef3c7', text: '#78350f', border: '#fbbf24', name: '琥珀' }, 
  { bg: '#dc2626', light: '#fee2e2', text: '#7f1d1d', border: '#f87171', name: '玫瑰' }, 
  { bg: '#7c3aed', light: '#ede9fe', text: '#4c1d95', border: '#a78bfa', name: '紫羅蘭' }, 
  { bg: '#db2777', light: '#fce7f3', text: '#831843', border: '#f472b6', name: '粉紅' }, 
  { bg: '#0d9488', light: '#ccfbf1', text: '#134e4a', border: '#2dd4bf', name: '孔雀綠' }, 
];

export const getTeacherColor = (teacherId: string | undefined, teachers: Teacher[]) => {
  if (!teacherId) return { bg: '#4a4238', light: '#ece4d9', text: '#4a4238', border: '#c4a484', name: '預設' };
  const teacher = teachers.find(t => t.id === teacherId);
  if (!teacher) return { bg: '#4a4238', light: '#ece4d9', text: '#4a4238', border: '#c4a484', name: '預設' };
  
  if (teacher.colorIndex !== undefined && teacher.colorIndex >= 0 && teacher.colorIndex < TEACHER_COLORS.length) {
    return TEACHER_COLORS[teacher.colorIndex];
  }
  
  const idx = teachers.findIndex(t => t.id === teacherId);
  return TEACHER_COLORS[idx >= 0 ? (idx % TEACHER_COLORS.length) : 0];
};
