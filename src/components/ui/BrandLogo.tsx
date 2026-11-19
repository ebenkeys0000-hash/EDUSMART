import React from 'react';
import { EDUSMART_LOGO_URL } from '../../lib/subscriptionCatalog.ts';

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  framed?: boolean;
  className?: string;
}

/**
 * Renders the exact official EduSmart logo while preserving its 3:2 landscape
 * aspect ratio (1536 x 1024) without stretching, cropping, or modifying the emblem.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  framed = true,
  className = '',
}) => {
  const sizeClasses: Record<NonNullable<BrandLogoProps['size']>, string> = {
    xs: 'h-7 w-[42px]',
    sm: 'h-9 w-[54px]',
    md: 'h-11 w-[66px]',
    lg: 'h-14 w-[84px]',
    xl: 'h-20 w-[120px]',
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden transition-transform duration-150 ${
        framed
          ? 'rounded-xl bg-white px-1.5 py-1 border border-slate-200/80 shadow-xs'
          : ''
      } ${className}`}
    >
      <img
        src={EDUSMART_LOGO_URL}
        alt="EduSmart — Apprendre • Progresser • Réussir"
        className={`${sizeClasses[size]} aspect-[3/2] object-contain select-none`}
        draggable={false}
      />
    </span>
  );
};
