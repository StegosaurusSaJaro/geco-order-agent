import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Nav } from '@/components/Nav';
import { formatCurrency, formatDateTime, one, shortId, statusLabel } from '@/lib/format';
import { getSupabaseConfig, requireUser } from '@/lib/supabase';
import { LiveRefresh } from '@/components/LiveRefresh';
import { Pagination } from '@/components/Pagination';
import { pageWindow, parsePage } from '@/lib/pagination';

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
      <>
        <Nav email={user.email} active="conversations" />
        <main className="container">
          <Link href="/conversations" className="back-link">← Conversations</Link>
          <div className="error-box">Failed to load conversation: {conversationError.message}</div>
        </main>
      </>
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
    <>
      <Nav email={user.email} active="conversations" />
      <LiveRefresh
        {...getSupabaseConfig()}
        channelName={`conversation-${id}`}
        subscriptions={[{ table: 'messages', event: 'INSERT', filter: `conversation_id=eq.${id}` }]}
      />
      <main className="container">
        <Link href="/conversations" className="back-link">← Conversations</Link>
        <div className="page-header">
          <div className="page-row" style={{ justifyContent: 'flex-start' }}>
            <h1 className="page-title">{customer?.name ?? 'Unknown customer'}</h1>
            {tier?.name ? <span className="badge badge-tier">{tier.name}</span> : null}
          </div>
          <p className="page-subtitle">
            {pages.total} {pages.total === 1 ? 'message' : 'messages'} · {linkedOrderCount} linked {linkedOrderCount === 1 ? 'order' : 'orders'}
          </p>
        </div>

        {queryError ? (
          <div className="error-box">Failed to load messages: {queryError.message}</div>
        ) : (
          <div className="card">
            <div className="card-body">
              {messages.length === 0 ? (
                <div className="empty">No messages in this conversation yet.</div>
              ) : (
                <div className="chat-list">
                  {messages.map((msg) => {
                    const bodyText = msg.body || (msg.file_name ? '' : '[No text]');
                    const linkedOrders = ordersByMessage.get(msg.id) ?? [];
                    return (
                      <div key={msg.id} className={`msg-row ${msg.direction === 'out' ? 'msg-out' : 'msg-in'}`}>
                        <div className="msg-bubble">
                          <div className="msg-meta">
                            <span>{statusLabel(msg.author)}</span>
                            <span>{msg.direction}</span>
                            <span>{msg.kind}</span>
                            <span>{formatDateTime(msg.created_at)}</span>
                          </div>
                          {msg.file_name ? (
                            <div style={{ marginBottom: bodyText ? '6px' : 0 }}>
                              <span className="badge badge-file">{msg.file_name}</span>
                            </div>
                          ) : null}
                          {bodyText ? <div className="msg-body">{bodyText}</div> : null}
                          {linkedOrders.length > 0 ? (
                            <div className="msg-tags">
                              {linkedOrders.map((order) => (
                                <Link key={order.id} href={`/orders/${order.id}`} className="order-tag">
                                  {order.po_number || `#${shortId(order.id)}`} · {statusLabel(order.status)} · {formatCurrency(order.total, order.currency)}
                                </Link>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <Pagination
              pages={pages}
              basePath={`/conversations/${id}`}
              itemLabel="messages"
              previousLabel="← Newer messages"
              nextLabel="Older messages →"
            />
          </div>
        )}
      </main>
    </>
  );
}
