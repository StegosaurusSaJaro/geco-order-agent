'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  dismissFlagAction,
  releaseFlagAction,
  type FlagReviewResult,
} from './actions';

export function FlagActions({ id }: { id: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingDecision, setPendingDecision] = useState<'release' | 'dismiss' | null>(null);
  const [result, setResult] = useState<FlagReviewResult | null>(null);

  function handleDecision(decision: 'release' | 'dismiss') {
    setPendingDecision(decision);
    setResult(null);
    startTransition(async () => {
      const next =
        decision === 'release'
          ? await releaseFlagAction(id)
          : await dismissFlagAction(id);
      setResult(next);
      setPendingDecision(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => handleDecision('release')}
        >
          {pending && pendingDecision === 'release' ? 'Releasing…' : 'Release'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => handleDecision('dismiss')}
        >
          {pending && pendingDecision === 'dismiss' ? 'Dismissing…' : 'Dismiss'}
        </Button>
      </div>
      {result && (result.outcome === 'error' || result.outcome === 'handled') ? (
        <span
          role="status"
          className={
            result.outcome === 'error'
              ? 'text-xs text-destructive'
              : 'text-xs text-muted-foreground'
          }
        >
          {result.message}
        </span>
      ) : null}
    </div>
  );
}
