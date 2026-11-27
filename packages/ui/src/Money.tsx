import { formatINR } from '@dairy/core';
import { cn } from './cn';

export interface MoneyProps {
  paise: number;
  className?: string;
  /** Show a leading + for credits. */
  signed?: boolean;
}

/** Money in Indian format with tabular figures: ₹1,00,000 · ₹64.50 */
export function Money({ paise, className, signed }: MoneyProps) {
  const text = formatINR(Math.abs(paise));
  const sign = paise < 0 ? '−' : signed && paise > 0 ? '+' : '';
  return (
    <span className={cn('num whitespace-nowrap', className)}>
      {sign}
      {text}
    </span>
  );
}
