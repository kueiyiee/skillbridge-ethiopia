import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  onDark?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ 
  className = '', 
  size = 'md',
  showSubtitle = false,
  onDark = false
}) => {
  const iconDimensions = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11'
  }[size];

  const titleSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  }[size];

  return (
    <div className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}>
      <div
        className={`relative flex shrink-0 items-center justify-center ${iconDimensions} overflow-hidden rounded-xl border border-white/20 shadow-sm`}
        style={{ background: 'linear-gradient(145deg, var(--color-brand-icon-start), var(--color-brand-icon-end))' }}
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-[82%] w-[82%]"
          aria-hidden="true"
        >
          <path d="M7 23.5 13 17l4 3.5L25 11" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m20.5 11 4.5-.5-.5 4.5" stroke="#99F6E4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 27h18" stroke="white" strokeOpacity=".76" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="7" cy="23.5" r="2" fill="#99F6E4" stroke="white" strokeWidth="1.2" />
          <circle cx="13" cy="17" r="2" fill="var(--color-brand-node)" stroke="white" strokeWidth="1.2" />
          <circle cx="17" cy="20.5" r="2" fill="#99F6E4" stroke="white" strokeWidth="1.2" />
        </svg>
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="flex items-center tracking-[-0.045em]">
          <span className={`whitespace-nowrap font-extrabold ${titleSizes} ${onDark ? 'text-white' : 'text-slate-900 dark:text-white'} font-heading leading-none`}>
            <span>SKILL</span><span style={{ color: 'var(--color-brand-blue)' }}>BRIDGE</span>
          </span>
          <span
            className="ml-1.5 inline-flex h-[18px] items-center rounded px-1.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-white"
            style={{ backgroundColor: 'var(--color-brand-teal)' }}
          >
            ET
          </span>
        </div>
        {showSubtitle && (
          <span className="mt-1 max-w-64 text-[10px] font-medium leading-4 tracking-[0.01em] text-slate-600 dark:text-slate-300">
            Skills that open new opportunities
          </span>
        )}
      </div>
    </div>
  );
};
