export interface Transaction {
  id?: string;
  userId: string;
  userName: string;
  type: 'TOP_UP' | 'LESSON_FEE' | 'TEACHER_PAYOUT' | 'EXPENSE' | 'SALES' | 'RENTAL' | 'OTHER_INCOME';
  amount: number;
  description: string;
  category?: string;
  paymentMethod?: 'CASH' | 'TRANSFER';
  accountSuffix?: string;
  date: string;
  createdAt: number;
  teacherId?: string;
  instrument?: string;
  refId?: string; // Used to link with created entities (e.g., Lesson ID)
}

export interface DailyClosing {
  isClosed: boolean;
  updatedAt: number;
  updatedBy: string;
}
