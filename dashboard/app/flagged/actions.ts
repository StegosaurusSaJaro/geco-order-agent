'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/supabase';

export type FlagReviewOutcome = 'released' | 'dismissed' | 'handled' | 'error';

export type FlagReviewResult = {
  outcome: FlagReviewOutcome;
  message: string;
};

const OUTCOME_MESSAGES: Record<'released' | 'dismissed' | 'handled', string> = {
  released: 'Released',
  dismissed: 'Dismissed',
  handled: 'Already handled',
};

async function reviewFlag(
  id: number,
  decision: 'release' | 'dismiss'
): Promise<FlagReviewResult> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('review_flag', {
    p_id: id,
    p_decision: decision,
  });

  if (error) {
    return { outcome: 'error', message: error.message };
  }

  const outcome: FlagReviewOutcome =
    data === 'released' || data === 'dismissed' || data === 'handled'
      ? data
      : 'error';

  if (outcome === 'error') {
    return { outcome: 'error', message: 'Unexpected review response.' };
  }

  revalidatePath('/flagged');

  return {
    outcome,
    message: OUTCOME_MESSAGES[outcome],
  };
}

export async function releaseFlagAction(id: number): Promise<FlagReviewResult> {
  return reviewFlag(id, 'release');
}

export async function dismissFlagAction(id: number): Promise<FlagReviewResult> {
  return reviewFlag(id, 'dismiss');
}
