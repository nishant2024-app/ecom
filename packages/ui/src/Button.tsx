import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'solid' | 'outline' | 'ghost';
type Size = 'md' | 'lg' | 'sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  // One primary action per view: marigold fill with ink text.
  primary: 'bg-signal text-on-signal hover:brightness-95 active:brightness-90',
  solid: 'bg-ink text-paper hover:opacity-90',
  outline: 'border border-ink text-ink hover:bg-paper-2',
  ghost: 'text-ink underline-offset-4 hover:underline',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-12 px-5 text-base',
  lg: 'h-14 px-6 text-lg',
};

export function Button({ variant = 'solid', size = 'md', className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-1 font-medium transition-[filter,opacity,background-color] duration-[var(--dur-1)] ease-std disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
}
