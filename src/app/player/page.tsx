import { Suspense } from 'react';
import PlayerClientPage from './PlayerClientPage';

export default function PlayerPage() {
  return (
    <Suspense fallback={null}>
      <PlayerClientPage />
    </Suspense>
  );
}
