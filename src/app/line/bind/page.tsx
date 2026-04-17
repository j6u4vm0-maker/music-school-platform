"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { bindLineAccount, createWelcomeFlex, sendLineMessage } from '@/lib/services/line';

function BindForm() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get('student_id');
  
  // 模擬狀態
  const [lineUid, setLineUid] = useState('U123456789demo'); // 預設一個 Demo UID
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState('家長');
  
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [msg, setMsg] = useState('');

  const handleBind = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      setStatus('ERROR');
      setMsg('請掃描正確的 QRCode (缺少 Student ID)');
      return;
    }

    setStatus('LOADING');
    try {
      const response = await fetch('/api/line/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          line_uid: lineUid,
          input_mobile: mobile,
          relationship: role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '綁定失敗');
      }

      setStatus('SUCCESS');
      setMsg(`學員 ${data.student_name} 綁定成功！歡迎訊息已發送至您的 LINE。`);
    } catch (err: any) {
      console.error(err);
      setStatus('ERROR');
      setMsg(err.message || '連線錯誤，請稍後再試。');
    }
  };

  if (status === 'SUCCESS') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-fade-in">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <span className="text-4xl">✅</span>
        </div>
        <h2 className="text-2xl font-bold text-[#4a4238] mb-4">綁定成功</h2>
        <p className="text-[#4a4238]/70">{msg}</p>
        <p className="mt-8 text-xs text-gray-400 font-mono">You can close this window now.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-8 pt-12">
      <div className="text-center mb-10">
        <div className="inline-block w-16 h-16 rounded-full border-2 border-[#4a4238] flex items-center justify-center font-serif text-xl font-bold text-[#4a4238] mb-4 mx-auto">7th</div>
        <h1 className="text-2xl font-black tracking-widest text-[#4a4238] uppercase">Line 綁定驗證</h1>
        <p className="text-sm text-[#c4a484] font-medium mt-2">Hepai Harmony 通知模組</p>
      </div>

      <div className="bg-white rounded-[32px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-[#ece4d9]/50">
        <form onSubmit={handleBind} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#4a4238]/40 mb-3 ml-1">身份標籤 (ROLE)</label>
            <select 
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-[#f8f7f2] border-2 border-transparent focus:border-[#c4a484] rounded-2xl px-6 py-4 outline-none transition-all font-bold text-[#4a4238]"
            >
              <option>媽媽</option>
              <option>爸爸</option>
              <option>學生本人</option>
              <option>家長</option>
              <option>其他</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#4a4238]/40 mb-3 ml-1">家長手機號碼 (MOBILE)</label>
            <input 
              type="tel" 
              placeholder="請輸入系統留存的手機號碼"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full bg-[#f8f7f2] border-2 border-transparent focus:border-[#c4a484] rounded-2xl px-6 py-4 outline-none transition-all font-bold text-[#4a4238] placeholder:text-[#4a4238]/20"
              required
            />
          </div>

          <div className="pt-4">
            <button 
              disabled={status === 'LOADING'}
              className="w-full bg-[#4a4238] text-white rounded-2xl py-5 font-black tracking-[0.2em] shadow-xl hover:shadow-2xl transition-all active:scale-95 disabled:opacity-50"
            >
              {status === 'LOADING' ? '處理中...' : '確認綁定系統'}
            </button>
          </div>

          {status === 'ERROR' && (
            <div className="bg-red-50 text-red-500 p-4 rounded-2xl text-xs font-bold border border-red-100 flex items-center gap-3">
              <span>⚠️</span> {msg}
            </div>
          )}
        </form>

        <div className="mt-8 pt-8 border-t border-[#ece4d9] text-center">
            <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">LINE UID (DEV MODE ONLY)</p>
            <input 
              type="text" 
              value={lineUid}
              onChange={e => setLineUid(e.target.value)}
              className="mt-2 text-[10px] bg-gray-50 border-none text-center w-full focus:ring-0 opacity-50"
            />
        </div>
      </div>
      
      <p className="mt-8 text-center text-[10px] text-gray-400 font-black tracking-widest uppercase">
        © Hepai Harmony OS
      </p>
    </div>
  );
}

export default function BindPage() {
  return (
    <main className="min-h-screen bg-[#f8f7f2]">
      <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
        <BindForm />
      </Suspense>
    </main>
  );
}
