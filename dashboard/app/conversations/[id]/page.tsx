import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { ChatLog, type ChatLinkedOrder, type ChatMessage } from '@/components/ChatLog';
import { LiveRefresh } from '@/components/LiveRefresh';
import { TierBadge } from '@/components/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { one } from '@/lib/format';
import { getSupabaseConfig, requireUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const MESSAGES_PAGE_SIZE = 50;

type CustomerRow = { name: string; kind: string | null; tiers: { name: string } | { name: string }[] | null };
type ConversationDetailRow = { id: string; created_at: string; customers: CustomerRow | CustomerRow[] | null };
type MessageDetailRow = {
  id: string;
  direction: string;
  author: string;
  kind: string;
  body: string | null;
  file_name: string | null;
  created_at: string;
};
type OrderMessageLinkRow = { message_id: string; orders: ChatLinkedOrder | ChatLinkedOrder[] | null };

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  const { data: conversationData, error: conversationError } = await supabase
    .from('conversations')
    .select('id, created_at, customers(name, kind, tiers(name))')
    .eq('id', id)
    .maybeSingle();

  if (conversationError) {
    return (
      <AppShell
        email={user.email}
        active="conversations"
        breadcrumb={[
          { label: 'Conversations', href: '/conversations' },
          { label: 'Conversation' },
        ]}
      >
        <div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/conversations">
              <ArrowLeft className="size-3.5" />
              Back to Conversations
            </Link>
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            Failed to load conversation: {conversationError.message}
          </AlertDescription>
        </Alert>
      </AppShell>
    );
  }
  if (!conversationData) notFound();

  const conversation = conversationData as ConversationDetailRow;
  const customer = one(conversation.customers);
  const tier = one(customer?.tiers);

  const { count: messageTotal, error: countError } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', id);

  const { data: messagesData, error: pageError } = await supabase
    .from('messages')
    .select('id, direction, author, kind, body, file_name, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(MESSAGES_PAGE_SIZE);

  const { count: orderTotal, error: orderCountError } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', id);

  const messagesError = countError || pageError || orderCountError;
  const totalMessages = messageTotal ?? 0;
  const linkedOrderCount = orderTotal ?? 0;
  const messages = ((messagesData ?? []) as MessageDetailRow[]).reverse();
  const ordersByMessage = new Map<string, ChatLinkedOrder[]>();
  let linksError: { message: string } | null = null;

  if (!messagesError && messages.length > 0) {
    const { data: linkData, error: linkErr } = await supabase
      .from('order_messages')
      .select('message_id, orders(id, status, total, currency, po_number)')
      .in('message_id', messages.map((msg) => msg.id));

    if (linkErr) {
      linksError = linkErr;
    } else {
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
  }

  const queryError = messagesError || linksError;
  const chatMessages: ChatMessage[] = messages.map((msg) => ({
    ...msg,
    linkedOrders: ordersByMessage.get(msg.id) ?? [],
  }));

  return (
    <AppShell
      email={user.email}
      active="conversations"
      breadcrumb={[
        { label: 'Conversations', href: '/conversations' },
        { label: customer?.name ?? 'Conversation' },
      ]}
    >
      <LiveRefresh
        {...getSupabaseConfig()}
        channelName={`conversation-${id}`}
        subscriptions={[{ table: 'messages', event: 'INSERT', filter: `conversation_id=eq.${id}` }]}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight break-words">
              {customer?.name ?? 'Unknown customer'}
            </h1>
            {tier?.name ? <TierBadge name={tier.name} /> : null}
          </div>
          <p className="text-sm text-muted-foreground tabular-nums">
            {totalMessages} {totalMessages === 1 ? 'message' : 'messages'} · {linkedOrderCount} linked {linkedOrderCount === 1 ? 'order' : 'orders'}
          </p>
        </div>
        <div className="shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href="/conversations">
              <ArrowLeft className="size-3.5" />
              Back to Conversations
            </Link>
          </Button>
        </div>
      </div>

      {queryError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            Failed to load messages: {queryError.message}
          </AlertDescription>
        </Alert>
      ) : (
        <ChatLog
          key={id}
          conversationId={id}
          initialMessages={chatMessages}
          initialHasMore={totalMessages > chatMessages.length}
        />
      )}
    </AppShell>
  );
}
