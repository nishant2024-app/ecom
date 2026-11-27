import { newId, type OrderAction } from '@dairy/core';
import { schema as s, type DbOrTx } from '@dairy/db';
import { eq } from 'drizzle-orm';

/** Which order changes email the customer, and with which template. */
export const ORDER_EMAIL_TEMPLATES: Partial<Record<OrderAction, 'order_confirmed' | 'order_shipped' | 'order_delivered' | 'order_cancelled'>> = {
  pay: 'order_confirmed',
  ship: 'order_shipped',
  deliver: 'order_delivered',
  cancel: 'order_cancelled',
};

/**
 * Queue an order email in the SAME transaction as the order change, so an email exists if and only if the
 * change was saved. The worker sends it (and retries). One email per order and action: re-running is harmless.
 * Skipped when the customer turned off order updates.
 */
export async function enqueueOrderEmail(tx: DbOrTx, order: { id: string; customerId: string; number: string }, action: OrderAction) {
  const template = ORDER_EMAIL_TEMPLATES[action];
  if (!template) return;
  const [customer] = await tx.select({ prefs: s.customers.notificationPrefs }).from(s.customers).where(eq(s.customers.id, order.customerId));
  if (!customer || customer.prefs.orderUpdates === false) return;
  await tx
    .insert(s.notifications)
    .values({
      id: newId('ntf'),
      customerId: order.customerId,
      channel: 'email',
      template,
      title: order.number,
      link: `/orders/${order.id}`,
      data: { orderId: order.id },
      dedupeKey: `order:${order.id}:${action}`,
    })
    .onConflictDoNothing({ target: s.notifications.dedupeKey });
}
