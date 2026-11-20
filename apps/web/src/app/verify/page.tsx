import { VerifyForm } from '@/components/VerifyForm';

export const metadata = {
  title: 'Verify your pack',
  description: 'Enter the batch code printed on your Mulshi Dairy pack to check it is genuine and see when it was made and when it is best before.',
  alternates: { canonical: '/verify' },
};

export default function VerifyPage() {
  return (
    <div className="mx-auto max-w-[720px] px-4 pb-10 pt-8 md:px-6">
      <p className="text-[13px] font-semibold text-forest">Authenticity check</p>
      <h1 className="mt-1 text-[30px] font-extrabold tracking-[-0.03em] md:text-[38px]">Verify your pack</h1>
      <p className="mt-2 text-[16px] text-ink-2">
        Every jar, tin and box we ship has a batch code printed near the expiry date. Enter it to confirm the pack is genuine and see when it was made.
      </p>
      <VerifyForm />
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          ['Find the code', 'Printed on the label or lid, next to "Batch" or "B.No."'],
          ['Enter it here', 'Letters and numbers, for example GH-A2-500-B'],
          ['Not found?', 'Send us a photo of the label from the Contact page'],
        ].map(([t, d]) => (
          <div key={t} className="rounded-4 bg-paper-2 p-4">
            <p className="font-bold">{t}</p>
            <p className="mt-1 text-[14px] text-ink-2">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
