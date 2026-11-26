import Link from 'next/link';
import { AlertCircle, MessageSquare } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { LiveRefresh } from '@/components/LiveRefresh';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime, one, statusLabel } from '@/lib/format';
import { formatWaitingAge } from '@/lib/orders';
import { getSupabaseConfig, requireUser } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { FlagActions } from './FlagActions';

export const dynamic = 'force-dynamic';

const RECENT_DECISIONS_LIMIT = 10;

type MessageJoin = {
  body: string | null;
  kind: string;
  file_name: string | null;
  created_at: string;
};

type ConversationJoin = {
  id: string;
  customer_id: string;
  customers: { name: string } | { name: string }[] | null;
};

type ScreeningRow = {
  id: number;
  telegram_user_id: number | string;
  decision: string;
  reason: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  conversation_id: string | null;
  messages: MessageJoin | MessageJoin[] | null;
  conversations: ConversationJoin | ConversationJoin[] | null;
};

const DECISION_LABELS: Record<string, string> = {
  rate_limited: 'Rate limited',
  abuse: 'Abuse',
  spam: 'Spam',
  off_topic: 'Off-topic',
  injection: 'Prompt injection',
  allow: 'Allowed',
};

function decisionLabel(decision: string): string {
  return DECISION_LABELS[decision] ?? statusLabel(decision);
}

function outcomeLabel(status: string): string {
  if (status === 'released' || status === 'processed') {
    return 'Released';
  }
  if (status === 'dismissed') {
    return 'Dismissed';
  }
  return statusLabel(status);
}

function messageSummary(msg: MessageJoin | null): string {
  if (!msg) {
    return 'Message unavailable';
  }
  const body = msg.body?.trim();
  if (body) {
    return body;
  }
  const fileName = msg.file_name?.trim();
  if (fileName) {
    return `[${msg.kind}] ${fileName}`;
  }
  return `[${msg.kind}]`;
}

function previewText(text: string, maxLength = 90): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export default async function FlaggedPage() {
  const { supabase, user } = await requireUser();
  const nowMs = Date.now();
  const selectColumns =
    'id, telegram_user_id, decision, reason, status, created_at, reviewed_at, conversation_id, messages(body, kind, file_name, created_at), conversations(id, customer_id, customers(name))';

  const [heldRes, recentRes] = await Promise.all([
    supabase
      .from('screening_log')
      .select(selectColumns)
      .eq('status', 'held')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }),
    supabase
      .from('screening_log')
      .select(selectColumns)
      .in('status', ['released', 'processed', 'dismissed'])
      .order('reviewed_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .limit(RECENT_DECISIONS_LIMIT),
  ]);

  const queryError = heldRes.error ?? recentRes.error;
  const heldFlags = (heldRes.data ?? []) as unknown as ScreeningRow[];
  const recentDecisions = (recentRes.data ?? []) as unknown as ScreeningRow[];

  return (
    <>
      <LiveRefresh
        {...getSupabaseConfig()}
        channelName="flagged"
        subscriptions={[{ table: 'screening_log', event: '*' }]}
      />
      <AppShell email={user.email} active="flagged" breadcrumb={[{ label: 'Flagged' }]}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.025em] leading-tight">
              Flagged
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Messages held by screening for staff release or dismissal.
            </p>
          </div>
        </div>

        {queryError ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>
              Failed to load flagged messages: {queryError.message}
            </AlertDescription>
          </Alert>
        ) : null}

        <Card className="py-0 gap-0 overflow-hidden border-amber-300/90">
          <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-amber-200/90 bg-amber-50/90 px-4 py-3 text-amber-950">
            <div className="flex items-center gap-2 min-w-0">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full bg-[var(--dot-amber)] ring-1 ring-amber-900/20"
              />
              <CardTitle className="text-[13.5px] font-semibold">
                Held Messages
              </CardTitle>
            </div>
            <span className="text-xs font-medium text-amber-900/80 tabular-nums shrink-0">
              {heldFlags.length} held · Newest first
            </span>
          </CardHeader>

          {heldFlags.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No messages currently held.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {heldFlags.map((row) => {
                const conversation = one(row.conversations);
                const customerName =
                  one(conversation?.customers)?.name ??
                  `Telegram #${row.telegram_user_id}`;
                const conversationId = row.conversation_id ?? conversation?.id ?? null;
                const msg = one(row.messages);
                const msgText = messageSummary(msg);
                const age = formatWaitingAge(row.created_at, nowMs);

                return (
                  <li
                    key={row.id}
                    className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-amber-50/40 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold text-foreground">
                          {customerName}
                        </span>
                        <Badge
                          variant="outline"
                          className="border-amber-300/90 bg-amber-50/80 text-amber-950 font-medium"
                        >
                          {decisionLabel(row.decision)}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono tabular-nums">
                          {formatDateTime(row.created_at)} · {age} ago
                        </span>
                      </div>

                      {row.reason ? (
                        <p className="text-xs text-muted-foreground">{row.reason}</p>
                      ) : null}

                      <p className="text-sm text-foreground break-words whitespace-pre-wrap rounded-md border border-border bg-sidebar/60 px-3 py-2">
                        {msgText}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-start justify-end gap-2 shrink-0">
                      {conversationId ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/conversations/${conversationId}`}>
                            <MessageSquare className="size-3.5" />
                            View chat
                          </Link>
                        </Button>
                      ) : null}
                      <FlagActions id={row.id} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="py-0 gap-0 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-[13.5px] font-semibold">
                Recent decisions
              </CardTitle>
              <span className="text-xs text-muted-foreground tabular-nums">
                Last {recentDecisions.length}
              </span>
            </div>
          </CardHeader>

          {recentDecisions.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No reviewed flags yet.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-sidebar">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                    Customer
                  </TableHead>
                  <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                    Flag
                  </TableHead>
                  <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                    Message
                  </TableHead>
                  <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                    Outcome
                  </TableHead>
                  <TableHead className="px-4 text-right text-xs font-medium text-muted-foreground">
                    Reviewed
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentDecisions.map((row) => {
                  const conversation = one(row.conversations);
                  const customerName =
                    one(conversation?.customers)?.name ??
                    `Telegram #${row.telegram_user_id}`;
                  const conversationId = row.conversation_id ?? conversation?.id ?? null;
                  const msg = one(row.messages);
                  const outcome = outcomeLabel(row.status);
                  const isReleased = outcome === 'Released';

                  return (
                    <TableRow key={row.id} className="hover:bg-sidebar/70">
                      <TableCell className="px-4 py-3 font-medium">
                        {conversationId ? (
                          <Link
                            href={`/conversations/${conversationId}`}
                            className="hover:text-[var(--brand-crimson)] hover:underline underline-offset-4"
                          >
                            {customerName}
                          </Link>
                        ) : (
                          customerName
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm text-foreground">
                            {decisionLabel(row.decision)}
                          </span>
                          {row.reason ? (
                            <span className="text-xs text-muted-foreground">
                              {previewText(row.reason, 60)}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 max-w-[360px] text-sm text-muted-foreground">
                        {previewText(messageSummary(msg))}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge variant="outline" className="gap-1.5 font-medium">
                          <span
                            aria-hidden="true"
                            className={cn(
                              'size-1.5 rounded-full shrink-0',
                              isReleased
                                ? 'bg-[var(--dot-green)]'
                                : 'bg-[var(--dot-zinc)]'
                            )}
                          />
                          {outcome}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
                        {formatDateTime(row.reviewed_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </AppShell>
    </>
  );
}
