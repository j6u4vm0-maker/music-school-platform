"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { logout } from '@/lib/services/auth';
import { modules, Module } from '@/lib/constants/modules';
import { usePinnedModules } from '@/hooks/usePinnedModules';

interface NavbarProps {
  pageTitle?: string;
  children?: React.ReactNode;
}

export default function Navbar({ pageTitle, children }: NavbarProps) {
  const { profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { pinnedHrefs, isLoaded } = usePinnedModules();
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const pinnedModules = modules.filter(m => pinnedHrefs.includes(m.href));
  const isHomePage = pathname === '/';

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [pinnedModules, isLoaded]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 pt-6 z-50">
      <nav className="glass-nav px-6 py-4 flex justify-between items-center relative gap-4">
        
        {/* Left Section: Logo & Page Title / Return */}
        <div className="flex items-center gap-4 flex-shrink-0 min-w-[200px]">
          {isHomePage ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-[#4a4238] flex items-center justify-center font-serif text-lg font-bold text-[#4a4238]">7th</div>
              <div>
                <h1 className="font-serif font-bold text-sm tracking-widest text-[#4a4238] leading-tight">第七樂章</h1>
                <p className="text-[#c4a484] text-[9px] tracking-[0.2em] font-bold uppercase">智能營運管理系統</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-3 cursor-pointer hover:-translate-y-0.5 transition-transform group">
                <div className="w-10 h-10 rounded-full border-2 border-[#4a4238] flex items-center justify-center font-serif text-lg font-bold text-[#4a4238] group-hover:bg-[#4a4238] group-hover:text-white transition-colors">7</div>
                <span className="font-serif font-black text-sm tracking-[0.1em] text-[#4a4238]">返回首頁</span>
              </Link>
              <div className="h-6 w-[1px] bg-[#ece4d9]"></div>
              {pageTitle && (
                <h2 className="font-serif font-black text-lg tracking-[0.1em] text-[#c4a484] whitespace-nowrap">{pageTitle}</h2>
              )}
            </div>
          )}
        </div>

        {/* Middle Section: Carousel Navbar */}
        <div className="hidden md:flex flex-1 items-center justify-center relative overflow-hidden max-w-[50%] lg:max-w-[60%]">
          {pinnedModules.length > 0 ? (
            <div className="flex items-center w-full px-8 relative">
              {showLeftArrow && (
                <button 
                  onClick={() => scroll('left')} 
                  className="absolute left-0 z-10 p-1 bg-white/80 rounded-full shadow-sm text-[#4a4238] hover:bg-white transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
              )}
              
              <div 
                ref={scrollRef}
                onScroll={checkScroll}
                className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {pinnedModules.map(m => (
                  <Link
                    key={m.href}
                    href={m.href}
                    className={`px-4 py-2 rounded-full text-xs font-black tracking-widest whitespace-nowrap transition-all border
                      ${pathname === m.href 
                        ? 'bg-[#4a4238] text-white border-[#4a4238]' 
                        : 'bg-[#ece4d9]/30 text-[#4a4238] border-transparent hover:bg-white hover:border-[#ece4d9] hover:shadow-sm'
                      }`}
                  >
                    {m.title}
                  </Link>
                ))}
              </div>

              {showRightArrow && (
                <button 
                  onClick={() => scroll('right')} 
                  className="absolute right-0 z-10 p-1 bg-white/80 rounded-full shadow-sm text-[#4a4238] hover:bg-white transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </button>
              )}
            </div>
          ) : (
            isHomePage && (
              <p className="text-[10px] font-bold text-[#4a4238]/30 tracking-widest uppercase">
                點擊下方模組旁的星號，可固定常用功能
              </p>
            )
          )}
        </div>

        {/* Right Section: Auth Action + Children */}
        <div className="flex-shrink-0 min-w-[120px] flex items-center justify-end gap-3">
          {children}
          {profile ? (
            <button
              onClick={async () => { await logout(); router.push('/login'); }}
              className="bg-[#ece4d9] hover:bg-[#c4a484] text-[#4a4238] cursor-pointer hover:text-white px-5 py-2 rounded-full text-[10px] font-black tracking-widest transition-all duration-300 shadow-sm"
            >
              系統登出 →
            </button>
          ) : (
            <Link
              href="/login"
              className="bg-[#4a4238] hover:bg-[#c4a484] text-white px-5 py-2 rounded-full text-[10px] font-black tracking-widest transition-all duration-300 shadow-md"
            >
              系統登入 →
            </Link>
          )}
        </div>
      </nav>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
