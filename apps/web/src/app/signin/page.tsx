import { Suspense } from 'react';
import { GoogleSignIn } from '@/components/GoogleSignIn';

export const metadata = { title: 'Sign in', robots: { index: false, follow: false } };

export default function SignIn() {
  return (
    <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-16 md:grid-cols-12 md:px-6">
      <div className="md:col-span-5">
        <h1 className="font-extrabold tracking-[-0.02em] text-[clamp(36px,5vw,56px)] leading-tight">Sign in to order and track deliveries</h1>
        <p className="mt-4 text-lg text-ink-2">
          We use your Google account, so there&rsquo;s no password and no OTP to wait for. We only receive your name and email.
        </p>
      </div>
      <div className="md:col-span-5 md:col-start-8 md:pt-4">
        <Suspense>
          <GoogleSignIn />
        </Suspense>
      </div>
    </div>
  );
}
