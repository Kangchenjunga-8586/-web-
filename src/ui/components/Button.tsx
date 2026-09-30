import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'tinted' | 'secondary' | 'destructive' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent font-semibold',
  tinted: 'bg-accent-soft text-accent-ink font-semibold',
  secondary: 'bg-surface-2 text-ink font-medium',
  destructive: 'bg-danger-soft text-danger font-semibold',
  ghost: 'bg-transparent text-accent-ink font-medium',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'lg';
  block?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  icon,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const sizing = size === 'lg' ? 'min-h-[54px] px-5 text-[17px] rounded-2xl' : 'min-h-[44px] px-4 text-[15px] rounded-xl';
  return (
    <button
      type={type}
      className={`pressable inline-flex items-center justify-center gap-2 disabled:opacity-40 ${sizing} ${VARIANTS[variant]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
