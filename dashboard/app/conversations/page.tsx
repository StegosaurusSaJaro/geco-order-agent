import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { formatDateTime, one } from '@/lib/format';
import { getSupabaseConfig, requireUser } from '@/lib/supabase';
import { LiveRefresh } from '@/components/LiveRefresh';

export const dynamic = 'force-dynamic';

type CustomerRow = { name: string; tiers: { name: string } | { name: string }[] | null };
type ConversationRow = { id: string; created_at: string; customers: CustomerRow | CustomerRow[] | null };
type MessageRow = {
  id: string;
  conversation_id: string;
  body: string | null;
  kind: string;
  file_name: string | null;
  created_at: string;
};
type OrderRow = { id: string; conversation_id: string | null };

function previewText(msg: MessageRow): string {
  const raw = msg.body?.trim() || msg.file_name?.trim() || `[${msg.kind}]`;
  const normalized = raw.replace(/\s+/g, ' ').trim();
  return normalized.length <= 80 ? normalized : `${normalized.slice(0, 77).trimEnd()}…`;
}

export default async function ConversationsPage() {
  const { supabase, user } = await requireUser();

  const [conversationsRes, messagesRes, ordersRes] = await Promise.all([
    supabase.from('conversations').select('id, created_at, customers(name, tiers(name))'),
    supabase
      .from('messages')
      .select('id, conversation_id, body, kind, file_name, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('orders').select('id, conversation_id'),
  ]);

  const queryError = conversationsRes.error || messagesRes.error || ordersRes.error;
  const conversations = (conversationsRes.data ?? []) as ConversationRow[];
  const messages = (messagesRes.data ?? []) as MessageRow[];
  const orders = (ordersRes.data ?? []) as OrderRow[];

  const lastMessageByConv = new Map<string, MessageRow>();
  const messageCountByConv = new Map<string, number>();
  for (const msg of messages) {
    if (!lastMessageByConv.has(msg.conversation_id)) lastMessageByConv.set(msg.conversation_id, msg);
    messageCountByConv.set(msg.conversation_id, (messageCountByConv.get(msg.conversation_id) ?? 0) + 1);
  }

  const orderCountByConv = new Map<string, number>();
  for (const order of orders) {
    if (order.conversation_id) {
      orderCountByConv.set(order.conversation_id, (orderCountByConv.get(order.conversation_id) ?? 0) + 1);
    }
  }

  const rows = conversations
    .map((conv) => {
      const customer = one(conv.customers);
      const lastMessage = lastMessageByConv.get(conv.id) ?? null;
      return {
        id: conv.id,
        customerName: customer?.name ?? 'Unknown customer',
        tierName: one(customer?.tiers)?.name ?? null,
        lastMessage,
        messageCount: messageCountByConv.get(conv.id) ?? 0,
        orderCount: orderCountByConv.get(conv.id) ?? 0,
        sortAt: Date.parse(lastMessage?.created_at ?? conv.created_at) || 0,
      };
    })
    .sort((a, b) => b.sortAt - a.sortAt);

  return (
    <>
      <Nav email={user.email} active="conversations" />
      <LiveRefresh
        {...getSupabaseConfig()}
        channelName="conversations"
        subscriptions={[
          { table: 'messages', event: 'INSERT' },
          { table: 'orders', event: 'INSERT' },
        ]}
      />
      <main className="container">
        <div className="page-header">
          <h1 className="page-title">Conversations</h1>
          <p className="page-subtitle">{rows.length} {rows.length === 1 ? 'conversation' : 'conversations'}</p>
        </div>
        {queryError ? (
          <div className="error-box">Failed to load conversations: {queryError.message}</div>
        ) : rows.length === 0 ? (
          <div className="card"><div className="empty">No conversations yet.</div></div>
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th><th>Tier</th><th>Last message</th>
                    <th className="num">Messages</th><th className="num">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td><Link href={`/conversations/${row.id}`} className="row-link">{row.customerName}</Link></td>
                      <td>{row.tierName ? <span className="badge badge-tier">{row.tierName}</span> : '—'}</td>
                      <td>
                        {row.lastMessage ? (
                          <div>
                            <div>{previewText(row.lastMessage)}</div>
                            <div className="muted">{formatDateTime(row.lastMessage.created_at)}</div>
                          </div>
                        ) : <span className="muted">No messages yet</span>}
                      </td>
                      <td className="num">{row.messageCount}</td>
                      <td className="num">{row.orderCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
