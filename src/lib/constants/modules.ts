export interface SystemModule {
  id: string;
  name: string;
  icon?: string;
  description?: string;
}

export const SYSTEM_MODULES: SystemModule[] = [
  { id: 'finance', name: '財務與核銷', icon: '💰' },
  { id: 'schedule', name: '課程排程', icon: '🗓️' },
  { id: 'database', name: '師生資料庫', icon: '🗄️' },
  { id: 'holidays', name: '老師排休管理', icon: '🏖️' },
  { id: 'portal', name: '我的老師課表 (PORTAL)', icon: '📱' },
  { id: 'settings', name: '系統設定管理', icon: '⚙️' },
  { id: 'ledger', name: '每日對帳單', icon: '📊' },
  { id: 'inventory', name: '進銷存管理', icon: '📦' },
  { id: 'teacher_salary', name: '薪資核銷', icon: '🧾' },
];
