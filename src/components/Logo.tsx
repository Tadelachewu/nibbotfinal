
'use client';

import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <svg 
        viewBox="0 0 200 200" 
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
      >
        {/* Background Circle */}
        <circle cx="100" cy="100" r="100" fill="#f4a61b" />
        
        {/* Top Brown Section */}
        <path 
          d="M 0,100 C 0,44.77 44.77,0 100,0 C 155.23,0 200,44.77 200,100 C 200,100 170,100 150,70 C 130,40 100,130 70,70 C 50,30 0,100 0,100 Z" 
          fill="#763717" 
        />
        
        {/* White Wave Divider */}
        <path 
          d="M 0,100 C 0,100 50,30 70,70 C 100,130 130,40 150,70 C 170,100 200,100 200,100" 
          stroke="white" 
          strokeWidth="10" 
          fill="none" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
