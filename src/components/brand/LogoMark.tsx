import React, { useId } from 'react';
import { cn } from '@/lib/utils';

interface LogoMarkProps {
  className?: string;
}

/** SnapMark brand mark: an "S" drawn as a single marker stroke. Keep in sync with src/app/icon.svg. */
export function LogoMark({ className }: LogoMarkProps) {
  const id = useId();
  const bgId = `snapmark-bg-${id}`;
  const inkId = `snapmark-ink-${id}`;

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id={bgId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1E1B4B" />
          <stop offset="1" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id={inkId} x1="18" y1="14" x2="46" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#818CF8" />
          <stop offset="0.55" stopColor="#A78BFA" />
          <stop offset="1" stopColor="#F472B6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${bgId})`} />
      <path
        d="M43 19.5C39.5 15.5 33.5 14.5 28.5 15.5C22.5 16.8 19.8 21.5 21.2 25.8C23.2 31.8 32 31.6 38 33.6C44.5 35.8 45.6 41.7 42.3 45.6C38.4 50.2 28.5 50.5 21 45.5"
        stroke={`url(#${inkId})`}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle cx="47.5" cy="16" r="3" fill="#FBBF24" />
    </svg>
  );
}
