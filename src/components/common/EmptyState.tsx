import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: string;
}

export default function EmptyState({ title, description, icon = "🔍" }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-slide-up bg-white/30 backdrop-blur-sm rounded-[40px] border-2 border-dashed border-[#ece4d9] m-4">
      <div className="text-5xl mb-6 opacity-80 filter drop-shadow-lg">{icon}</div>
      <h3 className="font-serif text-2xl font-black text-[#4a4238] tracking-widest mb-2">
        {title}
      </h3>
      <p className="text-[#4a4238]/50 max-w-sm font-bold leading-relaxed tracking-wider">
        {description}
      </p>
    </div>
  );
}
