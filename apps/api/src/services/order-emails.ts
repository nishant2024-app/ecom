import { schema as s } from '@dairy/db';
import { and, asc, eq, lt } from 'drizzle-orm';
import type { AppDeps } from '../context';
import type { Email } from './email';
import { orderView } from './orders';

type View = Awaited<ReturnType<typeof orderView>>;
export type OrderEmailTemplate = 'order_confirmed' | 'order_shipped' | 'order_delivered' | 'order_cancelled';

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

interface Copy {
  subject: string;
  heading: string;
  lines: string[];
  button?: { label: string; url: string };
  showItems: boolean;
}

function copy(template: OrderEmailTemplate, o: View, webUrl: string): Copy {
  const orderUrl = `${webUrl}/orders/${o.id}`;
  const eta = `${o.delivery.etaMinDays}–${o.delivery.etaMaxDays} days`;
  switch (template) {
    case 'order_confirmed':
      return {
        subject: `Order ${o.number} confirmed`,
        heading: 'Thank you, your order is confirmed',
        lines: [
          `We have received your payment of ${rupees(o.total.amount)}.`,
          `We pack your order the next working day and hand it to the courier. Delivery usually takes ${eta} after dispatch.`,
          'You can cancel for a full refund until we pack it.',
        ],
        button: { label: 'View your order', url: orderUrl },
        showItems: true,
      };
    case 'order_shipped':
      return {
        subject: `Your order ${o.number} is on its way`,
        heading: 'Your order has shipped',
        lines: [
          `Courier: ${o.delivery.courier ?? 'our courier partner'}${o.delivery.trackingNumber ? `, tracking number ${o.delivery.trackingNumber}` : ''}.`,
          `It should reach you in ${eta}. Please keep your phone nearby: the delivery partner may call.`,
        ],
        button: { label: o.delivery.trackingUrl ? 'Track your parcel' : 'View your order', url: o.delivery.trackingUrl ?? orderUrl },
        showItems: true,
      };
    case 'order_delivered':
      return {
        subject: `Delivered: order ${o.number}`,
        heading: 'Your order was delivered',
        lines: [
          'We hope you enjoy it. Check the batch code on the pack at /verify if you like, and tell others what you think: your review helps other customers.',
          'Something wrong with your order? Reply to this email within 48 hours with a photo.',
        ],
        button: { label: 'Rate your products', url: orderUrl },
        showItems: true,
      };
    case 'order_cancelled': {
      // The refund is created right after the cancel is saved, so also trust the payment status.
      const refunded = o.refunds.length > 0 || ['success', 'refunded'].includes(o.payment?.status ?? '');
      const refundAmount = o.refunds.length ? o.refunds.reduce((n, r) => n + r.amount.amount, 0) : o.total.amount;
      return {
        subject: `Order ${o.number} cancelled`,
        heading: 'Your order was cancelled',
        lines: [
          o.cancelReason ? `Reason: ${o.cancelReason}.` : '',
          refunded ? `A refund of ${rupees(refundAmount)} has been started to your original payment method. Banks usually credit it in 5–7 working days.` : 'You were not charged for this order.',
        ].filter(Boolean),
        button: { label: 'View your order', url: orderUrl },
        showItems: false,
      };
    }
  }
}

