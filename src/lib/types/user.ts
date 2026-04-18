export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';

export type PermissionLevel = 'NONE' | 'VIEW' | 'EDIT';

export type ModulePermissions = Record<string, PermissionLevel>;

export interface UserProfile {
  uid: string;
  id?: string; // Firebase document ID (alias for uid in some contexts)
  email: string | null;
  name: string;
  phone?: string;
  role: Role;
  permissions?: ModulePermissions;
  teacherId?: string; // Associate with teacher DB if role is TEACHER
  createdAt?: number;
}

export interface StudentEnrollment {
  instrument: string;
  teacherId: string;
  teacherName: string;
  payoutRate?: number; // Payout percentage/rate
  balance?: number;
  remainingLessons?: number;
}

export interface Student extends UserProfile {
  role: 'STUDENT';
  balance: number;
  remainingLessons: number;
  enrollments?: StudentEnrollment[];
  isLineBound?: boolean;
  parentName?: string;
  parentPhone?: string;
  lineId?: string;
  contact_mobiles?: string[];
  
  /** @deprecated Use enrollments instead */
  instrument?: string;
  /** @deprecated Use enrollments instead */
  teacherId?: string;
  /** @deprecated Use enrollments instead */
  teacherName?: string;
}

export interface Teacher extends UserProfile {
  role: 'TEACHER';
  instruments: string[];
  hourlyRate: number;
  colorIndex?: number;
  parentName?: string;
  parentPhone?: string;
  lineId?: string;
}

export interface Classroom {
  id?: string;
  name: string;
  capacity: number;
  equipment: string[];
}
