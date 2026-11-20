import { MockPay } from '@/components/MockPay';

export const metadata = { title: 'Test payment' };

export default async function MockPayPage({ params }: { params: Promise<{ paymentId: string }> }) {
  return <MockPay paymentId={(await params).paymentId} />;
}
