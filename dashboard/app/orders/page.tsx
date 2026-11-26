import { Suspense } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowUpRight } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { LiveRefresh } from '@/components/LiveRefresh';
import { NeedsReviewList } from '@/components/NeedsReviewList';
import { OrdersSkeleton } from '@/components/OrdersSkeleton';
import { LowStockPanel } from '@/components/orders-home/LowStockPanel';
import { OrdersMetricsStrip } from '@/components/orders-home/OrdersMetricsStrip';
import { RecentOrdersTable } from '@/components/orders-home/RecentOrdersTable';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { fetchHomeOrdersData, formatWaitingAge, LOW_STOCK_PACKS } from '@/lib/orders';
import { pageWindow, parsePage } from '@/lib/pagination';
import { getSupabaseConfig, requireUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ORDERS_PAGE_SIZE = 8;

type OrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type SupabaseServerClient = Awaited<ReturnType<typeof requireUser>>['supabase'];

async function OrdersContent({
  supabase,
  requestedPage,
}: {
  supabase: SupabaseServerClient;
  requestedPage: number;
}) {
  const now = new Date();
  const nowMs = now.getTime();
  const {
    heldOrders,
    ordersToday,
    ordersYesterday,
    lowStockCount,
    lowStockItems,
    recentOrders,
    totalOrders,
    error,
  } = await fetchHomeOrdersData(supabase, requestedPage, ORDERS_PAGE_SIZE, now);

  const pages = pageWindow(requestedPage, totalOrders, ORDERS_PAGE_SIZE);
  const oldestHeld = heldOrders[0] ?? null;
  const oldestHeldAge = oldestHeld ? formatWaitingAge(oldestHeld.updated_at, nowMs) : null;

  return (
    <>
      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>Failed to load orders: {error}</AlertDescription>
        </Alert>
      ) : null}

      <OrdersMetricsStrip
        heldCount={heldOrders.length}
        oldestHeldAge={oldestHeldAge}
        ordersToday={ordersToday}
        ordersYesterday={ordersYesterday}
        lowStockCount={lowStockCount}
        lowStockThreshold={LOW_STOCK_PACKS}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 min-w-0">
          <NeedsReviewList orders={heldOrders} nowMs={nowMs} />
        </div>
        <div className="lg:col-span-5 min-w-0">
          <LowStockPanel
            items={lowStockItems}
            totalCount={lowStockCount}
            threshold={LOW_STOCK_PACKS}
          />
        </div>
      </div>

      <RecentOrdersTable orders={recentOrders} totalOrders={totalOrders} pages={pages} />
    </>
  );
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const requestedPage = parsePage(params);

  return (
    <>
      <LiveRefresh
        {...getSupabaseConfig()}
        channelName="orders"
        subscriptions={[{ table: 'orders', event: '*' }]}
      />
      <AppShell email={user.email} active="orders" breadcrumb={[{ label: 'Orders' }]}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.025em] leading-tight text-foreground">
              Orders
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Held orders needing action, low-stock alerts, and recent wholesale orders.
            </p>
          </div>
          <Link
            href="/reports"
            className="inline-flex items-center gap-1 rounded-sm px-1 py-1.5 -my-1.5 text-xs font-medium text-muted-foreground transition-[color,transform] duration-150 ease-out hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2"
          >
            Reports
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        <Suspense key={`page=${requestedPage}`} fallback={<OrdersSkeleton />}>
          <OrdersContent supabase={supabase} requestedPage={requestedPage} />
        </Suspense>
      </AppShell>
    </>
  );
}
