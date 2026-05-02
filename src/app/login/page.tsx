"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { login, loginWithGoogle, initializeAdmin } from '@/lib/services/auth';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      await login(email.trim(), password);
      router.push('/');
    } catch (err: any) {
      const code = err.code || '';
      if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
        setError('帳號或密碼錯誤，請確認後重試。');
      } else {
        setError(err.message || '登入失敗，請稍後再試。');
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      await loginWithGoogle();
      router.push('/');
    } catch (err: any) {
      setError('Google 登入失敗: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitialize = async () => {
    if (!window.confirm("確定要初始化或修復管理員權限嗎？")) return;
    setIsLoading(true);
    try {
      const res = await initializeAdmin();
      alert(`✅ ${res.message}！\n請使用 admin@7th.com / admin777 登入。`);
    } catch (err: any) {
      alert("⚠️ 操作失敗: " + err.message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center relative overflow-hidden bg-cover bg-center" style={{ backgroundImage: "url('https://www.workband.com.tw/store_image/7thmov/A174459629727.webp')" }}>
      {/* Darker overlay to improve readability if needed, but the image is light, so maybe a subtle light overlay */}
      <div className="absolute inset-0 bg-white/20"></div>

      
      <div className="w-full max-w-md px-6 z-10 animate-in fade-in zoom-in duration-700">
        <div className="bg-white/70 backdrop-blur-xl border-2 border-white rounded-[40px] shadow-[0_20px_50px_rgba(74,66,56,0.1)] p-10 md:p-14 text-center">
          
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 rounded-full border-[3px] border-[#4a4238] flex items-center justify-center font-serif text-3xl font-black text-[#4a4238] mb-6 shadow-sm">
              7th
            </div>
            <h1 className="font-serif font-black text-3xl tracking-[0.2em] text-[#4a4238] mb-2">第七樂章</h1>
            <p className="font-sans font-bold text-[#c4a484] tracking-[0.3em] text-xs uppercase opacity-80">藝術學院管理系統</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-6 text-left">
            <div>
              <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238]/60 mb-3 ml-2 uppercase">電子郵箱帳號 (EMAIL)</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/50 border-2 border-[#ece4d9] rounded-2xl px-6 py-4 font-bold text-[#4a4238] focus:outline-none focus:border-[#4a4238] transition-all"
                placeholder="example@7th-art.com"
              />
            </div>
            
            <div>
              <label className="block text-[11px] font-black tracking-[0.2em] text-[#4a4238]/60 mb-3 ml-2 uppercase">安全授權密碼 (PASSWORD)</label>
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/50 border-2 border-[#ece4d9] rounded-2xl px-6 py-4 font-bold text-[#4a4238] focus:outline-none focus:border-[#4a4238] transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs font-bold text-center animate-bounce">{error}</p>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="mt-6 bg-[#4a4238] hover:bg-[#c4a484] text-white font-black tracking-[0.4em] py-5 px-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 disabled:bg-gray-400 hover:-translate-y-1 active:translate-y-0"
            >
              {isLoading ? '驗證授權中...' : '確認登入系統'}
            </button>

            <div className="flex items-center gap-4 mt-2">
              <div className="flex-1 h-[1px] bg-[#ece4d9]"></div>
              <span className="text-[10px] font-black text-[#4a4238]/20 tracking-widest uppercase">或者使用</span>
              <div className="flex-1 h-[1px] bg-[#ece4d9]"></div>
            </div>

            <button 
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="flex items-center justify-center gap-4 bg-white hover:bg-gray-50 text-[#4a4238] font-bold tracking-widest py-4 px-6 rounded-2xl border-2 border-[#ece4d9] transition-all hover:shadow-md"
            >
              <svg className="w-5 h-5" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              使用 Google 帳號登入
            </button>
          </form>

          <button 
            onClick={handleInitialize}
            className="mt-8 text-[10px] text-[#4a4238]/10 hover:text-[#4a4238]/40 font-bold tracking-widest uppercase transition-colors"
          >
            [ 初始化或修復系統管理員權限 ]
          </button>

          {/* Visitor Area Removed */}
          <p className="mt-10 text-[10px] font-bold text-[#4a4238]/30 tracking-widest leading-loose">
            PROPRIETARY MANAGEMENT SYSTEM <br/> 
            © 2026 THE 7TH MOVEMENT ART CENTER
          </p>
        </div>
      </div>
    </main>
  );
}
