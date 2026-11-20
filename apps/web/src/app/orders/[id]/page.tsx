import { Suspense } from 'react';
import { OrderView } from '@/components/OrderView';

export const metadata = { title: 'Your order' };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense>
      <OrderView id={(await params).id} />
    </Suspense>
  );
}
