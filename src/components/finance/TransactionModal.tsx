import React, { useState, useEffect } from 'react';
import { Transaction } from '@/lib/types/finance';
import { Student, Teacher } from '@/lib/types/user';
import { TeacherInstrumentPricing, getTeacherPricingList, getPricing, calculatePackagePrice } from '@/lib/services/pricing';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: any) => Promise<void>;
  modalType: 'TOP_UP' | 'TEACHER_PAYOUT' | 'EXPENSE' | 'OTHER_INCOME';
  editingTx: Transaction | null;
  students: Student[];
  teachers: Teacher[];
  categories: string[];
  canEdit: boolean;
}

export default function TransactionModal({
  isOpen,
  onClose,
  onSave,
  modalType,
  editingTx,
  students,
  teachers,
  categories,
  canEdit
}: TransactionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Internal form state
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [accountSuffix, setAccountSuffix] = useState('');
  const [category, setCategory] = useState('');
  const [targetIdx, setTargetIdx] = useState<number>(0);

  // TOP_UP specific combo state
  const [topUpTeacher, setTopUpTeacher] = useState<Teacher | null>(null);
  const [topUpInstrument, setTopUpInstrument] = useState<string>('');
  const [topUpPricing, setTopUpPricing] = useState<TeacherInstrumentPricing | null>(null);
  const [topUpLessons, setTopUpLessons] = useState<number>(0);
  const [calculatedAmount, setCalculatedAmount] = useState<number>(0);
  const [availableInstruments, setAvailableInstruments] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (editingTx) {
        setAmount(Math.abs(editingTx.amount));
        setDescription(editingTx.description);
        setPaymentMethod(editingTx.paymentMethod || 'CASH');
        setAccountSuffix(editingTx.accountSuffix || '');
        setCategory(editingTx.category || '');
        
        if (modalType === 'TOP_UP') {
          const sIdx = students.findIndex(s => s.id === editingTx.userId);
          setTargetIdx(sIdx !== -1 ? sIdx : 0);
        } else if (modalType === 'TEACHER_PAYOUT') {
          const tIdx = teachers.findIndex(t => t.id === editingTx.userId);
          setTargetIdx(tIdx !== -1 ? tIdx : 0);
        }
      } else {
        // Reset for new
        setAmount(0);
        setDescription(modalType === 'TEACHER_PAYOUT' ? '課程薪資撥款' : modalType === 'TOP_UP' ? '學生儲值' : modalType === 'EXPENSE' ? '日常經營支出' : '');
        setPaymentMethod('CASH');
        setAccountSuffix('');
        setCategory(modalType === 'EXPENSE' ? categories.filter(c => !["課程營收", "樂器買賣", "場地租借", "樂譜販售", "其他收入"].includes(c))[0] || '' : categories[0] || '');
        setTargetIdx(0);
        
        setTopUpTeacher(null);
        setTopUpInstrument('');
        setTopUpPricing(null);
        setTopUpLessons(0);
        setCalculatedAmount(0);
        setAvailableInstruments([]);
      }
    }
  }, [isOpen, editingTx, modalType, students, teachers, categories]);

  const handleTopUpTeacherChange = async (teacher: Teacher | null) => {
    setTopUpTeacher(teacher);
    setTopUpInstrument('');
    setTopUpPricing(null);
    setCalculatedAmount(0);
    setTopUpLessons(0);
    if (teacher) {
      const pricingList = await getTeacherPricingList(teacher.id!);
      setAvailableInstruments(pricingList.map(p => p.instrument));
    } else {
      setAvailableInstruments([]);
    }
  };

  const handleTopUpInstrumentChange = async (instrument: string) => {
    setTopUpInstrument(instrument);
    setCalculatedAmount(0);
    setTopUpLessons(0);
    if (topUpTeacher && instrument) {
      const pricing = await getPricing(topUpTeacher.id!, instrument);
      setTopUpPricing(pricing);
    } else {
      setTopUpPricing(null);
    }
  };

  const handleTopUpLessonsChange = async (lessons: number) => {
    setTopUpLessons(lessons);
    if (topUpPricing && lessons > 0) {
      const price = await calculatePackagePrice(topUpPricing, lessons);
      setCalculatedAmount(price);
      setAmount(price);
    } else {
      setCalculatedAmount(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = {
        amount,
        description,
        paymentMethod,
        accountSuffix,
        category,
        targetIdx,
        topUpLessons,
        topUpTeacherId: topUpTeacher?.id,
        topUpInstrument,
        calculatedAmount
      };
      await onSave(formData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#4a4238]/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#f8f7f2] w-full max-w-xl rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] p-10 relative border-2 border-white max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button onClick={onClose} className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center rounded-full bg-[#ece4d9]/50 text-[#4a4238] hover:bg-[#c4a484] hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <h3 className="font-serif text-3xl font-black tracking-[0.2em] text-[#4a4238] mb-8 border-b-2 border-[#ece4d9] pb-6 flex items-baseline gap-4">
          {modalType === 'TOP_UP' && (editingTx ? '修改儲值紀錄' : '學生課卡建立與儲值')}
          {modalType === 'TEACHER_PAYOUT' && (editingTx ? '修改撥款紀錄' : '教師鐘點費下發')}
          {modalType === 'OTHER_INCOME' && (editingTx ? '修改收入紀錄' : '其他項目收入登記')}
          {modalType === 'EXPENSE' && (editingTx ? '修改支出紀錄' : '營運雜支/其他紀錄')}
        </h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {modalType === 'TOP_UP' && (
            <>
              <div>
                <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">① 選擇學生</label>
                <select required value={targetIdx} onChange={e => setTargetIdx(parseInt(e.target.value))} className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-[#4a4238] focus:outline-none focus:border-[#c4a484] transition-all">
                  {students.map((s, i) => <option key={s.id} value={i}>{s.name} (剩餘: {s.remainingLessons} 堂)</option>)}
                </select>
              </div>

              <div className="bg-[#f0ebe4] rounded-2xl p-5 flex flex-col gap-4 border border-[#e2d5c5]">
                <p className="text-xs font-black tracking-[0.2em] text-[#4a4238]/60 uppercase">② 選擇課程組合 (老師 + 樂器)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black tracking-widest text-[#4a4238] mb-2">授課老師</label>
                    <select
                      className="w-full bg-white border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-bold text-[#4a4238]"
                      value={topUpTeacher?.id || ''}
                      onChange={e => {
                        const t = teachers.find(t => t.id === e.target.value) || null;
                        handleTopUpTeacherChange(t);
                      }}
                    >
                      <option value="">— 選擇老師 —</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black tracking-widest text-[#4a4238] mb-2">
                      樂器 {topUpTeacher && availableInstruments.length === 0 && <span className="text-red-400">(尚未設定定價)</span>}
                    </label>
                    <select
                      className="w-full bg-white border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-bold text-[#4a4238] disabled:opacity-40"
                      value={topUpInstrument}
                      disabled={!topUpTeacher || availableInstruments.length === 0}
                      onChange={e => handleTopUpInstrumentChange(e.target.value)}
                    >
                      <option value="">— 選擇樂器 —</option>
                      {availableInstruments.map(inst => <option key={inst} value={inst}>{inst}</option>)}
                    </select>
                  </div>
                </div>

                {topUpPricing && (
                  <div className="flex flex-col gap-4 mt-2 animate-in fade-in duration-300">
                    <div className="bg-white rounded-xl p-4 border border-[#ece4d9]">
                      <p className="text-[10px] font-black tracking-[0.2em] text-[#4a4238]/50 mb-3">📊 定價階梯</p>
                      <div className="flex flex-wrap gap-2">
                        {topUpPricing.tiers.map((tier, i) => {
                          const nextMin = topUpPricing.tiers[i+1]?.minLessons;
                          const label = nextMin ? `${tier.minLessons}~${nextMin-1} 堂` : `${tier.minLessons}+ 堂`;
                          const isActive = topUpLessons >= tier.minLessons && (!nextMin || topUpLessons < nextMin);
                          return (
                            <span key={i} className={`px-3 py-1 rounded-full text-xs font-black border transition-all ${isActive ? 'bg-[#4a4238] text-white border-[#4a4238]' : 'bg-white text-[#4a4238] border-[#ece4d9]'}`}>
                              {label}: ${tier.rate.toLocaleString()}/堂
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 items-end">
                      <div>
                        <label className="block text-xs font-black tracking-widest text-[#4a4238] mb-2">③ 購買堂數</label>
                        <input
                          type="number"
                          min="1"
                          value={topUpLessons || ''}
                          onChange={e => handleTopUpLessonsChange(Number(e.target.value))}
                          className="w-full bg-white border-2 border-[#c4a484] rounded-xl px-4 py-3 font-black text-xl text-[#4a4238] focus:outline-none"
                          placeholder="輸入堂數"
                        />
                      </div>
                      <div className="bg-[#4a4238] rounded-xl px-4 py-3 text-center">
                        <p className="text-[#ece4d9]/60 text-[10px] font-black tracking-widest">自動計算總金額</p>
                        <p className="text-white text-2xl font-mono font-black">${calculatedAmount.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!topUpPricing && (
                <div>
                  <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">
                    ③ 儲值金額 <span className="text-[#4a4238]/40 font-normal text-xs">(未選定組合時手動輸入)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[#c4a484] font-black text-xl">$</span>
                    <input
                      type="number"
                      required={!topUpPricing}
                      value={amount || ''}
                      onChange={e => setAmount(parseFloat(e.target.value))}
                      className="w-full bg-white border-2 border-[#ece4d9] text-[#4a4238] rounded-2xl px-12 py-4 font-mono font-black text-2xl focus:outline-none focus:border-[#c4a484] transition-all"
                      placeholder="例如：10000"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {modalType === 'TEACHER_PAYOUT' && (
            <>
              <div>
                <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">選擇撥款教師</label>
                <select required value={targetIdx} onChange={e => setTargetIdx(parseInt(e.target.value))} className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-[#4a4238] focus:outline-none focus:border-[#c4a484] transition-all">
                  {teachers.map((t, i) => <option key={t.id} value={i}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">撥款金額 (-)</label>
                <input type="number" required value={amount || ''} onChange={e => setAmount(parseFloat(e.target.value))} className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-red-400 focus:outline-none focus:border-[#c4a484] transition-all" placeholder="例如：3200" />
              </div>
            </>
          )}

          {modalType === 'OTHER_INCOME' && (
            <>
              <div>
                <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">收入科目 (會計科目)</label>
                <select required value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-[#4a4238]">
                  {categories.filter(c => !["教師薪資", "雜支"].includes(c)).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">收入金額 (+)</label>
                <input type="number" required value={amount || ''} onChange={e => setAmount(parseFloat(e.target.value))} className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-[#c4a484] focus:outline-none focus:border-[#c4a484] transition-all" placeholder="例如：2500" />
              </div>
            </>
          )}

          {modalType === 'EXPENSE' && (
            <>
              <div>
                <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">支出科目 (會計科目)</label>
                <select required value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-[#4a4238]">
                   {categories.filter(c => !["課程營收", "樂器買賣", "場地租借", "樂譜販售", "其他收入"].includes(c)).map(c => (
                     <option key={c} value={c}>{c}</option>
                   ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">項目金額 (-)</label>
                <input type="number" required value={amount || ''} onChange={e => setAmount(parseFloat(e.target.value))} className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-red-400 focus:outline-none focus:border-[#c4a484] transition-all" placeholder="例如：1500" />
              </div>
            </>
          )}

          {(modalType === 'TOP_UP' || modalType === 'TEACHER_PAYOUT' || modalType === 'OTHER_INCOME' || modalType === 'EXPENSE') && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">收/支方式</label>
                  <select required value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)} className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-[#4a4238]">
                    <option value="CASH">💵 現金</option>
                    <option value="TRANSFER">🏦 銀行匯款</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">帳號尾數 (匯款必填)</label>
                  <input value={accountSuffix} onChange={e => setAccountSuffix(e.target.value)} placeholder="末五碼" className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-lg text-[#4a4238]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-black tracking-[0.2em] text-[#4a4238] mb-3">備註說明</label>
                <input
                  required
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="輸入備註..."
                  className="w-full bg-white border-2 border-[#ece4d9] rounded-2xl px-5 py-4 font-bold text-base text-[#4a4238] focus:outline-none focus:border-[#c4a484] transition-all"
                />
              </div>
            </div>
          )}

          <button type="submit" disabled={isSubmitting || !canEdit} className="mt-8 bg-[#4a4238] disabled:bg-gray-400 hover:bg-[#c4a484] text-white font-bold tracking-[0.3em] py-5 px-6 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 text-lg hover:-translate-y-1">
            {isSubmitting ? '加密計算中...' : (editingTx ? '儲存並更新變更' : '確認並存入總帳')}
          </button>
        </form>
      </div>
    </div>
  );
}
