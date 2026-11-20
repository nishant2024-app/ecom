import { DeleteAccount } from '@/components/DeleteAccount';

export const metadata = { title: 'Delete your account' };

/** Public page (Google Play requires a web URL for account deletion). */
export default function DeletePage() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-16 md:px-6">
      <h1 className="font-display text-2xl">Delete your account</h1>
      <div className="mt-4 space-y-3 text-lg text-ink-2">
        <p>When you delete your account we cancel your subscriptions immediately and sign you out everywhere.</p>
        <p>Any wallet balance is refunded to your original payment method. Your name, phone, email and addresses are erased after 30 days. Signing in again before then cancels the deletion.</p>
        <p>Invoices are kept for as long as Indian tax law requires, without your personal details.</p>
      </div>
      <DeleteAccount />
    </div>
  );
}
