'use server';

import { revalidatePath } from 'next/cache';
import { formatCurrency, one, shortId } from '@/lib/format';
import { requireUser } from '@/lib/supabase';
import { sendTelegramMessage } from '@/lib/telegram';

export type ReviewOutcome = 'approved' | 'rejected' | 'short' | 'handled' | 'error';

export type ReviewActionState = {
  outcome: ReviewOutcome;
  message: string;
  notice?: string | null;
};

type OrderNotifyRow = {
  conversation_id: string;
  total: number | string;
  currency: string;
  conversations: { telegram_chat_id: number | string } | { telegram_chat_id: number | string }[] | null;
};

const OUTCOME_MESSAGES: Record<'approved' | 'rejected' | 'short' | 'handled', string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  short: 'Not enough stock, approval refused',
  handled: 'Already handled',
};

function approvalMessage(
  orderId: string,
  total: number | string,
  currency: string
): string {
  const ref = `#${shortId(orderId)}`;
  const amount = formatCurrency(total, currency);
  return `Order ${ref} (${amount}) has been approved and confirmed by our team.`;
}

async function reviewOrder(
  orderId: string,
  decision: 'approve' | 'reject'
): Promise<ReviewActionState> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('review_order', {
    p_order_id: orderId,
    p_decision: decision,
  });

  if (error) {
    return { outcome: 'error', message: error.message };
  }

  const outcome: ReviewOutcome =
    data === 'approved' || data === 'rejected' || data === 'short' || data === 'handled'
      ? data
      : 'error';

  if (outcome === 'error') {
    return { outcome: 'error', message: 'Unexpected review response.' };
  }

  let notice: string | null = null;

  if (outcome === 'approved') {
    const { data: orderData } = await supabase
      .from('orders')
      .select('conversation_id, total, currency, conversations(telegram_chat_id)')
      .eq('id', orderId)
      .maybeSingle();

    const orderRow = orderData as OrderNotifyRow | null;
    const conv = one(orderRow?.conversations);
    const chatId = conv ? Number(conv.telegram_chat_id) : NaN;

    if (orderRow && Number.isFinite(chatId) && chatId >= 0) {
      const body = approvalMessage(orderId, orderRow.total, orderRow.currency);
      const sent = await sendTelegramMessage(chatId, body);
      if (sent.ok) {
        const { data: savedMsg } = await supabase
          .from('messages')
          .insert({
            conversation_id: orderRow.conversation_id,
            direction: 'out',
            author: 'staff',
            kind: 'text',
            body,
            telegram_message_id: sent.messageId,
          })
          .select('id')
          .single();

        if (savedMsg?.id) {
          await supabase.from('order_messages').insert({
            order_id: orderId,
            message_id: savedMsg.id,
          });
        }
      } else if (sent.error) {
        notice = 'Order updated, but the Telegram message could not be sent.';
      }
    }
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/orders');

  return {
    outcome,
    message: OUTCOME_MESSAGES[outcome],
    notice,
  };
}

export async function approveOrderAction(orderId: string): Promise<ReviewActionState> {
  return reviewOrder(orderId, 'approve');
}

export async function rejectOrderAction(orderId: string): Promise<ReviewActionState> {
  return reviewOrder(orderId, 'reject');
}
