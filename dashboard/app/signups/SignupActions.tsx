'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  approveSignupAction,
  rejectSignupAction,
  type CustomerKind,
  type SignupDecisionOutcome,
  type SignupDecisionResult,
} from './actions';

export type TierOption = {
  id: number;
  code: string;
  name: string;
};

const SELECT_CLASS_NAME =
  'h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30';

function outcomeClassName(outcome: SignupDecisionOutcome): string {
  if (outcome === 'approved') {
    return 'text-xs font-medium text-emerald-700';
  }
  if (outcome === 'rejected' || outcome === 'handled') {
    return 'text-xs text-muted-foreground';
  }
  return 'text-xs text-destructive';
}

const SIGNUP_RESULT_EVENT = 'signup-decision-result';

export function SignupOutcome() {
  const [result, setResult] = useState<SignupDecisionResult | null>(null);

  useEffect(() => {
    function onResult(event: Event) {
      if (event instanceof CustomEvent) setResult(event.detail);
    }
    window.addEventListener(SIGNUP_RESULT_EVENT, onResult);
    return () => window.removeEventListener(SIGNUP_RESULT_EVENT, onResult);
  }, []);

  return result ? (
    <div role="status" className="border-b border-border px-4 py-3 text-sm">
      {result.message}
    </div>
  ) : null;
}

export function SignupActions({
  id,
  defaultBusinessName,
  tiers,
}: {
  id: number;
  defaultBusinessName: string;
  tiers: TierOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultBusinessName);
  const [kind, setKind] = useState<'' | CustomerKind>('');
  const [tierId, setTierId] = useState('');
  const [pending, startTransition] = useTransition();
  const [pendingDecision, setPendingDecision] = useState<'approve' | 'reject' | null>(null);
  const [result, setResult] = useState<SignupDecisionResult | null>(null);

  const parsedTierId = Number(tierId);
  const hasValidKind = kind === 'cafe' || kind === 'restaurant' || kind === 'hotel';
  const hasValidTier = tierId !== '' && Number.isInteger(parsedTierId);
  const hasValidName = name.trim().length > 0;
  const canApprove = hasValidName && hasValidKind && hasValidTier;

  const nameInputId = `signup-${id}-name`;
  const kindSelectId = `signup-${id}-kind`;
  const tierSelectId = `signup-${id}-tier`;

  function handleApprove() {
    if (!hasValidName || !hasValidKind || !hasValidTier) {
      return;
    }

    const selectedKind: CustomerKind = kind;
    setPendingDecision('approve');
    setResult(null);
    startTransition(async () => {
      const next = await approveSignupAction({
        id,
        name: name.trim(),
        kind: selectedKind,
        tierId: parsedTierId,
      });
      setResult(next);
      if (next.outcome === 'approved' || next.outcome === 'rejected' || next.outcome === 'handled') {
        window.dispatchEvent(new CustomEvent(SIGNUP_RESULT_EVENT, { detail: next }));
      }
      setPendingDecision(null);
      router.refresh();
    });
  }

  function handleReject() {
    setPendingDecision('reject');
    setResult(null);
    startTransition(async () => {
      const next = await rejectSignupAction(id);
      setResult(next);
      if (next.outcome === 'approved' || next.outcome === 'rejected' || next.outcome === 'handled') {
        window.dispatchEvent(new CustomEvent(SIGNUP_RESULT_EVENT, { detail: next }));
      }
      setPendingDecision(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={nameInputId}>Customer name</Label>
          <Input
            id={nameInputId}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={kindSelectId}>Type</Label>
          <select
            id={kindSelectId}
            value={kind}
            onChange={(event) => setKind(event.target.value as '' | CustomerKind)}
            disabled={pending}
            className={SELECT_CLASS_NAME}
          >
            <option value="">Select type…</option>
            <option value="cafe">Cafe</option>
            <option value="restaurant">Restaurant</option>
            <option value="hotel">Hotel</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={tierSelectId}>Price tier</Label>
          <select
            id={tierSelectId}
            value={tierId}
            onChange={(event) => setTierId(event.target.value)}
            disabled={pending}
            className={SELECT_CLASS_NAME}
          >
            <option value="">Select tier…</option>
            {tiers.map((tier) => (
              <option key={tier.id} value={String(tier.id)}>
                {tier.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || !canApprove}
          onClick={handleApprove}
        >
          {pending && pendingDecision === 'approve' ? 'Approving…' : 'Approve'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={handleReject}
        >
          {pending && pendingDecision === 'reject' ? 'Rejecting…' : 'Reject'}
        </Button>
        {result ? (
          <span role="status" className={outcomeClassName(result.outcome)}>
            {result.message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
