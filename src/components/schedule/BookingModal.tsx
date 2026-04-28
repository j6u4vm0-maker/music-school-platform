import React, { useState, useEffect } from 'react';
import { Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption } from '@headlessui/react';
import { Lesson } from '@/lib/types/lesson';
import { Student, Teacher, Classroom } from '@/lib/types/user';
import { getPricing } from '@/lib/services/pricing';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: any) => Promise<void>;
  editingLessonId: string | null;
  initialFormState: any;
  students: Student[];
  teachers: Teacher[];
  classrooms: Classroom[];
  timeSlots: string[];
  canEdit: boolean;
}

export default function BookingModal({
  isOpen,
  onClose,
  onSave,
  editingLessonId,
  initialFormState,
  students,
  teachers,
  classrooms,
  timeSlots,
  canEdit
}: BookingModalProps) {
  const [formState, setFormState] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studentQuery, setStudentQuery] = useState('');

  // Sync internal state when initialFormState changes (e.g. when opening modal)
  useEffect(() => {
    if (isOpen) {
      setFormState(initialFormState);
    }
  }, [isOpen, initialFormState]);

  const handleFormChange = async (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    let val: any = value;
    
    // Numeric sanitization
    if (['lessonsCount', 'payoutLessonsCount', 'unitPrice', 'teacherPayout'].includes(name)) {
      val = value === '' ? 0 : parseFloat(value);
      if (isNaN(val)) val = 0;
    }

    let nextState = {
      ...formState,
      [name]: val
    };

    // Index sanitization
    if (['studentIdx', 'teacherIdx', 'classroomIdx'].includes(name)) {
      nextState[name] = parseInt(value) || 0;
    }

    // 1. Time & Lessons Count Sync
    if (name === 'startTime' || name === 'endTime') {
      const sIdx = timeSlots.indexOf(nextState.startTime);
      if (name === 'startTime') {
        if (sIdx !== -1 && sIdx + 2 < timeSlots.length) {
          nextState.endTime = timeSlots[sIdx + 2];
        } else if (sIdx + 1 < timeSlots.length) {
          nextState.endTime = timeSlots[sIdx + 1];
        }
      }

      const [h1, m1] = nextState.startTime.split(':').map(Number);
      const [h2, m2] = nextState.endTime.split(':').map(Number);
      const diffMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diffMinutes > 0) {
        const hours = diffMinutes / 60;
        nextState.lessonsCount = hours;
        nextState.payoutLessonsCount = hours;
      }
    }

    // 2. Type Switch
    if (name === 'type' && value === 'RENTAL') {
      nextState.courseName = '教室租借';
      nextState.teacherPayout = 0;
      nextState.unitPrice = 200;
    } else if (name === 'type' && value === 'LESSON' && formState.type === 'RENTAL') {
      nextState.courseName = '鋼琴';
    }

    // 3. Student Switch - Load Enrollments
    if (name === 'studentIdx') {
      const student = students[nextState.studentIdx as number];
      if (student && student.enrollments && student.enrollments.length > 0) {
        const en = student.enrollments[0];
        nextState.courseName = en.instrument;
        const foundTIdx = teachers.findIndex(t => t.id === en.teacherId);
        if (foundTIdx !== -1) {
          nextState.teacherIdx = foundTIdx;
          nextState.payoutRate = en.payoutRate || 0.6;
        }
      }
    }

    setFormState(nextState);

    // 4. Async Pricing & Payout Calculation
    if (nextState.type === 'LESSON' && (
      ['studentIdx', 'teacherIdx', 'courseName', 'lessonsCount', 'payoutLessonsCount', 'unitPrice', 'startTime', 'endTime', 'type'].includes(name)
    )) {
      const teacher = teachers[nextState.teacherIdx as number];
      if (teacher) {
        let pRate = nextState.payoutRate;
        let finalUnitPrice = typeof nextState.unitPrice === 'string' ? parseFloat(nextState.unitPrice as string) : (nextState.unitPrice as number);

        if (name !== 'unitPrice' && name !== 'lessonsCount' && name !== 'payoutLessonsCount') {
          const pricing = await getPricing(teacher.id!, nextState.courseName);
          if (pricing) {
            pRate = pricing.payoutRate ?? pRate;
            finalUnitPrice = pricing.tiers?.[0]?.rate || teacher.hourlyRate;
          } else {
            finalUnitPrice = teacher.hourlyRate;
          }

          if (name === 'studentIdx') {
            const student = students[nextState.studentIdx as number];
            if (student && student.enrollments && student.enrollments.length > 0) {
              const en = student.enrollments[0];
              if (en.payoutRate) pRate = en.payoutRate;
            }
          }
        }

        const calculatedPayout = Math.round(finalUnitPrice * (nextState.payoutLessonsCount as number) * pRate);
        setFormState(prev => ({
          ...prev,
          unitPrice: finalUnitPrice,
          payoutRate: pRate,
          teacherPayout: calculatedPayout
        }));
      }
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    setIsSubmitting(true);
    try {
      await onSave(formState);
    } catch (err: any) {
      console.error("Submit error:", err);
      alert("儲存失敗：" + (err.message || "未知錯誤"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#4a4238]/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#f8f7f2] w-full max-w-2xl rounded-[40px] shadow-2xl p-10 relative border-2 border-white max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button onClick={onClose} className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center rounded-full bg-[#ece4d9]/50 text-[#4a4238] hover:bg-[#c4a484] hover:text-white transition-colors">✕</button>

        <h3 className="font-serif text-3xl font-black tracking-[0.2em] text-[#4a4238] mb-6 border-b-2 border-[#ece4d9] pb-6 uppercase">
          {editingLessonId ? '編輯預約資訊 ✎' : '新增預約資訊 +'}
        </h3>

        <div className="flex gap-4 mb-8 bg-[#ece4d9]/50 p-2 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => setFormState(prev => ({ ...prev, type: 'LESSON', courseName: '鋼琴', unitPrice: 800, teacherPayout: 480 }))}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold tracking-widest transition-all ${formState.type === 'LESSON' ? 'bg-[#4a4238] text-white shadow-lg' : 'text-[#4a4238] hover:bg-white/50'}`}>
            🎹 音樂課程
          </button>
          <button
            type="button"
            onClick={() => setFormState(prev => ({ ...prev, type: 'RENTAL', courseName: '教室租借', unitPrice: 200, teacherPayout: 0 }))}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold tracking-widest transition-all ${formState.type === 'RENTAL' ? 'bg-[#c4a484] text-white shadow-lg' : 'text-[#4a4238] hover:bg-white/50'}`}>
            🏢 教室租借
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {formState.type === 'LESSON' && (
            <div className="flex flex-col gap-5 bg-white border-2 border-[#ece4d9] rounded-3xl p-6 shadow-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2">預約學員</label>
                  <Combobox
                    value={students[formState.studentIdx as any] || null}
                    onChange={(selectedStudent: Student | null) => {
                      if (!selectedStudent) return;
                      const idx = students.findIndex(s => s.id === selectedStudent.id);
                      handleFormChange({ target: { name: 'studentIdx', value: String(idx) } } as any);
                    }}>
                    <div className="relative z-[100]">
                      <ComboboxInput
                        className="w-full bg-[#f8f7f2] border-none outline-none rounded-xl px-4 py-3 font-bold text-[#4a4238] placeholder:text-[#4a4238]/40 focus:ring-2 focus:ring-[#c4a484]/50 transition-shadow"
                        displayValue={(s: Student | null) => s ? `${s.name} (餘額: $${s.balance?.toLocaleString() || 0}, 剩餘: ${s.remainingLessons || 0} 堂)` : ''}
                        onChange={(event) => setStudentQuery(event.target.value)}
                        placeholder="輸入姓名或電話搜尋..."
                      />
                      <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-4">
                        <span className="text-[#c4a484] opacity-80 text-xs font-black">▼</span>
                      </ComboboxButton>
                      <ComboboxOptions
                        className="absolute mt-2 min-w-full w-max max-w-[300px] max-h-60 overflow-auto rounded-xl bg-white py-2 shadow-2xl ring-2 ring-[#ece4d9] focus:outline-none custom-scrollbar"
                        style={{ zIndex: 1000 }}
                      >
                        {(() => {
                          const filtered = studentQuery === ''
                            ? students
                            : students.filter((s) => s.name.toLowerCase().includes(studentQuery.toLowerCase()) || (s.phone && s.phone.includes(studentQuery)));

                          if (filtered.length === 0 && studentQuery !== '') {
                            return (
                              <div className="relative cursor-default select-none py-3 px-4 text-sm text-[#4a4238]/60 font-bold">
                                查無符合條件的學員
                              </div>
                            );
                          }

                          return filtered.map((s) => (
                            <ComboboxOption
                              key={s.id}
                              className="group relative cursor-pointer select-none py-3 px-4 transition-colors data-[focus]:bg-[#ece4d9]/40 data-[focus]:text-[#4a4238]"
                              value={s}
                            >
                              <span className="block truncate font-bold group-data-[selected]:font-black text-[#4a4238]/80 group-data-[focus]:text-[#4a4238] group-data-[selected]:text-[#4a4238]">
                                {s.name}
                              </span>
                              <span className="block truncate text-[10px] text-[#c4a484] font-mono mt-0.5">
                                餘額: ${s.balance?.toLocaleString() || 0} / 剩餘: {s.remainingLessons || 0} 堂
                              </span>
                            </ComboboxOption>
                          ));
                        })()}
                      </ComboboxOptions>
                    </div>
                  </Combobox>
                </div>

                {students[formState.studentIdx as any]?.enrollments && (students[formState.studentIdx as any].enrollments?.length ?? 0) > 0 && (
                  <div>
                    <label className="block text-[11px] font-black tracking-[0.2em] text-[#c4a484] mb-2 uppercase">快速帶入學員學習方案</label>
                    <select
                      value=""
                      onChange={async (e) => {
                        if (!e.target.value) return;
                        const idx = parseInt(e.target.value);
                        const en = students[formState.studentIdx as any].enrollments?.[idx];
                        if (en) {
                          let nextState = { ...formState, courseName: en.instrument };
                          const tIdx = teachers.findIndex(t => t.id === en.teacherId);
                          if (tIdx !== -1) {
                            nextState.teacherIdx = tIdx;
                            nextState.payoutRate = en.payoutRate || 0.6;
                            const teacher = teachers[tIdx];
                            const pricing = await getPricing(teacher.id!, en.instrument);
                            let finalUnitPrice = pricing?.tiers?.[0]?.rate || teacher.hourlyRate;
                            let pRate = en.payoutRate || pricing?.payoutRate || 0.6;
                            nextState.unitPrice = finalUnitPrice;
                            nextState.payoutRate = pRate;
                            nextState.teacherPayout = Math.round(finalUnitPrice * nextState.payoutLessonsCount * pRate);
                          }
                          setFormState(nextState);
                        }
                      }}
                      className="w-full bg-emerald-50 text-emerald-800 border-none rounded-xl px-4 py-3 font-bold text-sm cursor-pointer hover:bg-emerald-100 transition-colors"
                    >
                      <option value="">請選擇方案與師資</option>
                      {students[formState.studentIdx as any].enrollments?.map((en, i) => (
                        <option key={i} value={i}>{en.instrument} ({en.teacherName})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2">指導老師</label>
                  <select required name="teacherIdx" value={formState.teacherIdx} onChange={handleFormChange} className="w-full bg-[#f8f7f2] border-none rounded-xl px-4 py-3 font-bold">
                    {teachers.map((t, i) => <option key={t.id} value={i}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2">課程項目</label>
                  <input required name="courseName" value={formState.courseName} onChange={handleFormChange} className="w-full bg-[#f8f7f2] border-none rounded-xl px-4 py-3 font-bold text-sm" />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2">預約時間 (起)</label>
              <select required name="startTime" value={formState.startTime} onChange={handleFormChange} className="w-full bg-white border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-bold">
                {timeSlots.map((t, idx) => idx !== timeSlots.length - 1 && <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2">預約時間 (迄)</label>
              <select required name="endTime" value={formState.endTime} onChange={handleFormChange} className="w-full bg-white border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-bold">
                {timeSlots.map((t, idx) => idx !== 0 && <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2 uppercase">預約日期</label>
              <input type="date" required name="bookingDate" value={formState.bookingDate} onChange={handleFormChange} className="w-full bg-white border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-bold text-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2 uppercase">安排教室</label>
              <select required name="classroomIdx" value={formState.classroomIdx} onChange={handleFormChange} className="w-full bg-white border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-bold">
                {classrooms.map((c, i) => <option key={c.id} value={i}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="border-t-2 border-dashed border-[#ece4d9] pt-5 mt-2">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2 uppercase">學員扣除堂數</label>
                <input type="number" step="0.5" required name="lessonsCount" value={formState.lessonsCount} onChange={handleFormChange} className="w-full bg-white border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-bold text-sm" />
              </div>
              <div>
                <label className="block text-[11px] font-black tracking-[0.2em] text-red-500 mb-2 uppercase">老師計薪堂數</label>
                <input type="number" step="0.5" required name="payoutLessonsCount" value={formState.payoutLessonsCount} onChange={handleFormChange} className="w-full bg-white border-2 border-red-100 rounded-xl px-4 py-3 font-bold text-sm text-red-600" />
              </div>
              <div>
                <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2 uppercase">{formState.type === 'RENTAL' ? '租借單價' : '課程單價'} ($)</label>
                <input type="number" required name="unitPrice" readOnly={!canEdit} value={formState.unitPrice} onChange={handleFormChange} className={`w-full bg-white border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-mono font-black text-sm text-[#c4a484] ${!canEdit ? 'opacity-50' : ''}`} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black tracking-[0.2em] text-red-500 mb-2 uppercase">老師薪資發放 (鐘點) ($)</label>
                <input type="number" name="teacherPayout" disabled={formState.type === 'RENTAL' || !canEdit} readOnly={!canEdit} value={formState.teacherPayout} onChange={handleFormChange} className={`w-full bg-gray-50 border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-mono font-black text-sm text-red-500 disabled:opacity-30 ${!canEdit ? 'opacity-50' : ''}`} />
              </div>
              <div>
                <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2 uppercase">課程狀態</label>
                <select name="status" value={formState.status} onChange={handleFormChange} className="w-full bg-white border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-bold text-sm">
                  <option value="NORMAL">✅ 正常上課</option>
                  <option value="LEAVE">🔔 學生請假</option>
                  <option value="CANCELLED">❌ 課程取消</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238] mb-2">備註</label>
                <input name="remark" value={formState.remark} onChange={handleFormChange} className="w-full bg-white border-2 border-[#ece4d9] rounded-xl px-4 py-3 font-bold text-sm" placeholder="特殊備註或注意事項..." />
              </div>
            </div>
          </div>

          {!editingLessonId && (
            <div className="bg-[#4a4238]/5 p-5 rounded-3xl border-2 border-dashed border-[#4a4238]/10">
              <label className="block text-xs font-black tracking-widest text-[#4a4238] mb-4 uppercase">↻ 自動週期預約 (批次建立)</label>
              <div className="grid grid-cols-2 gap-4">
                <select name="recurringType" value={formState.recurringType} onChange={handleFormChange} className="bg-white border-none rounded-xl px-4 py-3 font-bold text-sm">
                  <option value="NONE">不重複 (單次)</option>
                  <option value="WEEK">每週固定</option>
                  <option value="TWO_WEEKS">每兩週固定</option>
                </select>
                {formState.recurringType !== 'NONE' && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-[#4a4238] shrink-0">共計</span>
                    <input type="number" name="recurringCount" value={formState.recurringCount} onChange={handleFormChange} className="w-20 bg-white border-none rounded-xl px-4 py-3 font-bold text-sm text-center" />
                    <span className="text-sm font-bold text-[#4a4238] shrink-0">次</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {canEdit && (
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className={`mt-4 font-bold tracking-[0.3em] py-5 px-6 rounded-full shadow-xl transition-all text-white flex items-center justify-center gap-2 ${formState.type === 'RENTAL' ? 'bg-[#c4a484] hover:bg-[#b09070]' : 'bg-[#4a4238] hover:bg-[#363028]'}`}
            >
              {isSubmitting ? '系統處理中...' : (editingLessonId ? '儲存並更新變更' : '確認並建立預約紀錄')}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
