import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { STATUS } from '../lib/format';

export function Page({ title, subtitle, actions, children }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="p-4 md:p-6">
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
          <motion.div
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export interface MenuAction {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
}

/** A "⋯" button that opens a small list of actions. Closes on outside click or Escape; arrow keys move between items. */
export function RowMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        root.current?.querySelector<HTMLButtonElement>('[aria-haspopup]')?.focus();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = [...(root.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not(:disabled)') ?? [])];
        const at = items.indexOf(document.activeElement as HTMLButtonElement);
        items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      }
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    root.current?.querySelector<HTMLButtonElement>('[role=menuitem]:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  return (
    <div ref={root} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="grid h-9 w-9 place-items-center rounded-pill border border-rule hover:bg-paper-2"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <div id={id} role="menu" aria-label={label} className="absolute right-0 top-full z-20 mt-1 min-w-[210px] rounded-3 border border-rule bg-paper p-1 shadow-float">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              disabled={a.disabled}
              title={a.hint}
              onClick={() => {
                setOpen(false);
                a.onSelect();
              }}
              className={`flex min-h-[40px] w-full items-center rounded-2 px-3 text-left text-sm hover:bg-paper-2 disabled:opacity-50 ${a.danger ? 'text-alert' : ''}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The same action list as RowMenu, but anchored to any element (such as a button inside a table cell). */
export function FloatingMenu({ anchor, label, actions, onClose }: { anchor: HTMLElement; label: string; actions: MenuAction[]; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  useEffect(() => {
    const r = anchor.getBoundingClientRect();
    const height = actions.length * 40 + 12;
    const below = r.bottom + 4 + height < window.innerHeight;
    setPos({ top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - height), right: Math.max(8, window.innerWidth - r.right) });
  }, [anchor, actions.length]);
  useEffect(() => {
    root.current?.querySelector<HTMLButtonElement>('[role=menuitem]:not(:disabled)')?.focus();
    const away = (e: MouseEvent) => !root.current?.contains(e.target as Node) && e.target !== anchor && !anchor.contains(e.target as Node) && onClose();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Tab') {
        onClose();
        if (e.key === 'Escape') anchor.focus();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = [...(root.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not(:disabled)') ?? [])];
        const at = items.indexOf(document.activeElement as HTMLButtonElement);
        items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      }
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [anchor, onClose]);
  return (
    <div
      ref={root}
      role="menu"
      aria-label={label}
      style={pos ? { position: 'fixed', top: pos.top, right: pos.right } : { position: 'fixed', visibility: 'hidden' }}
      className="z-[55] min-w-[210px] rounded-3 border border-rule bg-paper p-1 shadow-float"
    >
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          role="menuitem"
          disabled={a.disabled}
          title={a.hint}
          onClick={() => {
            onClose();
            a.onSelect();
          }}
          className={`flex min-h-[40px] w-full items-center rounded-2 px-3 text-left text-sm hover:bg-paper-2 disabled:opacity-50 ${a.danger ? 'text-alert' : ''}`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

/** A small "are you sure?" dialog for actions that cannot be undone. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onCancel} aria-hidden />
      <div role="alertdialog" aria-modal="true" aria-label={title} className="relative w-full max-w-md rounded-4 bg-paper p-5 shadow-float">
        <h2 className="text-xl font-bold">{title}</h2>
        <div className="mt-2 text-ink-2">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="inline-flex h-9 items-center rounded-pill border border-rule px-4 text-sm hover:bg-paper-2">
            Cancel
          </button>
          <Btn variant={danger ? 'danger' : 'primary'} disabled={busy} onClick={onConfirm}>
            {busy ? 'Working…' : confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/** Asks for a short written reason (for example why an order is cancelled). Replaces the browser's prompt box. */
export function ReasonDialog({
  open,
  title,
  description,
  label,
  suggestions = [],
  minLength = 3,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  label: string;
  suggestions?: string[];
  minLength?: number;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    setReason('');
    setTouched(false);
    box.current?.focus();
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, onCancel]);
  if (!open) return null;
  const clean = reason.trim();
  const tooShort = clean.length < minLength;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onCancel} aria-hidden />
      <form
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className="relative w-full max-w-md rounded-4 bg-paper p-5 shadow-float"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (!tooShort) onConfirm(clean);
        }}
      >
        <h2 id={`${id}-title`} className="text-xl font-bold">
          {title}
        </h2>
        {description && <div className="mt-2 text-ink-2">{description}</div>}
        {suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Common reasons">
            {suggestions.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => setReason(sug)}
                className={`rounded-pill border px-3 py-1 text-sm ${clean === sug ? 'border-forest bg-meadow text-forest' : 'border-rule hover:bg-paper-2'}`}
              >
                {sug}
              </button>
            ))}
          </div>
        )}
        <label htmlFor={`${id}-reason`} className="mt-4 block text-sm text-ink-2">
          {label}
        </label>
        <textarea
          id={`${id}-reason`}
          ref={box}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={200}
          aria-invalid={touched && tooShort}
          aria-describedby={touched && tooShort ? `${id}-err` : undefined}
          className="mt-1 w-full rounded-2 border border-rule bg-paper px-3 py-2 text-sm focus:border-forest"
        />
        {touched && tooShort && (
          <p id={`${id}-err`} role="alert" className="mt-1 text-sm text-alert">
            Please write at least {minLength} characters.
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="inline-flex h-9 items-center rounded-pill border border-rule px-4 text-sm hover:bg-paper-2">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className={`inline-flex h-9 items-center rounded-pill px-4 text-sm transition-colors disabled:opacity-50 ${danger ? 'border border-alert text-alert hover:bg-alert hover:text-paper' : 'bg-forest text-on-forest hover:bg-forest-2'}`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-4 border border-dashed border-rule p-8 text-center text-ink-2">{children}</p>;
}

export const th = 'px-3 py-2 text-left text-xs font-normal uppercase tracking-[0.08em] text-ink-2';
export const td = 'px-3 py-2.5';
