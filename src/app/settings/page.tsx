"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { getAllUsers, createUser, saveUserProfile, resetPassword, logout } from '@/lib/services/auth';
import { getTeachers, Teacher, deleteUser } from '@/lib/services/db';
import { exportToExcel } from '@/lib/utils/excel';
import { getStudents, getClassrooms } from '@/lib/services/db';
import { SYSTEM_MODULES } from '@/lib/constants/modules';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'accounts' | 'maintenance'>('accounts');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const { hasPermission, profile } = useAuth();
  const router = useRouter();

  // 權限檢查：只有 ADMIN 角色可以進入設定頁面管理的帳號部分
  // 我們使用 settings 的 VIEW 或 EDIT 權限來控制進入頁面
  const canView = hasPermission('settings', 'VIEW');
  const canEdit = hasPermission('settings', 'EDIT');
  const isAdmin = profile?.role === 'ADMIN';

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [users, teacherList] = await Promise.all([
        getAllUsers(),
        getTeachers()
      ]);
      setProfiles(users);
      setTeachers(teacherList);
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const handleResetPassword = async (uid: string, email: string) => {
    const newPass = prompt(`請輸入 [${email}] 的新密碼：\n(建議至少 6 碼)`);
    if (!newPass) return;
    
    if (newPass.length < 6) {
      alert("密碼太短，安全起見請至少輸入 6 個字元。");
      return;
    }

    try {
      await resetPassword(uid, newPass);
      alert(`✅ 密碼重設成功！\n\n請將這組新密碼通知該主管/老師：\n帳號：${email}\n密碼：${newPass}`);
    } catch (err) {
      alert("重設失敗，請稍後再試。");
    }
  };

  const handleDeleteAccount = async (uid: string) => {
    if (!confirm("確定要刪除此帳號嗎？此操作不可恢復。")) return;
    try {
      await deleteUser(uid);
      fetchData();
    } catch (err) {
      alert("刪除失敗");
    }
  };

  const openEditModal = (user: any) => {
    setEditingItem(user);
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const form = new FormData(e.currentTarget);
    
    try {
      const email = form.get('email') as string;
      const password = form.get('password') as string;
      const role = form.get('role') as any;
      const teacherId = form.get('teacherId') as string;
      
      const permissions: any = {};
      SYSTEM_MODULES.forEach(m => {
        permissions[m.id] = form.get(`p_${m.id}`) as any;
      });

      if (editingItem) {
        await saveUserProfile({ ...editingItem, role, permissions, teacherId });
      } else {
        await createUser(email, password, role, permissions, '', teacherId);
      }
      
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      alert(`儲存失敗: ${error.message}`);
    }
    setIsSubmitting(false);
  };

  const handleExportAll = async () => {
    setIsLoading(true);
    try {
      const [s, t, c] = await Promise.all([getStudents(), getTeachers(), getClassrooms()]);
      exportToExcel(s, '學生名單_備份');
      setTimeout(() => exportToExcel(t, '教師名單_備份'), 500);
      setTimeout(() => exportToExcel(c, '教室空間_備份'), 1000);
    } catch (e) {
      alert("匯出失敗");
    }
    setIsLoading(false);
  };

  if (!canView) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f2]">
        <div className="text-center p-12 bg-white rounded-[40px] shadow-xl border-2 border-[#ece4d9]">
          <h1 className="text-4xl mb-4">🚫</h1>
          <h2 className="font-serif text-2xl font-black text-[#4a4238] tracking-widest">權限不足</h2>
          <p className="text-[#4a4238]/60 mt-4 font-bold">設定模組僅供授權管理員存取。</p>
          <Link href="/" className="mt-8 inline-block bg-[#4a4238] text-white px-8 py-3 rounded-full font-bold">返回首頁</Link>
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center pb-24 relative overflow-x-hidden bg-[#f8f7f2]">
      <div className="absolute top-[10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#ece4d9] blur-[150px] opacity-70 -z-10"></div>
      
      <div className="w-full max-w-7xl px-4 pt-6 z-40 mb-12">
        <nav className="glass-nav px-8 py-5 flex justify-between items-center shadow-sm">
          <Link href="/" className="flex items-center gap-4 cursor-pointer hover:-translate-y-1 transition-transform">
            <div className="w-12 h-12 rounded-full border-2 border-[#4a4238] flex items-center justify-center font-serif text-xl font-bold text-[#4a4238]">7th</div>
            <h1 className="font-serif font-black text-xl tracking-[0.2em] text-[#4a4238]">系統設定中心</h1>
          </Link>
          <div className="flex items-center gap-4">
             <span className="text-[10px] font-black tracking-widest text-[#c4a484] uppercase bg-white/50 px-3 py-1 rounded-full border border-[#ece4d9]">System Config ⚙️</span>
          </div>
        </nav>
      </div>

      <div className="w-full max-w-7xl px-4 z-10">
        <div className="flex gap-8 mb-8 border-b-2 border-[#ece4d9] px-4">
          <button onClick={() => setActiveTab('accounts')} className={`pb-4 text-base font-bold tracking-[0.2em] transition-all relative ${activeTab === 'accounts' ? 'text-[#4a4238]' : 'text-[#4a4238]/40 hover:text-[#c4a484]'}`}>
            帳號與權限
            {activeTab === 'accounts' && <div className="absolute bottom-[-2px] left-0 w-full h-[3px] bg-[#c4a484] rounded-t-full shadow-[0_-2px_10px_rgba(196,164,132,0.5)]"></div>}
          </button>
          <button onClick={() => setActiveTab('maintenance')} className={`pb-4 text-base font-bold tracking-[0.2em] transition-all relative ${activeTab === 'maintenance' ? 'text-[#4a4238]' : 'text-[#4a4238]/40 hover:text-[#c4a484]'}`}>
            系統維護與備份
            {activeTab === 'maintenance' && <div className="absolute bottom-[-2px] left-0 w-full h-[3px] bg-[#c4a484] rounded-t-full shadow-[0_-2px_10px_rgba(196,164,132,0.5)]"></div>}
          </button>
        </div>

        <div className="elegant-card w-full p-8 md:p-12 min-h-[60vh] flex flex-col">
          {activeTab === 'accounts' ? (
            <>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 pb-6 border-b border-[#ece4d9] gap-4">
                <div>
                  <h3 className="font-serif text-2xl font-bold tracking-[0.1em] text-[#4a4238]">系統使用者權限管理</h3>
                  <p className="text-xs text-[#c4a484] font-bold mt-1 uppercase tracking-widest">User Roles & Module Access Controls</p>
                </div>
                {canEdit && (
                  <button onClick={openCreateModal} className="bg-[#4a4238] text-white px-8 py-3 rounded-full font-bold text-sm tracking-widest hover:bg-[#c4a484] transition-all shadow-lg flex items-center gap-2">
                    <span>+</span> 建立新帳號
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#f8f7f2] border-b-2 border-[#ece4d9]">
                    <tr className="text-[#4a4238]/60 text-xs font-black tracking-widest uppercase">
                      <th className="py-4 px-6 md:px-12 w-64">登入帳號 (Email)</th>
                      <th className="py-4 px-6">角色</th>
                      <th className="py-4 px-6">權限</th>
                      <th className="py-4 px-6">UID</th>
                      <th className="py-4 px-6 text-right">管理操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ece4d9]/30">
                    {profiles.map((p) => (
                      <tr key={p.uid} className="hover:bg-[#c4a484]/5 transition-colors">
                        <td className="py-5 px-6 md:px-12 font-bold text-[#4a4238]">{p.email}</td>
                        <td className="py-5 px-6">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${p.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                            {p.role}
                          </span>
                        </td>
                        <td className="py-5 px-6">
                           <div className="flex flex-wrap gap-1">
                              {Object.entries(p.permissions || {}).map(([key, val]: [string, any]) => (
                                <span key={key} title={key} className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${val === 'NONE' ? 'bg-gray-50 text-gray-300 border-gray-100' : val === 'VIEW' ? 'bg-blue-50 text-blue-500 border-blue-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                  {key[0].toUpperCase()}
                                </span>
                              ))}
                           </div>
                        </td>
                        <td className="py-5 px-6 font-mono text-[10px] text-gray-300">{p.uid.substring(0, 8)}...</td>
                        <td className="py-5 px-6 text-right">
                          <div className="flex gap-2 justify-end">
                            {canEdit && (
                              <>
                                <button onClick={() => handleResetPassword(p.uid, p.email)} className="text-amber-500 hover:text-amber-700 text-xs font-bold px-3 py-1 bg-amber-50 rounded-lg transition-colors">🔑 密碼</button>
                                <button onClick={() => openEditModal(p)} className="text-blue-500 hover:text-blue-700 text-xs font-bold px-3 py-1 bg-blue-50 rounded-lg transition-colors">✎ 權限</button>
                                <button onClick={() => handleDeleteAccount(p.uid)} className="text-red-400 hover:text-red-600 text-xs font-bold px-3 py-1 bg-red-50 rounded-lg transition-colors">✕</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner">💾</div>
              <h3 className="font-serif text-3xl font-black text-[#4a4238] tracking-widest mb-4">系統維護與備份中心</h3>
              <p className="max-w-md text-[#4a4238]/60 font-bold leading-relaxed mb-10 tracking-widest">
                建議定期匯出全系統資料進行實體備份。匯出檔案將以 Excel 格式儲存，包含學生、教師、教室與課表歷史。
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                 <button onClick={handleExportAll} disabled={isLoading || !canEdit} className="p-8 bg-white border-2 border-emerald-100 rounded-3xl hover:border-emerald-500 transition-all group group shadow-xl hover:-translate-y-2 disabled:opacity-40 disabled:cursor-not-allowed">
                    <div className="text-3xl mb-3 group-hover:scale-125 transition-transform">📊</div>
                    <h4 className="font-black text-[#4a4238] tracking-widest mb-1">匯出全系統資料庫</h4>
                    <p className="text-[10px] text-[#4a4238]/40 font-bold uppercase">Export All Data to Excel</p>
                 </button>
                 <div className="p-8 bg-white/40 border-2 border-dashed border-[#ece4d9] rounded-3xl opacity-50 cursor-not-allowed">
                    <div className="text-3xl mb-3">☁️</div>
                    <h4 className="font-black text-[#4a4238] tracking-widest mb-1">雲端自動同步 (開發中)</h4>
                    <p className="text-[10px] text-[#4a4238]/40 font-bold uppercase">Cloud Sync Features</p>
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#4a4238]/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#f8f7f2] w-full max-w-lg rounded-[40px] shadow-2xl p-10 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-[#4a4238]/40 hover:text-[#4a4238] text-xl font-bold transition-colors">✕</button>
            <h3 className="font-serif text-2xl font-bold tracking-[0.1em] text-[#4a4238] mb-8 border-b border-[#ece4d9] pb-4">
              {editingItem ? '修改帳號權限' : '建立全新系統使用者'}
            </h3>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                  <div>
                    <label className="block text-[10px] font-black tracking-widest text-[#4a4238]/60 mb-2 uppercase">帳號 Email</label>
                    <input required name="email" readOnly={!!editingItem} defaultValue={editingItem?.email || ''} className="w-full bg-white border border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-[#4a4238] focus:ring-2 focus:ring-[#c4a484]/20 outline-none transition-all" placeholder="user@academy.com" />
                  </div>
                  {!editingItem && (
                    <div>
                      <label className="block text-[10px] font-black tracking-widest text-[#4a4238]/60 mb-2 uppercase">初始登入密碼</label>
                      <input required type="password" name="password" className="w-full bg-white border border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-[#4a4238]" />
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-black tracking-widest text-[#4a4238]/60 mb-2 uppercase">系統角色定位 Role</label>
                    <select name="role" defaultValue={editingItem?.role || 'TEACHER'} className="w-full bg-white border border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-[#4a4238] appearance-none">
                      <option value="TEACHER">老師部 (TEACHER)</option>
                      <option value="ADMIN">管理部 (ADMIN)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black tracking-widest text-[#4a4238]/60 mb-2 uppercase">關聯教師資料實體</label>
                    <select name="teacherId" defaultValue={editingItem?.teacherId || ''} className="w-full bg-white border border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-[#4a4238] appearance-none">
                      <option value="">— 不進行實體關聯 —</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.instruments.join('/')})</option>
                      ))}
                    </select>
                    <p className="text-[9px] text-[#c4a484] mt-2 font-bold px-1 uppercase tracking-tighter italic">※ 選取後，該帳號將在 Portal 模組看見此老師的個人排程。</p>
                  </div>

                  <div className="bg-white/60 p-6 rounded-3xl border border-[#ece4d9] flex flex-col gap-4 shadow-inner">
                    <p className="text-[10px] font-black tracking-[0.3em] text-[#c4a484] mb-2 uppercase">模組權限細節設定 Module Control</p>
                    {SYSTEM_MODULES.map(m => (
                      <div key={m.id} className="flex items-center justify-between group">
                        <div className="flex items-center gap-2">
                           <span className="text-sm">{m.icon}</span>
                           <span className="text-xs font-black text-[#4a4238]/80 group-hover:text-[#4a4238] transition-colors">{m.name}</span>
                        </div>
                        <select name={`p_${m.id}`} defaultValue={(editingItem?.permissions as any)?.[m.id] || (editingItem?.role === 'ADMIN' ? 'EDIT' : 'NONE')} className="text-[10px] font-black bg-white border border-[#ece4d9] rounded-xl px-3 py-2 outline-none focus:border-[#c4a484] transition-all">
                          <option value="NONE">🚫 不可見</option>
                          <option value="VIEW">👁️ 僅讀取</option>
                          <option value="EDIT">✍️ 可編輯</option>
                        </select>
                      </div>
                    ))}
                  </div>

              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-xs font-black tracking-widest text-[#4a4238]/40 hover:text-[#4a4238] transition-colors uppercase">
                  Cancel 取消
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-2 bg-[#4a4238] text-white font-black tracking-widest py-4 px-10 rounded-2xl shadow-xl hover:bg-[#c4a484] transition-all disabled:opacity-50">
                  {isSubmitting ? 'Processing...' : (editingItem ? '儲存權限設定 Update' : '建立使用者帳號 Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
