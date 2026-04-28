"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Student, Teacher, Classroom, PriceTier } from '@/lib/services/db';
import { getTeacherColor } from '@/lib/constants/colors';
import { useAuth } from '@/components/providers/AuthProvider';
import Navbar from '@/components/layout/Navbar';
import { useDatabase } from '@/hooks/useDatabase';
import { TeacherInstrumentPricing } from '@/lib/services/pricing';

// ============================================================
// PricingModal
// ============================================================
function PricingModal({
  teacher, selectedInstrument, pricingData, isSubmitting,
  onClose, onInstrumentChange, onSave
}: {
  teacher: Teacher;
  selectedInstrument: string;
  pricingData: TeacherInstrumentPricing | null;
  isSubmitting: boolean;
  onClose: () => void;
  onInstrumentChange: (instrument: string) => void;
  onSave: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [tiers, setTiers] = useState<PriceTier[]>(
    pricingData?.tiers && pricingData.tiers.length > 0
      ? pricingData.tiers
      : [{ minLessons: 1, rate: 800 }]
  );

  useEffect(() => {
    setTiers(
      pricingData?.tiers && pricingData.tiers.length > 0
        ? pricingData.tiers
        : [{ minLessons: 1, rate: 800 }]
    );
  }, [pricingData]);

  const addTier = () => {
    const lastMin = tiers[tiers.length - 1]?.minLessons || 1;
    setTiers([...tiers, { minLessons: lastMin + 5, rate: Math.max(100, (tiers[tiers.length - 1]?.rate || 800) - 100) }]);
  };

  const removeTier = (index: number) => {
    if (tiers.length <= 1) return;
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: keyof PriceTier, value: number) => {
    setTiers(tiers.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#4a4238]/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[#f8f7f2] w-full max-w-lg rounded-[30px] shadow-2xl p-10 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-6 right-6 text-[#4a4238]/50 hover:text-[#4a4238] text-xl font-bold">✕</button>
        <h3 className="font-serif text-2xl font-bold tracking-[0.1em] text-[#4a4238] mb-2 border-b border-[#ece4d9] pb-4">
          設定授課定價
        </h3>
        <p className="text-xs text-[#c4a484] font-black tracking-widest mb-6">{teacher.name}</p>

        <form key={`${teacher.id}_${selectedInstrument}`} onSubmit={onSave} className="flex flex-col gap-6">
          <div>
            <label className="block text-xs font-black tracking-[0.2em] text-[#4a4238] mb-2 uppercase">授課樂器</label>
            <select
              value={selectedInstrument}
              onChange={e => onInstrumentChange(e.target.value)}
              className="w-full bg-white border border-[#ece4d9] rounded-xl px-4 py-3 font-bold text-[#4a4238]"
            >
              {teacher.instruments.map(inst => <option key={inst} value={inst}>{inst}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black tracking-[0.2em] text-[#4a4238] uppercase">📊 階梯折扣設定</label>
              <button type="button" onClick={addTier} className="text-xs font-black text-[#c4a484] bg-[#c4a484]/10 hover:bg-[#c4a484]/20 px-3 py-1 rounded-full tracking-widest transition-all">
                + 新增階梯
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-[#ece4d9] overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_40px] gap-3 px-4 py-3 bg-[#ece4d9]/40 text-[10px] font-black tracking-widest text-[#4a4238]/60 uppercase">
                <span>購買起始堂數 (含)</span>
                <span>每堂單價 ($)</span>
                <span></span>
              </div>

              {tiers.map((tier, i) => (
                <div key={i} className={`grid grid-cols-[1fr_1fr_40px] gap-3 px-4 py-3 items-center border-t border-[#ece4d9]/50 ${i === 0 ? 'bg-white' : 'bg-[#f8f7f2]'}`}>
                  <div className="flex items-center gap-2">
                    <input type="hidden" name={`tier_min_${i}`} value={tier.minLessons} />
                    <input
                      type="number" min="1" value={tier.minLessons}
                      onChange={e => updateTier(i, 'minLessons', Number(e.target.value))}
                      className="w-full bg-white border border-[#ece4d9] rounded-lg px-3 py-2 font-mono font-black text-[#4a4238] text-sm"
                      readOnly={i === 0}
                    />
                    {i === 0 && <span className="text-[10px] text-[#4a4238]/40 whitespace-nowrap">起始</span>}
                  </div>
                  <div className="relative">
                    <input type="hidden" name={`tier_rate_${i}`} value={tier.rate} />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c4a484] font-black text-sm">$</span>
                    <input
                      type="number" min="1" value={tier.rate}
                      onChange={e => updateTier(i, 'rate', Number(e.target.value))}
                      className="w-full bg-white border border-[#c4a484]/40 rounded-lg pl-7 pr-3 py-2 font-mono font-black text-[#4a4238] text-sm"
                    />
                  </div>
                  <button
                    type="button" onClick={() => removeTier(i)} disabled={tiers.length <= 1}
                    className="text-red-300 hover:text-red-500 font-black disabled:opacity-20 transition-colors text-lg"
                  >✕</button>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-[#4a4238]/50 leading-relaxed bg-[#ece4d9]/30 px-4 py-3 rounded-xl">
              💡 <strong>範例：</strong>第一階 1堂起 $1,000/堂，第二階 6堂起 $900/堂（買 6 堂以上自動適用 $900 計算）
            </div>
          </div>

          <div>
            <label className="block text-xs font-black tracking-[0.2em] text-[#4a4238] mb-2 uppercase">教師抽成 (%)</label>
            <input
              type="number" name="payoutRate"
              defaultValue={(pricingData?.payoutRate != null ? pricingData.payoutRate : 0.6) * 100}
              className="w-full bg-white border border-[#ece4d9] rounded-xl px-4 py-3 font-bold text-[#4a4238]"
            />
            <p className="text-[10px] text-[#4a4238]/50 mt-1">影響排程與教師對帳單的自動計算</p>
          </div>

          <button type="submit" disabled={isSubmitting} className="bg-[#4a4238] hover:bg-[#c4a484] text-white font-black tracking-widest py-4 px-6 rounded-full shadow-md transition-all">
            {isSubmitting ? '儲存中...' : '確認更新定價 ✔'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function DatabasePage() {
  const { hasPermission, profile } = useAuth();
  const canEdit = hasPermission('database', 'EDIT');
  const canView = hasPermission('database', 'VIEW');

  const db = useDatabase(canEdit);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    activeTab, setActiveTab,
    students, teachers, classrooms, isLoading,
    isModalOpen, setIsModalOpen,
    isPricingModalOpen, setIsPricingModalOpen,
    isSubmitting,
    editingItem, setEditingItem,
    tempEnrollments, setTempEnrollments,
    currentLineBindings,
    tempMobiles, setTempMobiles,
    selectedColorIndex, setSelectedColorIndex,
    selectedTeacherId, setSelectedTeacherId,
    pricingTeacher, pricingData, selectedInstrument,
    isDeleteModalOpen, setIsDeleteModalOpen,
    isImporting,
    openCreateModal, openEditModal, openPricingModal,
    handlePricingInstrumentChange, handlePricingSave,
    handleUnbindLine, confirmDelete, executeDelete, handleSubmit,
    handleExportExcel, handleImportExcel
  } = db;

  const handleImportExcelUI = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleImportExcel(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onSaveProxy = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit(new FormData(e.currentTarget));
  };

  const onPricingSaveProxy = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handlePricingSave(new FormData(e.currentTarget));
  };

  const copyBindLink = (studentId: string) => {
    const url = `${window.location.origin}/line/bind?student_id=${studentId}`;
    navigator.clipboard.writeText(url);
    alert("✅ 綁定連結已複製到剪貼簿！");
  };

  const copyTeacherBindLink = (teacherId: string) => {
    const url = `${window.location.origin}/line/bind?teacher_id=${teacherId}`;
    navigator.clipboard.writeText(url);
    alert("✅ 老師專屬綁定連結已複製！");
  };

  const renderRows = () => {
    if (activeTab === 'students') {
      return students.map((s) => (
        <tr key={s.id} className="border-b border-[#ece4d9] hover:bg-[#c4a484]/10 transition-colors">
          <td className="py-4 px-6 font-bold text-[#4a4238]">{s.name}</td>
          <td className="py-4 px-6 tracking-widest text-sm">{s.phone || '-'}</td>
          <td className="py-4 px-6 min-w-[200px]" colSpan={3}>
             <div className="flex flex-wrap gap-2">
               {s.enrollments && s.enrollments.length > 0 ? (
                 s.enrollments.map((en, i) => (
                   <div key={i} className="flex flex-col bg-white border border-[#ece4d9] rounded-lg px-3 py-2 shadow-sm group/badge hover:border-[#c4a484] transition-all min-w-[140px]">
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-[10px] font-black tracking-widest text-[#4a4238]/60 uppercase">{en.instrument}</span>
                        <span className="text-xs font-bold text-[#4a4238]">{en.teacherName}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-mono mt-1 border-t border-[#ece4d9]/50 pt-1">
                        <span className="text-[#c4a484] font-bold">{en.remainingLessons || 0} 堂</span>
                        <span className="text-emerald-600 font-bold">${(en.balance || 0).toLocaleString()}</span>
                      </div>
                   </div>
                 ))
               ) : (
                 <span className="text-xs opacity-40 italic">尚未配置科目</span>
               )}
             </div>
          </td>
          <td className="py-4 px-6 text-right whitespace-nowrap">
            {canEdit && (
              <button onClick={() => copyBindLink(s.id!)} className={`font-bold px-3 transition-colors ${s.isLineBound ? 'text-green-500' : 'text-[#c4a484]'}`}>
                {s.isLineBound ? '✅ LINE' : '🔗 連結'}
              </button>
            )}
            {canEdit && <button onClick={() => openEditModal(s)} className="text-blue-500 hover:text-blue-700 font-bold px-3">編輯 ✎</button>}
            {canEdit && <button onClick={() => confirmDelete(s.id!)} className="text-red-400 hover:text-red-600 font-bold pr-2">刪除 ❌</button>}
          </td>
        </tr>
      ));
    }
    if (activeTab === 'teachers') {
      return teachers.map((t) => {
        const colorObj = getTeacherColor(t.id, teachers);
        const isSelected = selectedTeacherId === t.id;
        return (
          <tr key={t.id} className={`border-b border-[#ece4d9] hover:bg-[#c4a484]/10 transition-colors ${isSelected ? 'bg-[#c4a484]/5' : ''}`}>
            <td className="py-4 px-6 font-bold text-[#4a4238] flex items-center gap-3">
              <span className="w-3.5 h-3.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: colorObj.bg, border: `1px solid ${colorObj.border}` }}></span>
              {t.name}
            </td>
            <td className="py-4 px-6 tracking-widest text-sm">{t.phone || '-'}</td>
            <td className="py-4 px-6 text-[#c4a484] font-bold text-sm tracking-widest">{t.instruments.join(', ')}</td>
            <td className="py-4 px-6 font-mono text-[#4a4238] font-bold">
              {t.pricingList && t.pricingList.length > 0 ? (
                 <div className="flex flex-col gap-1 mt-1 mb-1">
                   {t.pricingList.map((p: any) => (
                     <span key={p.instrument} className="text-xs bg-[#c4a484]/10 border border-[#c4a484]/30 px-2 py-0.5 rounded-md inline-block mr-1 mb-1 text-[#4a4238]">
                       {p.instrument}: <span className="text-[#c4a484]">${p.tiers?.[0]?.rate || t.hourlyRate}</span>/Hr
                       <span className="ml-2 text-[10px] bg-[#4a4238] text-white px-1.5 py-0.5 rounded">抽: {p.payoutRate != null ? Math.round(p.payoutRate * 100) : 60}%</span>
                     </span>
                   ))}
                 </div>
              ) : (
                 <span className="opacity-50 text-xs">$ {t.hourlyRate.toLocaleString()} / Hr</span>
              )}
            </td>
            <td className="py-4 px-6 text-right whitespace-nowrap">
              {canEdit && (
                <button onClick={() => copyTeacherBindLink(t.id!)} className={`font-bold px-3 transition-all ${t.isLineBound ? 'text-green-500' : 'text-[#c4a480]'}`}>
                  {t.isLineBound ? '✅ LINE' : '🔗 連結'}
                </button>
              )}
              {canEdit && <Link href={`/holidays?teacherId=${t.id}`} className="text-purple-500 hover:text-purple-700 font-bold px-3">🏖️ 休假</Link>}
              {canEdit && <button onClick={() => openPricingModal(t)} className="text-emerald-500 hover:text-emerald-700 font-bold px-3">💰 定價</button>}
              {canEdit && <button onClick={() => openEditModal(t)} className="text-blue-500 hover:text-blue-700 font-bold px-3">編輯 ✎</button>}
              {canEdit && <button onClick={() => confirmDelete(t.id!)} className="text-red-400 hover:text-red-600 font-bold pr-2">刪除 ❌</button>}
            </td>
          </tr>
        );
      });
    }
    return classrooms.map((c) => (
      <tr key={c.id} className="border-b border-[#ece4d9] hover:bg-[#c4a484]/10 transition-colors">
        <td className="py-4 px-6 font-bold text-[#4a4238]">{c.name}</td>
        <td className="py-4 px-6 text-[#c4a484] font-black tracking-widest text-sm">{c.capacity} 人</td>
        <td className="py-4 px-6 text-[#4a4238]/70 text-sm tracking-widest">{c.equipment.join(', ')}</td>
        <td className="py-4 px-6 font-mono text-gray-400 text-xs">{c.id}</td>
        <td className="py-4 px-6 text-right">
            {canEdit && <button onClick={() => openEditModal(c)} className="text-blue-500 hover:text-blue-700 font-bold px-3">編輯 ✎</button>}
            {canEdit && <button onClick={() => confirmDelete(c.id!)} className="text-red-400 hover:text-red-600 font-bold pr-2">刪除 ❌</button>}
        </td>
      </tr>
    ));
  };

  return (
    <main className="flex min-h-screen flex-col items-center pb-24 relative overflow-x-hidden bg-[#f8f7f2]">
      <div className="absolute top-[10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#ece4d9] blur-[150px] opacity-70 -z-10"></div>
      <Navbar pageTitle="人事與資源庫" />

      {!canView ? (
        <div className="flex-grow flex items-center justify-center p-20">
           <div className="bg-white p-12 rounded-[40px] shadow-2xl border-2 border-red-50/50 text-center">
              <h3 className="text-4xl mb-4">🚫</h3>
              <p className="font-black text-[#4a4238] tracking-[0.2em]">權限不足。</p>
           </div>
        </div>
      ) : (
      <div className="w-full max-w-7xl px-4 z-10 flex flex-col items-center">
        <div className="flex gap-4 md:gap-8 mb-8 w-full border-b-2 border-[#ece4d9] px-4">
          {[
            { id: 'students', label: '學員名單' },
            { id: 'teachers', label: '師資陣容' },
            { id: 'classrooms', label: '空間設施' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`pb-4 text-sm md:text-base font-bold tracking-[0.2em] transition-all relative ${activeTab === tab.id ? 'text-[#4a4238]' : 'text-[#4a4238]/40 hover:text-[#c4a484]'}`}>
              {tab.label}
              {activeTab === tab.id && <div className="absolute bottom-[-2px] left-0 w-full h-[3px] bg-[#c4a484] rounded-t-full"></div>}
            </button>
          ))}
        </div>

        <div className="elegant-card w-full p-8 md:p-12 min-h-[60vh] flex flex-col">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-[#ece4d9] pb-6">
            <h3 className="font-serif text-2xl font-bold text-[#4a4238]">
              {activeTab === 'students' ? '學員名冊' : activeTab === 'teachers' ? '師資清單' : '教室管理'}
            </h3>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="bg-emerald-500 text-white font-bold px-6 py-3 rounded-full text-sm">📥 匯入</button>
              <button onClick={handleExportExcel} className="bg-[#c4a484] text-white font-bold px-6 py-3 rounded-full text-sm">📤 匯出</button>
              {canEdit && <button onClick={openCreateModal} className="bg-[#4a4238] text-white font-bold px-8 py-3 rounded-full text-sm">＋ 新增</button>}
              <input type="file" ref={fileInputRef} onChange={handleImportExcelUI} hidden accept=".xlsx, .xls" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#ece4d9]/40 text-[#4a4238] text-xs font-black uppercase tracking-widest">
                <tr>
                  <th className="py-4 px-6">名稱</th>
                  <th className="py-4 px-6">電話</th>
                  {activeTab === 'students' ? (
                    <th className="py-4 px-6" colSpan={3}>選修科目</th>
                  ) : activeTab === 'teachers' ? (
                    <>
                      <th className="py-4 px-6">專長</th>
                      <th className="py-4 px-6">薪資/定價</th>
                    </>
                  ) : (
                    <>
                      <th className="py-4 px-6">容納</th>
                      <th className="py-4 px-6">設備</th>
                    </>
                  )}
                  <th className="py-4 px-6 text-right">操作</th>
                </tr>
              </thead>
              <tbody>{renderRows()}</tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
           <div className="bg-[#f8f7f2] w-full max-w-lg rounded-[30px] p-10 relative shadow-2xl">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6">✕</button>
              <h3 className="text-xl font-bold mb-6">{editingItem ? '編輯資料' : '新增資料'}</h3>
              <form onSubmit={onSaveProxy} className="flex flex-col gap-6">
                 <input name="name" defaultValue={editingItem?.name} placeholder="名稱" className="w-full p-4 rounded-xl border border-[#ece4d9]" required />
                 <input name="phone" defaultValue={editingItem?.phone} placeholder="電話" className="w-full p-4 rounded-xl border border-[#ece4d9]" />
                 
                 {activeTab === 'teachers' && (
                   <>
                     <input name="instruments" defaultValue={editingItem?.instruments?.join(', ')} placeholder="專長科目 (逗號分隔)" className="w-full p-4 rounded-xl border border-[#ece4d9]" />
                     <input type="number" name="hourlyRate" defaultValue={editingItem?.hourlyRate} placeholder="基礎鐘點費" className="w-full p-4 rounded-xl border border-[#ece4d9]" />
                   </>
                 )}

                 {activeTab === 'classrooms' && (
                   <>
                     <input type="number" name="capacity" defaultValue={editingItem?.capacity} placeholder="容納人數" className="w-full p-4 rounded-xl border border-[#ece4d9]" />
                     <input name="equipment" defaultValue={editingItem?.equipment?.join(', ')} placeholder="設備 (逗號分隔)" className="w-full p-4 rounded-xl border border-[#ece4d9]" />
                   </>
                 )}

                 {activeTab === 'students' && (
                   <input type="hidden" name="enrollments_json" value={JSON.stringify(tempEnrollments)} />
                 )}

                 <button type="submit" disabled={isSubmitting} className="bg-[#4a4238] text-white py-4 rounded-full font-bold">
                    {isSubmitting ? '儲存中...' : '確認儲存'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {isPricingModalOpen && pricingTeacher && (
        <PricingModal
          teacher={pricingTeacher}
          selectedInstrument={selectedInstrument}
          pricingData={pricingData}
          isSubmitting={isSubmitting}
          onClose={() => setIsPricingModalOpen(false)}
          onInstrumentChange={handlePricingInstrumentChange}
          onSave={onPricingSaveProxy}
        />
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl p-8 max-w-sm w-full">
             <h2 className="text-xl font-bold text-center mb-6">確定刪除？</h2>
             <div className="flex gap-4">
               <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-[#ece4d9] rounded-xl font-bold">取消</button>
               <button onClick={executeDelete} className="flex-1 py-3 bg-red-400 text-white rounded-xl font-bold">確認</button>
             </div>
           </div>
        </div>
      )}
    </main>
  );
}
