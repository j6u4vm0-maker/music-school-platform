const fs = require('fs');
const path = require('path');
const file = path.resolve('src/app/schedule/page.tsx');
let content = fs.readFileSync(file, 'utf8');

const replacement = `import React, { useState, useRef } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import BookingModal from '@/components/schedule/BookingModal';
import { useAuth } from '@/components/providers/AuthProvider';
import { TEACHER_COLORS, getTeacherColor } from '@/lib/constants/colors';
import { useSchedule } from '@/hooks/useSchedule';
import { Lesson } from '@/lib/types/lesson';

export default function SchedulePage() {
  const { hasPermission, profile } = useAuth();
  const canEdit = hasPermission('schedule', 'EDIT');
  const canView = hasPermission('schedule', 'VIEW');

  const schedule = useSchedule(canEdit);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Combobox 搜尋狀態 (若無使用可視情況移除，但保留以免 UI 有用到)
  const [studentQuery, setStudentQuery] = useState('');

  const handleImportExcelUI = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await schedule.handleImportExcel(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };`;

const lines = content.split('\n');
// find "return (" to know where JSX starts
const returnIndex = lines.findIndex(line => line.includes('return ('));
if (returnIndex !== -1) {
  const newLines = lines.slice(0, 6).concat(replacement.split('\n')).concat(lines.slice(returnIndex));
  fs.writeFileSync(file, newLines.join('\n'));
  console.log('File replaced successfully.');
} else {
  console.log('Could not find return (');
}