/** Build the subject, HTML and plain-text body for an order email. */
export function renderOrderEmail(template: OrderEmailTemplate, o: View, brand: { name: string; supportEmail: string; supportPhone: string }, webUrl: string): Omit<Email, 'to'> {
  const c = copy(template, o, webUrl);
  const a = o.shippingAddress;
  const address = [a.name, [a.line1, a.line2, a.landmark].filter(Boolean).join(', '), `${a.city}, ${a.state} ${a.pincode}`].join('\n');

  const text = [
    c.heading,
    '',
    ...c.lines,
    ...(c.showItems
      ? [
          '',
          ...o.items.map((i) => `${i.quantity} × ${i.name} (${i.packSize})  ${rupees(i.total.amount)}`),
          '',
          `Subtotal ${rupees(o.subtotal.amount)}`,
          ...(o.discount.amount ? [`Discount -${rupees(o.discount.amount)}`] : []),
          `Shipping ${o.shipping.amount ? rupees(o.shipping.amount) : 'Free'}`,
          `Total ${rupees(o.total.amount)}`,
          '',
          'Delivering to:',
          address,
        ]
      : []),
    ...(c.button ? ['', `${c.button.label}: ${c.button.url}`] : []),
    '',
    `Order ${o.number}`,
    `Questions? ${brand.supportEmail}${brand.supportPhone ? ` or ${brand.supportPhone}` : ''}`,
    brand.name,
  ].join('\n');

  const rows = c.showItems
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:1px solid #e4e9e5;font-size:14px">
        ${o.items.map((i) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e4e9e5">${esc(i.name)} <span style="color:#56635b">${esc(i.packSize)} × ${i.quantity}</span></td><td align="right" style="padding:10px 0;border-bottom:1px solid #e4e9e5">${rupees(i.total.amount)}</td></tr>`).join('')}
        ${o.discount.amount ? `<tr><td style="padding:8px 0;color:#17803d">Discount</td><td align="right" style="padding:8px 0;color:#17803d">-${rupees(o.discount.amount)}</td></tr>` : ''}
        <tr><td style="padding:8px 0;color:#56635b">Shipping</td><td align="right" style="padding:8px 0">${o.shipping.amount ? rupees(o.shipping.amount) : 'Free'}</td></tr>
        <tr><td style="padding:8px 0;font-weight:700">Total (incl. GST)</td><td align="right" style="padding:8px 0;font-weight:700">${rupees(o.total.amount)}</td></tr>
      </table>
      <p style="margin:20px 0 4px;font-size:12px;color:#85918a;text-transform:uppercase;letter-spacing:.06em">Delivering to</p>
      <p style="margin:0;font-size:14px;line-height:1.5">${esc(address).replace(/\n/g, '<br>')}</p>`
    : '';

  const html = `<!doctype html><html><body style="margin:0;background:#f4f7f4;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#101a14">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
   <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden" cellpadding="0" cellspacing="0">
    <tr><td style="background:#17803d;padding:18px 24px;color:#ffffff;font-size:18px;font-weight:700">${esc(brand.name)}</td></tr>
    <tr><td style="padding:24px">
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25">${esc(c.heading)}</h1>
      ${c.lines.map((l) => `<p style="margin:0 0 10px;font-size:15px;line-height:1.55;color:#33423a">${esc(l)}</p>`).join('')}
      ${c.button ? `<p style="margin:20px 0"><a href="${esc(c.button.url)}" style="display:inline-block;background:#17803d;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:999px">${esc(c.button.label)}</a></p>` : ''}
      ${rows}
      <p style="margin:24px 0 0;font-size:12px;color:#85918a">Order ${esc(o.number)} · Questions? ${esc(brand.supportEmail)}${brand.supportPhone ? ` · ${esc(brand.supportPhone)}` : ''}</p>
    </td></tr>
   </table>
  </td></tr></table></body></html>`;

  return { subject: c.subject, html, text };
}

const MAX_ATTEMPTS = 5;

/**
 * Send queued order emails (called by the worker every minute). Each failure counts an attempt; after
 * five the message is marked failed and left for staff to see in the admin. Safe to run on several workers.
 */
export async function sendPendingEmails(deps: AppDeps, limit = 20): Promise<{ sent: number; failed: number }> {
  const { db } = deps.db;
  const provider = deps.email;
  if (!provider) return { sent: 0, failed: 0 };
  const pending = await db
    .select()
    .from(s.notifications)
    .where(and(eq(s.notifications.channel, 'email'), eq(s.notifications.status, 'pending'), lt(s.notifications.attempts, MAX_ATTEMPTS)))
    .orderBy(asc(s.notifications.createdAt))
    .limit(limit);
  let sent = 0;
  let failed = 0;
  for (const n of pending) {
    // Claim it: only one worker wins the attempt counter bump.
    const claimed = await db
      .update(s.notifications)
      .set({ attempts: n.attempts + 1 })
      .where(and(eq(s.notifications.id, n.id), eq(s.notifications.attempts, n.attempts), eq(s.notifications.status, 'pending')))
      .returning({ id: s.notifications.id });
    if (!claimed.length) continue;
    try {
      const orderId = (n.data as { orderId?: string }).orderId;
      const [customer] = await db.select().from(s.customers).where(eq(s.customers.id, n.customerId));
      if (!orderId || !customer) throw new Error('missing order or customer');
      const view = await orderView(db, orderId);
      const [seller] = await db.select().from(s.sellers).limit(1);
      const settings = await db.select().from(s.settings).where(eq(s.settings.sellerId, seller!.id));
      const setting = (k: string) => String(settings.find((x) => x.key === k)?.value ?? '');
      const mail = renderOrderEmail(
        n.template as OrderEmailTemplate,
        view,
        { name: seller!.name, supportEmail: setting('support.email'), supportPhone: setting('support.phone') },
        deps.config.PUBLIC_WEB_URL,
      );
      await provider.send({ to: customer.email, ...mail });
      await db.update(s.notifications).set({ status: 'sent', sentAt: new Date(), lastError: null }).where(eq(s.notifications.id, n.id));
      sent++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message.slice(0, 300) : 'error';
      await db
        .update(s.notifications)
        .set({ lastError: msg, ...(n.attempts + 1 >= MAX_ATTEMPTS ? { status: 'failed' } : {}) })
        .where(eq(s.notifications.id, n.id));
    }
  }
  return { sent, failed };
}
