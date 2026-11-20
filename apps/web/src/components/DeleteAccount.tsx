'use client';

import { Button } from '@dairy/ui';
import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api-client';

export function DeleteAccount() {
  const [state, setState] = useState<'idle' | 'confirm' | 'done' | 'signed-out'>('idle');
  const [erasesOn, setErasesOn] = useState('');
  async function remove() {
    try {
      const r = await api<{ erasesOn: string }>('/v1/store/me', { method: 'DELETE' });
      setErasesOn(r.erasesOn);
      setState('done');
    } catch (e) {
      if (e instanceof ApiError && e.problem.status === 401) setState('signed-out');
    }
  }
  if (state === 'done') return <p className="mt-8 border-l-4 border-tick bg-paper-2 px-4 py-3">Done. Your personal data will be erased on {erasesOn}.</p>;
  if (state === 'signed-out')
    return (
      <p className="mt-8">
        <Link href="/signin?next=/account/delete" className="underline underline-offset-4">
          Sign in
        </Link>{' '}
        first, then come back to this page.
      </p>
    );
  return state === 'idle' ? (
    <Button variant="outline" className="mt-8" onClick={() => setState('confirm')}>
      Delete my account
    </Button>
  ) : (
    <div className="mt-8 flex gap-3">
      <Button variant="solid" className="bg-alert" onClick={remove}>
        Yes, delete it
      </Button>
      <Button variant="ghost" onClick={() => setState('idle')}>
        Keep my account
      </Button>
    </div>
  );
}
