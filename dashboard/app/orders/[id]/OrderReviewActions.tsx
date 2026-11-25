'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  approveOrderAction,
  rejectOrderAction,
  type ReviewActionState,
} from './actions';

const REASON_LABELS: Record<string, string> = {
  total: 'Over the $2,000 review limit',
  over_threshold: 'Over the $2,000 review limit',
  stock: 'Not enough stock',
  price_mismatch: 'Price mismatch',
};

export function reviewReasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}

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
      const next =
        decision === 'approve'
          ? await approveOrderAction(orderId)
          : await rejectOrderAction(orderId);
      setResult(next);
      setPendingDecision(null);
      router.refresh();
    });
  }

  const feedbackClass =
    result?.outcome === 'approved'
      ? 'review-feedback review-feedback-ok'
      : result?.outcome === 'short' || result?.outcome === 'error'
        ? 'review-feedback review-feedback-err'
        : 'review-feedback review-feedback-muted';

  return (
    <div className="review-stack">
      {isHeld ? (
        <section className="review-banner" aria-label="Held order review">
          <div className="review-banner-copy">
            <div className="review-banner-title">Held for staff review</div>
            <ul className="review-reason-list">
              {reviewReasons.length > 0 ? (
                reviewReasons.map((reason) => (
                  <li key={reason}>{reviewReasonLabel(reason)}</li>
                ))
              ) : (
                <li>Requires staff confirmation before stock is deducted</li>
              )}
            </ul>
          </div>
          <div className="review-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() => handleDecision('approve')}
            >
              {pending && pendingDecision === 'approve' ? 'Approving…' : 'Approve'}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={pending}
              onClick={() => handleDecision('reject')}
            >
              {pending && pendingDecision === 'reject' ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </section>
      ) : null}

      {result ? (
        <div className={feedbackClass} role="status">
          <strong>{result.message}</strong>
          {result.notice ? <span> · {result.notice}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
