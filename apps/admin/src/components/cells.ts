/**
 * Safe DOM builders for table cells. Cells are built from elements and textContent, never from HTML strings,
 * so a customer or product name can never inject markup.
 */
import { STATUS } from '../lib/format';

type Attrs = { class?: string; text?: string; title?: string; href?: string; type?: string; ariaLabel?: string; onClick?: (e: MouseEvent) => void; data?: Record<string, string> };

export function el(tag: string, attrs: Attrs = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElement {
  const node = document.createElement(tag);
  if (attrs.class) node.className = attrs.class;
  if (attrs.text !== undefined) node.textContent = attrs.text;
  if (attrs.title) node.title = attrs.title;
  if (attrs.href) (node as HTMLAnchorElement).href = attrs.href;
  if (attrs.type) (node as HTMLButtonElement).type = attrs.type as 'button';
  if (attrs.ariaLabel) node.setAttribute('aria-label', attrs.ariaLabel);
  if (attrs.onClick) node.addEventListener('click', attrs.onClick);
  for (const [k, v] of Object.entries(attrs.data ?? {})) node.dataset[k] = v;
  for (const c of children) if (c) node.append(c);
  return node;
}

/** Two lines in one cell: the main value and a smaller, muted one under it. */
export const twoLine = (main: string, sub?: string | null, mainClass = '') => el('div', {}, el('span', { class: mainClass, text: main }), sub ? el('span', { class: 'dt-sub', text: sub }) : null);

export const pill = (text: string, tone: 'on' | 'off' | 'warn' | 'alert' = 'off') => el('span', { class: `dt-pill dt-pill-${tone}`, text });

export function button(label: string, onClick: (e: MouseEvent) => void, opts: { ariaLabel?: string; disabled?: boolean; danger?: boolean; title?: string } = {}) {
  const b = el('button', { type: 'button', class: `dt-btn${opts.danger ? ' dt-btn-danger' : ''}`, text: label, ariaLabel: opts.ariaLabel ?? label, title: opts.title, onClick });
  if (opts.disabled) (b as HTMLButtonElement).disabled = true;
  return b;
}

/** The "⋯" button that opens a menu (the page renders the menu itself). */
export function menuButton(label: string, onOpen: (anchor: HTMLElement) => void) {
  const b = el('button', { type: 'button', class: 'dt-btn dt-menu-btn', ariaLabel: label, onClick: (e) => onOpen(e.currentTarget as HTMLElement) });
  b.setAttribute('aria-haspopup', 'menu');
  b.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
  return b;
}

const STATUS_TONE: Record<string, 'on' | 'off' | 'warn' | 'strong'> = {
  pending_payment: 'off',
  confirmed: 'warn',
  packed: 'warn',
  shipped: 'on',
  delivered: 'strong',
  cancelled: 'off',
  refunded: 'off',
};
/** The coloured order-status badge, same labels and tones as StatusBadge. */
export const statusPill = (status: string) => el('span', { class: `dt-pill dt-pill-${STATUS_TONE[status] ?? 'off'}`, text: STATUS[status] ?? status });
