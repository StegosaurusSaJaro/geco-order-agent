import { Suspense } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { ConversationsSkeleton } from '@/components/ConversationsSkeleton';
import { LiveRefresh } from '@/components/LiveRefresh';
import { Pagination } from '@/components/Pagination';
import { TierBadge } from '@/components/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime, one } from '@/lib/format';
import { pageWindow, parsePage, slicePage } from '@/lib/pagination';
import { getSupabaseConfig, requireUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const CONVERSATIONS_PAGE_SIZE = 20;

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

type SupabaseServerClient = Awaited<ReturnType<typeof requireUser>>['supabase'];

function previewText(msg: MessageRow): string {
  const raw = msg.body?.trim() || msg.file_name?.trim() || `[${msg.kind}]`;
  const normalized = raw.replace(/\s+/g, ' ').trim();
  return normalized.length <= 80 ? normalized : `${normalized.slice(0, 77).trimEnd()}…`;
}

async function ConversationsContent({
  supabase,
  requestedPage,
}: {
  supabase: SupabaseServerClient;
  requestedPage: number;
}) {
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
  const pages = pageWindow(requestedPage, rows.length, CONVERSATIONS_PAGE_SIZE);

  return (
    <>
      <div className="flex flex-col gap-1 min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Conversations</h1>
        <p className="text-sm text-muted-foreground tabular-nums">
          {rows.length} {rows.length === 1 ? 'conversation' : 'conversations'}
        </p>
      </div>
      {queryError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            Failed to load conversations: {queryError.message}
          </AlertDescription>
        </Alert>
      ) : rows.length === 0 ? (
        <Card className="py-0">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No conversations yet.
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 py-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Customer</TableHead>
                <TableHead className="px-4">Tier</TableHead>
                <TableHead className="px-4">Last message</TableHead>
                <TableHead className="px-4 text-right">Messages</TableHead>
                <TableHead className="px-4 text-right">Orders</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slicePage(rows, pages).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="px-4 py-3 font-medium">
                    <Link
                      href={`/conversations/${row.id}`}
                      className="text-foreground hover:text-brand-crimson hover:underline transition-colors"
                    >
                      {row.customerName}
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {row.tierName ? (
                      <TierBadge name={row.tierName} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-normal min-w-[220px] max-w-[420px]">
                    {row.lastMessage ? (
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="text-sm text-foreground break-words">
                          {previewText(row.lastMessage)}
                        </div>
                        <div className="font-mono tabular-nums text-xs text-muted-foreground">
                          {formatDateTime(row.lastMessage.created_at)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No messages yet</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono tabular-nums">
                    {row.messageCount}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono tabular-nums">
                    {row.orderCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination pages={pages} basePath="/conversations" itemLabel="conversations" />
        </Card>
      )}
    </>
  );
}

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user } = await requireUser();
  const requestedPage = parsePage(await searchParams);

  return (
    <AppShell
      email={user.email}
      active="conversations"
      breadcrumb={[{ label: 'Conversations' }]}
    >
      <LiveRefresh
        {...getSupabaseConfig()}
        channelName="conversations"
        subscriptions={[
          { table: 'messages', event: 'INSERT' },
          { table: 'orders', event: 'INSERT' },
        ]}
      />
      <Suspense key={`page=${requestedPage}`} fallback={<ConversationsSkeleton />}>
        <ConversationsContent supabase={supabase} requestedPage={requestedPage} />
      </Suspense>
    </AppShell>
  );
}
