import { Suspense } from 'react';
import { AccountView } from '@/components/AccountView';

export const metadata = { title: 'My milk card' };

export default function Account() {
  return (
    <Suspense>
      <AccountView />
    </Suspense>
  );
}
