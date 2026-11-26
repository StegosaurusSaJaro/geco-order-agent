'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { reviewReasonLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  approveOrderAction,
  rejectOrderAction,
  type ReviewActionState,
} from './actions';

type Props = {
  orderId: string;
  status: string;
  reviewReasons: string[];
};

export function OrderReviewActions({ orderId, status, reviewReasons }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingDecision, setPendingDecision] = useState<'approve' | 'reject' | null>(null);
  const [result, setResult] = useState<ReviewActionState | null>(null);

  const isHeld = status === 'needs_review';
  if (!isHeld && !result) {
    return null;
  }

  function handleDecision(decision: 'approve' | 'reject') {
    setPendingDecision(decision);
    startTransition(async () => {
      try {
        const next =
          decision === 'approve'
            ? await approveOrderAction(orderId)
            : await rejectOrderAction(orderId);
        setResult(next);
        router.refresh();
      } catch (err) {
        setResult({
          outcome: 'error',
          message:
            err instanceof Error && err.message
              ? err.message
              : 'Request failed. Please try again.',
        });
      } finally {
        setPendingDecision(null);
      }
    });
  }

  const isApproved = result?.outcome === 'approved';
  const isError = result?.outcome === 'short' || result?.outcome === 'error';

  return (
    <div className="flex flex-col gap-3 min-w-0">
      {isHeld ? (
        <section
          aria-label="Held order review"
          className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50/90 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <span
              aria-hidden="true"
              className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--dot-amber)] ring-1 ring-amber-900/20"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold leading-snug">
                Held for staff review
              </div>
              <ul className="mt-1 list-disc pl-4 text-sm text-amber-900/90 space-y-0.5">
                {reviewReasons.length > 0 ? (
                  reviewReasons.map((reason) => (
                    <li key={reason}>{reviewReasonLabel(reason)}</li>
                  ))
                ) : (
                  <li>Requires staff confirmation before stock is deducted</li>
                )}
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              disabled={pending}
              onClick={() => handleDecision('approve')}
              className="flex-1 sm:flex-none"
            >
              {pending && pendingDecision === 'approve' ? 'Approving…' : 'Approve'}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => handleDecision('reject')}
              className="flex-1 sm:flex-none"
            >
              {pending && pendingDecision === 'reject' ? 'Rejecting…' : 'Reject'}
            </Button>
          </div>
        </section>
      ) : null}

      {result ? (
        <Alert
          role="status"
          variant={isError ? 'destructive' : 'default'}
          className={cn(
            isApproved &&
              'border-emerald-300 bg-emerald-50/90 text-emerald-950 [&>svg]:text-emerald-700',
            isError && 'border-destructive/40 bg-[var(--destructive-soft)]',
            !isApproved &&
              !isError &&
              'border-border bg-muted/60 text-foreground [&>svg]:text-muted-foreground'
          )}
        >
          {isApproved ? (
            <CheckCircle2 className="size-4" />
          ) : isError ? (
            <AlertCircle className="size-4" />
          ) : (
            <Info className="size-4" />
          )}
          <AlertDescription className="text-current">
            <span>
              <strong className="font-semibold">{result.message}</strong>
              {result.notice ? <span> · {result.notice}</span> : null}
            </span>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
