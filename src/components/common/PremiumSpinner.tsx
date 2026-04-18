import React from 'react';

export default function PremiumSpinner({ label = "Loading Excellence..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 animate-fade-in p-12">
      <div className="relative w-16 h-16">
        {/* Outer Ring */}
        <div className="absolute inset-0 border-4 border-[#ece4d9] rounded-full"></div>
        {/* Spinning Gradient Ring */}
        <div className="absolute inset-0 border-4 border-t-[#c4a484] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
        {/* Inner Pulsing Circle */}
        <div className="absolute inset-4 bg-[#c4a484]/20 rounded-full animate-pulse"></div>
      </div>
      <p className="font-serif font-black text-[#4a4238]/60 tracking-[0.3em] uppercase text-[10px] ml-1">
        {label}
      </p>
    </div>
  );
}
