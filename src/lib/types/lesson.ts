export interface Lesson {
  id?: string;
  type: 'LESSON' | 'RENTAL';
  studentId?: string;
  studentName?: string;
  teacherId?: string;
  teacherName?: string;
  classroomId: string;
  classroomName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  price?: number;

  // Accounting fields
  courseName: string; // Course name (e.g., Piano, Rental)
  lessonsCount: number; // Student charging count (e.g., 1, 1.5)
  payoutLessonsCount?: number; // Teacher payout count
  unitPrice: number; // Single lesson fee
  teacherPayout: number; // Payout to teacher

  paymentMethod: 'UNPAID' | 'CASH' | 'TRANSFER';
  accountSuffix: string;
  isPaid: boolean;
  isSigned: boolean;
  isSettled?: boolean;
  status?: 'NORMAL' | 'LEAVE' | 'CANCELLED';
  remark: string;
}
