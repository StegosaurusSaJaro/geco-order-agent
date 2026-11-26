import { Suspense } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { LiveRefresh } from '@/components/LiveRefresh';
import { OrdersCharts } from '@/components/OrdersCharts';
import { OrdersFilters } from '@/components/OrdersFilters';
import { Pagination } from '@/components/Pagination';
import { ReportsSkeleton } from '@/components/ReportsSkeleton';
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
import {
  buildChartData,
  buildFilterQuery,
  fetchOrdersData,
  hasActiveFilters,
  parseOrderFilters,
  type OrderFilters,
} from '@/lib/orders';
import { pageWindow, parsePage, slicePage } from '@/lib/pagination';
import { getSupabaseConfig, requireUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const REPORTS_PAGE_SIZE = 10;

type ReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type SupabaseServerClient = Awaited<ReturnType<typeof requireUser>>['supabase'];

async function ReportsContent({
  supabase,
  filters,
  requestedPage,
}: {
  supabase: SupabaseServerClient;
  filters: OrderFilters;
  requestedPage: number;
}) {
  const { orders, lines, tiers, error } = await fetchOrdersData(supabase, filters);

  const chartData = buildChartData(orders, lines, filters);
  const currency = orders[0]?.currency ?? 'USD';
  const totalSales = Math.round(orders.reduce((sum, order) => sum + order.total, 0) * 100) / 100;
  const filtered = hasActiveFilters(filters);
  const pages = pageWindow(requestedPage, orders.length, REPORTS_PAGE_SIZE);
  const pageOrders = slicePage(orders, pages);
  const filterParams = Object.fromEntries(new URLSearchParams(buildFilterQuery(filters)));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] leading-tight">Reports</h1>
          <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
            {orders.length} {orders.length === 1 ? 'order' : 'orders'}
            {' · '}
            {formatCurrency(totalSales, currency)}
            {filtered ? ' (filtered)' : ''}
          </p>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>Failed to load orders: {error}</AlertDescription>
        </Alert>
      ) : null}

      <OrdersFilters filters={filters} tiers={tiers} basePath="/reports" />

      <OrdersCharts data={chartData} currency={currency} />

      <Card className="py-0 gap-0 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
          <CardTitle className="text-[13.5px] font-semibold">Order List</CardTitle>
          <span className="text-xs text-muted-foreground tabular-nums">
            {orders.length} {orders.length === 1 ? 'order' : 'orders'} · {lines.length}{' '}
            {lines.length === 1 ? 'line' : 'lines'}
          </span>
        </CardHeader>
        {orders.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {filtered ? 'No orders match the selected filters.' : 'No orders yet.'}
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
              {pageOrders.map((order) => (
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
        <Pagination pages={pages} basePath="/reports" params={filterParams} itemLabel="orders" />
      </Card>
    </>
  );
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const filters = parseOrderFilters(params);
  const requestedPage = parsePage(params);
  const suspenseKey = `${buildFilterQuery(filters)}&page=${requestedPage}`;

  return (
    <>
      <LiveRefresh
        {...getSupabaseConfig()}
        channelName="reports"
        subscriptions={[{ table: 'orders', event: '*' }]}
      />
      <AppShell email={user.email} active="reports" breadcrumb={[{ label: 'Reports' }]}>
        <Suspense key={suspenseKey} fallback={<ReportsSkeleton />}>
          <ReportsContent
            supabase={supabase}
            filters={filters}
            requestedPage={requestedPage}
          />
        </Suspense>
      </AppShell>
    </>
  );
}
