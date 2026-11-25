import Link from 'next/link';
import { AlertCircle, ArrowUpRight } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { LiveRefresh } from '@/components/LiveRefresh';
import { NeedsReviewList } from '@/components/NeedsReviewList';
import { Pagination } from '@/components/Pagination';
import { StatusBadge, TierBadge } from '@/components/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDateTime, shortId } from '@/lib/format';
import { fetchHomeOrdersData, formatWaitingAge, LOW_STOCK_PACKS } from '@/lib/orders';
import { pageWindow, parsePage } from '@/lib/pagination';
import { getSupabaseConfig, requireUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ORDERS_PAGE_SIZE = 20;

type OrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const requestedPage = parsePage(params);
  const now = new Date();
  const nowMs = now.getTime();
  const {
    heldOrders,
    ordersToday,
    ordersYesterday,
    lowStockCount,
    recentOrders,
    totalOrders,
    error,
  } = await fetchHomeOrdersData(supabase, requestedPage, ORDERS_PAGE_SIZE, now);

  const pages = pageWindow(requestedPage, totalOrders, ORDERS_PAGE_SIZE);
  const oldestHeld = heldOrders[0] ?? null;
  const needsReviewFoot = oldestHeld
    ? `Oldest waiting ${formatWaitingAge(oldestHeld.updated_at, nowMs)}`
    : 'None waiting';

  return (
    <>
      <LiveRefresh
        {...getSupabaseConfig()}
        channelName="orders"
        subscriptions={[{ table: 'orders', event: '*' }]}
      />
      <AppShell email={user.email} active="orders" breadcrumb={[{ label: 'Orders' }]}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.025em] leading-tight">Orders</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Held orders needing action and recent wholesale orders.
            </p>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>Failed to load orders: {error}</AlertDescription>
          </Alert>
        ) : null}

        <section
          aria-label="Order desk metrics"
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          <a
            href="#needs-review"
            className="grid gap-1.5 rounded-lg border border-border bg-card px-4 py-3.5 text-left shadow-xs transition-colors hover:bg-sidebar"
          >
            <div className="flex items-center justify-between text-[12.5px] font-medium text-muted-foreground">
              <span>Needs review</span>
              {heldOrders.length > 0 ? (
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full bg-[var(--dot-amber)] ring-1 ring-amber-900/20"
                />
              ) : null}
            </div>
            <div className="text-2xl font-semibold tracking-[-0.03em] leading-tight tabular-nums text-foreground">
              {heldOrders.length}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">{needsReviewFoot}</div>
          </a>

          <div className="grid gap-1.5 rounded-lg border border-border bg-card px-4 py-3.5 text-left shadow-xs">
            <div className="flex items-center justify-between text-[12.5px] font-medium text-muted-foreground">
              <span>Orders today</span>
            </div>
            <div className="text-2xl font-semibold tracking-[-0.03em] leading-tight tabular-nums text-foreground">
              {ordersToday}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              Yesterday {ordersYesterday}
            </div>
          </div>

          <Link
            href="/inventory"
            className="grid gap-1.5 rounded-lg border border-border bg-card px-4 py-3.5 text-left shadow-xs transition-colors hover:bg-sidebar"
          >
            <div className="flex items-center justify-between text-[12.5px] font-medium text-muted-foreground">
              <span>Low stock</span>
              {lowStockCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full bg-[var(--dot-amber)] ring-1 ring-amber-900/20"
                />
              ) : null}
            </div>
            <div className="text-2xl font-semibold tracking-[-0.03em] leading-tight tabular-nums text-foreground">
              {lowStockCount}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              At or below {LOW_STOCK_PACKS} packs
            </div>
          </Link>
        </section>

        <NeedsReviewList orders={heldOrders} nowMs={nowMs} />

        <Card className="py-0 gap-0 overflow-hidden">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-[13.5px] font-semibold">Recent Orders</CardTitle>
              <span className="text-xs text-muted-foreground tabular-nums">
                {totalOrders} {totalOrders === 1 ? 'order' : 'orders'}
              </span>
            </div>
            <Link
              href="/reports"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-[var(--brand-crimson)] hover:underline underline-offset-4"
            >
              Filters and charts in Reports
              <ArrowUpRight className="size-3.5" />
            </Link>
          </CardHeader>
          {totalOrders === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No orders yet.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-sidebar">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                    Order
                  </TableHead>
                  <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                    Customer
                  </TableHead>
                  <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                    Tier
                  </TableHead>
                  <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="px-4 text-right text-xs font-medium text-muted-foreground">
                    Total
                  </TableHead>
                  <TableHead className="px-4 text-right text-xs font-medium text-muted-foreground">
                    Time
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-sidebar/70">
                    <TableCell className="px-4 py-3">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-medium text-foreground hover:text-[var(--brand-crimson)] hover:underline underline-offset-4"
                      >
                        <span className="font-mono tabular-nums">#{shortId(order.id)}</span>
                        {order.po_number ? (
                          <span className="font-mono tabular-nums text-muted-foreground">
                            {' · '}
                            {order.po_number}
                          </span>
                        ) : null}
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-3">{order.customer_name}</TableCell>
                    <TableCell className="px-4 py-3">
                      {order.tier_code ? (
                        <TierBadge name={order.tier_name} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono tabular-nums">
                      {formatCurrency(order.total, order.currency)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
                      {formatDateTime(order.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Pagination pages={pages} basePath="/orders" itemLabel="orders" />
        </Card>
      </AppShell>
    </>
  );
}
