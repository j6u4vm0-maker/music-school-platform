"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, getUserProfile, onAuthStateChanged } from '@/lib/services/auth';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  profile: UserProfile | null;
  loading: boolean;
  hasPermission: (module: string, level: 'VIEW' | 'EDIT') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const isPublicPath = (path: string) => path === '/login' || path === '/schedule';

    const unsub = onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const p = await getUserProfile(firebaseUser.uid);
        setProfile(p);
        if (!p && !isPublicPath(pathname)) router.push('/login');
      } else {
        setProfile(null);
        if (!isPublicPath(pathname)) router.push('/login');
      }
      setLoading(false);
    });
    return () => unsub();
  }, [pathname, router]);

  const hasPermission = (
    module: string,
    level: 'VIEW' | 'EDIT',
  ): boolean => {
    if (!profile) return false;
    
    // 如果使用者資料中缺少該模組設定（例如剛新增的模組），則根據角色賦予預設
    const p = profile.permissions?.[module] || (profile.role === 'ADMIN' ? 'EDIT' : 'NONE');
    
    // 管理員在所有模組預設擁有最進階權限，除非被手動設為 NONE (一般不建議)
    if (profile.role === 'ADMIN' && p !== 'NONE') return true;

    // 特殊邏輯：對於『我的老師課表 (Portal)』，老師角色即便權限為 NONE，也應具備基本 VIEW 權限
    if (module === 'portal' && profile.role === 'TEACHER' && level === 'VIEW') return true;

    if (level === 'EDIT') return p === 'EDIT';
    if (level === 'VIEW') return p === 'VIEW' || p === 'EDIT';
    return false;
  };

  return (
    <AuthContext.Provider value={{ profile, loading, hasPermission }}>
      {(!loading || pathname === '/login') ? children : (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f7f2]">
          <div className="w-16 h-16 border-4 border-[#ece4d9] border-t-[#c4a484] rounded-full animate-spin mb-6"></div>
          <div className="font-serif text-2xl font-black text-[#4a4238] tracking-[0.2em] animate-pulse">
            驗證身份安全環境中...
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
