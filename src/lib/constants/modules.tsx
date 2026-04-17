import React from 'react';

export interface Module {
  href: string;
  id?: string;
  label: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  accent?: string;
  bg: string;
  featured?: boolean;
  permissionKey: string;
  isAction?: boolean;
}

export const modules: Module[] = [
  {
    href: '/schedule',
    label: 'Schedule',
    title: '課程排程',
    desc: '教室與教師一覽，防撞堂自動配置',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    accent: '#6d9ab5',
    bg: 'from-[#eef4f8] to-[#ddeaf3]',
    permissionKey: 'schedule',
  },
  {
    href: '/database',
    label: 'Database',
    title: '師生資料庫',
    desc: '學生帳戶、教師檔案與教室設備管理',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    accent: '#7a9e7e',
    bg: 'from-[#eef5ef] to-[#ddeedd]',
    permissionKey: 'database',
  },
  {
    href: '/finance',
    label: 'Finance',
    title: '財務與核銷',
    desc: '課程儲值、薪資撥款與月營運分析',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    accent: '#c4a484',
    bg: 'from-[#f8f4ef] to-[#f0e8de]',
    featured: true,
    permissionKey: 'finance',
  },
  {
    href: '/inventory',
    label: 'Inventory',
    title: '進銷存與零售',
    desc: '樂器、教材等商品庫存監控與帳本連動',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    accent: '#d97757',
    bg: 'from-[#fcedea] to-[#f4dcd6]',
    permissionKey: 'finance',
  },
  {
    href: '/teacher-salary',
    label: 'Teacher Salary',
    title: '教師薪資核銷',
    desc: '獨立老師薪資核算與核銷管理中心',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    accent: '#312e81',
    bg: 'from-[#eef2ff] to-[#e0e7ff]',
    permissionKey: 'teacher_salary',
  },
  {
    href: '/ledger',
    label: 'Ledger',
    title: '每日對帳單',
    desc: '自動摘要現金匯款與教師薪資抽成',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    accent: '#9b7cc8',
    bg: 'from-[#f3eff8] to-[#e8e0f2]',
    permissionKey: 'ledger',
  },
  {
    href: '/holidays',
    label: 'Holidays',
    title: '老師排休管理',
    desc: '連假設定、每週重複排休與衝突偵測',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 18v-5l-4 4m4-4l4 4" />
      </svg>
    ),
    accent: '#f43f5e',
    bg: 'from-[#fff1f2] to-[#ffe4e6]',
    permissionKey: 'holidays',
  },
  {
    href: '/settings',
    id: 'settings',
    label: 'Settings',
    title: '系統設定',
    desc: '帳號權限管理與系統備份',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    bg: 'from-[#ece4d9] to-[#dcd4c9]',
    permissionKey: 'settings',
  },
  {
    href: '/teacher-dashboard/schedule',
    label: 'Portal',
    title: '我的老師課表',
    desc: '老師專用視圖：自有課程詳細呈現，他人佔用遮蔽顯示',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    accent: '#3b82f6',
    bg: 'from-[#eff6ff] to-[#dbeafe]',
    permissionKey: 'portal',
  },
];
