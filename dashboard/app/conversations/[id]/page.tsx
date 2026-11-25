import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertCircle, ArrowLeft, Paperclip } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { LiveRefresh } from '@/components/LiveRefresh';
import { Pagination } from '@/components/Pagination';
import { TierBadge } from '@/components/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatDateTime, one, shortId, statusLabel } from '@/lib/format';
import { pageWindow, parsePage } from '@/lib/pagination';
import { getSupabaseConfig, requireUser } from '@/lib/supabase';
import { cn } from '@/lib/utils';

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
type LinkedOrder = { id: string; status: string; total: number | string; currency: string; po_number: string | null };
type OrderMessageLinkRow = { message_id: string; orders: LinkedOrder | LinkedOrder[] | null };

export default async function ConversationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const requestedPage = parsePage(await searchParams);
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

  const pages = pageWindow(requestedPage, messageTotal ?? 0, MESSAGES_PAGE_SIZE);

  const { data: messagesData, error: pageError } = await supabase
    .from('messages')
    .select('id, direction, author, kind, body, file_name, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(pages.from, Math.max(pages.from, pages.to - 1));

  const { count: orderTotal, error: orderCountError } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', id);

  const messagesError = countError || pageError || orderCountError;
  const linkedOrderCount = orderTotal ?? 0;
  const messages = ((messagesData ?? []) as MessageDetailRow[]).reverse();
  const ordersByMessage = new Map<string, LinkedOrder[]>();
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
            {pages.total} {pages.total === 1 ? 'message' : 'messages'} · {linkedOrderCount} linked {linkedOrderCount === 1 ? 'order' : 'orders'}
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
        <Card className="gap-0 py-0 overflow-hidden">
          <CardContent className="p-4 md:p-6 min-w-0">
            {messages.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No messages in this conversation yet.
              </div>
            ) : (
              <div className="flex flex-col gap-3 min-w-0">
                {messages.map((msg) => {
                  const bodyText = msg.body || (msg.file_name ? '' : '[No text]');
                  const linkedOrders = ordersByMessage.get(msg.id) ?? [];
                  const isOutgoing = msg.direction === 'out';
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'max-w-[85%] md:max-w-[78%] min-w-0 border border-border rounded-lg px-3.5 py-2.5 flex flex-col gap-1.5',
                        isOutgoing ? 'self-end bg-sidebar' : 'self-start bg-card'
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">
                          {statusLabel(msg.author)}
                        </span>
                        <span>{msg.direction}</span>
                        <span>{msg.kind}</span>
                        <span className="font-mono tabular-nums">
                          {formatDateTime(msg.created_at)}
                        </span>
                      </div>
                      {msg.file_name ? (
                        <div className="min-w-0">
                          <Badge variant="secondary" className="max-w-full font-mono text-xs">
                            <Paperclip className="size-3 shrink-0" />
                            <span className="truncate">{msg.file_name}</span>
                          </Badge>
                        </div>
                      ) : null}
                      {bodyText ? (
                        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words min-w-0">
                          {bodyText}
                        </div>
                      ) : null}
                      {linkedOrders.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1 min-w-0">
                          {linkedOrders.map((order) => (
                            <Link
                              key={order.id}
                              href={`/orders/${order.id}`}
                              className="inline-flex max-w-full items-center rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground transition-colors hover:border-brand-crimson hover:text-brand-crimson break-words"
                            >
                              {order.po_number || `#${shortId(order.id)}`} · {statusLabel(order.status)} · {formatCurrency(order.total, order.currency)}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
          <Pagination
            pages={pages}
            basePath={`/conversations/${id}`}
            itemLabel="messages"
            previousLabel="← Newer messages"
            nextLabel="Older messages →"
          />
        </Card>
      )}
    </AppShell>
  );
}
