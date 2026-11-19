import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertCircle, CheckCircle2, Info } from 'lucide-react';

export const SurfaceCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}> = ({ children, className = '', padding = 'md' }) => {
  const padMap = {
    none: '',
    sm: 'p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-7',
  };
  return (
    <div
      className={`rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_1px_3px_rgba(15,39,68,0.04)] dark:shadow-none transition-colors ${padMap[padding]} ${className}`}
    >
      {children}
    </div>
  );
};

export const PageHeader: React.FC<{
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, subtitle, actions }) => (
  <div className="flex flex-wrap items-center justify-between gap-4">
    <div className="min-w-0">
      <h1 className="font-display text-2xl font-bold tracking-tight text-[#0F2744] dark:text-white">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      )}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
  </div>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'emerald' | 'gold' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  type = 'button',
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0068C9]/40';
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-xs',
    lg: 'px-5 py-2.5 text-sm',
  };
  const variants = {
    primary:
      'bg-[#082F5E] text-white hover:bg-[#0F2744] dark:bg-[#0068C9] dark:hover:bg-[#1E40AF]',
    secondary:
      'bg-[#0068C9] text-white hover:bg-[#0356A8] dark:bg-blue-600 dark:hover:bg-blue-500',
    outline:
      'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800',
    ghost:
      'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
    emerald:
      'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500',
    gold:
      'bg-[#E89E0E] text-white hover:bg-[#D97706] shadow-xs',
    danger:
      'bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500',
  };

  return (
    <button
      type={type}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const inputBaseClass =
  'w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#1E40AF] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/15 transition-colors';

export const AlertBanner: React.FC<{
  type?: 'error' | 'success' | 'info' | 'warning';
  children: React.ReactNode;
}> = ({ type = 'info', children }) => {
  const styles = {
    error:
      'border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300',
    success:
      'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300',
    warning:
      'border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300',
    info:
      'border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300',
  };
  const Icon = type === 'success' ? CheckCircle2 : type === 'info' ? Info : AlertCircle;
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium ${styles[type]}`}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
};

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900 p-1 text-xs font-semibold">
      {tabs.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              active
                ? 'bg-white dark:bg-slate-800 text-[#0F2744] dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export const AnimatedNumber: React.FC<{ value: number; formatter?: (n: number) => string }> = ({
  value,
  formatter,
}) => {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const start = display;
    const diff = value - start;
    if (diff === 0) return;
    const duration = 350;
    const startTime = performance.now();
    let raf = 0;

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      } else {
        setDisplay(value);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{formatter ? formatter(display) : display.toLocaleString('fr-FR')}</>;
};

export const ModalDialog: React.FC<{
  open?: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  maxWidth?: string;
  children: React.ReactNode;
}> = ({ open = true, onClose, title, subtitle, maxWidth = 'max-w-2xl', children }) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-[2px] p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={`relative my-8 w-full ${maxWidth} rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl`}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            {(title || subtitle) && (
              <div className="mb-5 border-b border-slate-100 dark:border-slate-800 pb-4 pr-8">
                {title && (
                  <h2 className="font-display text-lg font-bold text-[#0F2744] dark:text-white">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
                )}
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 5,
}) => (
  <div className="divide-y divide-slate-100 dark:divide-slate-800">
    {Array.from({ length: rows }).map((_, rIdx) => (
      <div key={rIdx} className="flex items-center gap-4 px-4 py-3.5">
        {Array.from({ length: cols }).map((__, cIdx) => (
          <div
            key={cIdx}
            className="h-3.5 flex-1 animate-pulse rounded bg-slate-100 dark:bg-slate-800"
          />
        ))}
      </div>
    ))}
  </div>
);
