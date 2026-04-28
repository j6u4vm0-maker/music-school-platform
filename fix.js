const fs = require('fs');
const file = 'src/app/schedule/page.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(/import React.*?SchedulePage\(\) \{/s, 
`import React, { useState, useRef } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import BookingModal from '@/components/schedule/BookingModal';
import { useAuth } from '@/components/providers/AuthProvider';
import { TEACHER_COLORS, getTeacherColor } from '@/lib/constants/colors';
import { useSchedule } from '@/hooks/useSchedule';
import { Lesson } from '@/lib/types/lesson';

export default function SchedulePage() {`);

c = c.replace(/onChange=\{handleImportExcel\}/g, 'onChange={handleImportExcelUI}');

fs.writeFileSync(file, c);
console.log('Fixed imports and onChange');
