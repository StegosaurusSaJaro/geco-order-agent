import { AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { LiveRefresh } from '@/components/LiveRefresh';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { SignupActions, SignupOutcome, type TierOption } from './SignupActions';

export const dynamic = 'force-dynamic';

type PendingSignupRow = {
  id: number;
  telegram_user_id: number | string;
  telegram_name: string | null;
  telegram_username: string | null;
  status: string;
  business_name: string | null;
  contact_name: string | null;
  phone: string | null;
  delivery_address: string | null;
  submitted_at: string | null;
  created_at: string;
};

type TierJoin = {
  name: string;
};

type CustomerJoin = {
  name: string;
  kind: string | null;
  tiers: TierJoin | TierJoin[] | null;
};

type DecidedSignupRow = {
  id: number;
  telegram_user_id: number | string;
  telegram_name: string | null;
  telegram_username: string | null;
  status: string;
  business_name: string | null;
  contact_name: string | null;
  decided_at: string | null;
  customer_id: string | null;
  customers: CustomerJoin | CustomerJoin[] | null;
};

function formatTelegramHandle(username: string | null): string | null {
  const trimmed = username?.trim().replace(/^@+/, '');
  return trimmed ? `@${trimmed}` : null;
}

function telegramIdentity(row: {
  telegram_user_id: number | string;
  telegram_name: string | null;
  telegram_username: string | null;
}): { primary: string; secondary: string | null } {
  const name = row.telegram_name?.trim() || null;
  const handle = formatTelegramHandle(row.telegram_username);
  if (name && handle) {
    return { primary: name, secondary: handle };
  }
  if (name) {
    return { primary: name, secondary: null };
  }
  if (handle) {
    return { primary: handle, secondary: null };
  }
  return { primary: `Telegram #${row.telegram_user_id}`, secondary: null };
}

function outcomeLabel(status: string): string {
  if (status === 'approved') {
    return 'Approved';
  }
  if (status === 'rejected') {
    return 'Rejected';
  }
  return statusLabel(status);
}

export default async function SignupsPage() {
  const { supabase, user } = await requireUser();
  const nowMs = Date.now();

  const [pendingRes, recentRes, tiersRes] = await Promise.all([
    supabase
      .from('signups')
      .select(
        'id, telegram_user_id, telegram_name, telegram_username, status, business_name, contact_name, phone, delivery_address, submitted_at, created_at'
      )
      .eq('status', 'pending')
      .order('submitted_at', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true }),
    supabase
      .from('signups')
      .select(
        'id, telegram_user_id, telegram_name, telegram_username, status, business_name, contact_name, decided_at, customer_id, customers(name, kind, tiers(name))'
      )
      .in('status', ['approved', 'rejected'])
      .order('decided_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .limit(20),
    supabase
      .from('tiers')
      .select('id, code, name')
      .order('id', { ascending: true }),
  ]);

  const queryError = pendingRes.error ?? recentRes.error ?? tiersRes.error;
  const pendingSignups = (pendingRes.data ?? []) as unknown as PendingSignupRow[];
  const recentDecisions = (recentRes.data ?? []) as unknown as DecidedSignupRow[];
  const tiers = (tiersRes.data ?? []) as unknown as TierOption[];

  return (
    <>
      <LiveRefresh
        {...getSupabaseConfig()}
        channelName="signups"
        subscriptions={[{ table: 'signups', event: '*' }]}
      />
      <AppShell email={user.email} active="signups" breadcrumb={[{ label: 'Sign-ups' }]}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.025em] leading-tight">
              Sign-ups
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Review customer onboarding requests and assign account tiers.
            </p>
          </div>
        </div>

        {queryError ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>
              Failed to load sign-ups: {queryError.message}
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
                Pending Requests
              </CardTitle>
            </div>
            <span className="text-xs font-medium text-amber-900/80 tabular-nums shrink-0">
              {pendingSignups.length} pending · Oldest first
            </span>
          </CardHeader>

          <SignupOutcome />
          {pendingSignups.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No pending sign-up requests.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {pendingSignups.map((row) => {
                const businessName = row.business_name?.trim() || 'Unnamed business';
                const telegram = telegramIdentity(row);
                const submittedTime = formatDateTime(row.submitted_at);
                const waitingAge = row.submitted_at
                  ? formatWaitingAge(row.submitted_at, nowMs)
                  : null;

                return (
                  <li
                    key={row.id}
                    className="flex flex-col gap-3.5 px-4 py-4 transition-colors hover:bg-amber-50/40"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                          <span className="text-sm font-semibold text-foreground">
                            {businessName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {telegram.primary}
                            {telegram.secondary ? ` (${telegram.secondary})` : ''}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono tabular-nums shrink-0">
                          {waitingAge
                            ? `${submittedTime} · ${waitingAge} ago`
                            : submittedTime}
                        </span>
                      </div>

                      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-md border border-border bg-sidebar/60 px-3 py-2.5 text-sm sm:grid-cols-3">
                        <div className="min-w-0">
                          <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            Contact
                          </dt>
                          <dd className="mt-0.5 text-foreground break-words">
                            {row.contact_name?.trim() || '—'}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            Phone
                          </dt>
                          <dd className="mt-0.5 font-mono text-foreground break-words">
                            {row.phone?.trim() || '—'}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            Delivery address
                          </dt>
                          <dd className="mt-0.5 text-foreground break-words">
                            {row.delivery_address?.trim() || '—'}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <SignupActions
                      id={row.id}
                      defaultBusinessName={row.business_name ?? ''}
                      tiers={tiers}
                    />
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
              No reviewed sign-ups yet.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-sidebar">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                    Customer / Business
                  </TableHead>
                  <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                    Type &amp; Tier
                  </TableHead>
                  <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                    Telegram
                  </TableHead>
                  <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                    Outcome
                  </TableHead>
                  <TableHead className="px-4 text-right text-xs font-medium text-muted-foreground">
                    Decided
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentDecisions.map((row) => {
                  const customer = one(row.customers);
                  const tier = one(customer?.tiers);
                  const outcome = outcomeLabel(row.status);
                  const isApproved = row.status === 'approved';
                  const trimmedBusiness = row.business_name?.trim() || null;
                  const trimmedContact = row.contact_name?.trim() || null;
                  const primaryName = isApproved
                    ? customer?.name || trimmedBusiness || 'Unnamed business'
                    : trimmedBusiness || 'Unnamed business';
                  const secondaryName =
                    isApproved && trimmedBusiness && trimmedBusiness !== primaryName
                      ? trimmedBusiness
                      : trimmedContact;
                  const telegram = telegramIdentity(row);

                  return (
                    <TableRow key={row.id} className="hover:bg-sidebar/70">
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">
                            {primaryName}
                          </span>
                          {secondaryName ? (
                            <span className="text-xs text-muted-foreground">
                              {secondaryName}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {isApproved ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm text-foreground">
                              {customer?.kind ? statusLabel(customer.kind) : '—'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {tier?.name ?? '—'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm text-foreground">
                            {telegram.primary}
                          </span>
                          {telegram.secondary ? (
                            <span className="text-xs text-muted-foreground font-mono">
                              {telegram.secondary}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge variant="outline" className="gap-1.5 font-medium">
                          <span
                            aria-hidden="true"
                            className={cn(
                              'size-1.5 rounded-full shrink-0',
                              isApproved
                                ? 'bg-[var(--dot-green)]'
                                : 'bg-[var(--dot-zinc)]'
                            )}
                          />
                          {outcome}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
                        {formatDateTime(row.decided_at)}
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
