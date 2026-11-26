'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/supabase';

export type CustomerKind = 'cafe' | 'restaurant' | 'hotel';

export type SignupDecisionOutcome =
  | 'approved'
  | 'rejected'
  | 'handled'
  | 'already_linked'
  | 'error';

export type SignupDecisionResult = {
  outcome: SignupDecisionOutcome;
  message: string;
};

type ResolvedSignupOutcome = Exclude<SignupDecisionOutcome, 'error'>;

const OUTCOME_MESSAGES: Record<ResolvedSignupOutcome, string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  handled: 'Already handled',
  already_linked: 'This Telegram account is already linked to a customer',
};

function isResolvedOutcome(value: unknown): value is ResolvedSignupOutcome {
  return (
    value === 'approved' ||
    value === 'rejected' ||
    value === 'handled' ||
    value === 'already_linked'
  );
}

function mapDecisionResponse(
  data: unknown,
  error: { message: string } | null
): SignupDecisionResult {
  if (error) {
    return { outcome: 'error', message: error.message };
  }

  if (!isResolvedOutcome(data)) {
    return { outcome: 'error', message: 'Unexpected decision response.' };
  }

  revalidatePath('/signups');

  return {
    outcome: data,
    message: OUTCOME_MESSAGES[data],
  };
}

export async function approveSignupAction(input: {
  id: number;
  name: string;
  kind: CustomerKind;
  tierId: number;
}): Promise<SignupDecisionResult> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('decide_signup', {
    p_id: input.id,
    p_decision: 'approve',
    p_name: input.name.trim(),
    p_kind: input.kind,
    p_tier_id: input.tierId,
  });

  return mapDecisionResponse(data, error);
}

export async function rejectSignupAction(id: number): Promise<SignupDecisionResult> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('decide_signup', {
    p_id: id,
    p_decision: 'reject',
  });

  return mapDecisionResponse(data, error);
}
