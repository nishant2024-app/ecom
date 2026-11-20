import { AnimatePresence, motion } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { STATUS } from '../lib/format';

export function Page({ title, subtitle, actions, children }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="p-6">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-[-0.03em]">{title}</h1>
          {subtitle && <p className="mt-1 text-ink-2">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </motion.div>
  );
}

export function Card({ title, action, children, className = '' }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-4 border border-rule bg-paper p-4 shadow-card ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h2 className="text-xs uppercase tracking-[0.12em] text-ink-2">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const tone: Record<string, string> = {
  pending_payment: 'bg-paper-3 text-ink-2',
  confirmed: 'bg-[#fdecc8] text-[#7a4b00] font-semibold', // to pack: needs action
  packed: 'bg-[#fdecc8] text-[#7a4b00]', // to ship: needs action
  shipped: 'bg-meadow text-forest',
  delivered: 'bg-forest text-on-forest',
  cancelled: 'bg-paper-3 text-ink-3',
  refunded: 'bg-paper-3 text-ink-3',
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex whitespace-nowrap rounded-pill px-2.5 py-0.5 text-xs ${tone[status] ?? 'bg-paper-2'}`}>{STATUS[status] ?? status}</span>;
}

export function Btn({ variant = 'solid', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'solid' | 'primary' | 'outline' | 'danger' | 'ghost' }) {
  const v = {
    solid: 'bg-ink text-paper hover:bg-ink/85',
    primary: 'bg-forest text-on-forest hover:bg-forest-2',
    outline: 'border border-rule hover:bg-paper-2',
    danger: 'border border-alert text-alert hover:bg-alert hover:text-paper',
    ghost: 'hover:bg-paper-2',
  }[variant];
  return <button type="button" {...p} className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-pill px-4 text-sm transition-colors disabled:opacity-50 ${v} ${className}`} />;
}

export const input = 'h-9 w-full rounded-2 border border-rule bg-paper px-3 text-sm focus:border-forest';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-ink-2">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export function Drawer({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40">
          <motion.div className="absolute inset-0 bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className={`absolute right-0 top-0 flex h-full w-full flex-col bg-paper shadow-float ${wide ? 'max-w-3xl' : 'max-w-xl'}`}
          >
            <div className="flex items-center justify-between px-5 py-3 rule-b">
              <h2 className="text-xl font-bold">{title}</h2>
              <Btn variant="ghost" onClick={onClose} aria-label="Close">
                ✕
              </Btn>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-4 border border-dashed border-rule p-8 text-center text-ink-2">{children}</p>;
}

export const th = 'px-3 py-2 text-left text-xs font-normal uppercase tracking-[0.08em] text-ink-2';
export const td = 'px-3 py-2.5';
