'use server';

import type { ChatLinkedOrder, ChatMessage } from '@/components/ChatLog';
import { one } from '@/lib/format';
import { requireUser } from '@/lib/supabase';

const MESSAGES_PAGE_SIZE = 50;

type MessageDetailRow = {
  id: string;
  direction: string;
  author: string;
  kind: string;
  body: string | null;
  file_name: string | null;
  created_at: string;
};

type OrderMessageLinkRow = {
  message_id: string;
  orders: ChatLinkedOrder | ChatLinkedOrder[] | null;
};

export async function loadOlderMessages(
  conversationId: string,
  before: { created_at: string; id: string }
): Promise<{ messages: ChatMessage[]; hasMore: boolean; error: string | null }> {
  const { supabase } = await requireUser();

  const { data: messagesData, error: messagesError } = await supabase
    .from('messages')
    .select('id, direction, author, kind, body, file_name, created_at')
    .eq('conversation_id', conversationId)
    .or(
      `created_at.lt."${before.created_at}",and(created_at.eq."${before.created_at}",id.lt."${before.id}")`
    )
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(MESSAGES_PAGE_SIZE + 1);

  if (messagesError) {
    return { messages: [], hasMore: false, error: messagesError.message };
  }

  const rows = (messagesData ?? []) as MessageDetailRow[];
  const hasMore = rows.length > MESSAGES_PAGE_SIZE;
  const pageRows = rows.slice(0, MESSAGES_PAGE_SIZE).reverse();

  const ordersByMessage = new Map<string, ChatLinkedOrder[]>();

  if (pageRows.length > 0) {
    const { data: linkData, error: linkErr } = await supabase
      .from('order_messages')
      .select('message_id, orders(id, status, total, currency, po_number)')
      .in(
        'message_id',
        pageRows.map((msg) => msg.id)
      );

    if (linkErr) {
      return { messages: [], hasMore: false, error: linkErr.message };
    }

    for (const link of (linkData ?? []) as OrderMessageLinkRow[]) {
      const linkedOrder = one(link.orders);
      if (!linkedOrder) continue;
      const existing = ordersByMessage.get(link.message_id) ?? [];
      if (!existing.some((o) => o.id === linkedOrder.id)) {
        existing.push(linkedOrder);
        ordersByMessage.set(link.message_id, existing);
      }
    }
  }

  const messages: ChatMessage[] = pageRows.map((msg) => ({
    ...msg,
    linkedOrders: ordersByMessage.get(msg.id) ?? [],
  }));

  return { messages, hasMore, error: null };
}
