import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { OrdersCharts } from '@/components/OrdersCharts';
import { OrdersFilters } from '@/components/OrdersFilters';
import { formatCurrency, formatDateTime, shortId, statusLabel } from '@/lib/format';
import {
  buildChartData,
  fetchOrdersData,
  hasActiveFilters,
  parseOrderFilters,
} from '@/lib/orders';
import { getSupabaseConfig, requireUser } from '@/lib/supabase';
import { LiveRefresh } from '@/components/LiveRefresh';

export const dynamic = 'force-dynamic';

type OrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const { supabase, user } = await requireUser();
  const filters = parseOrderFilters(await searchParams);
  const { orders, lines, tiers, error } = await fetchOrdersData(supabase, filters);

  const chartData = buildChartData(orders, lines, filters);
  const currency = orders[0]?.currency ?? 'USD';
  const totalSales = Math.round(orders.reduce((sum, order) => sum + order.total, 0) * 100) / 100;
  const filtered = hasActiveFilters(filters);

  return (
    <>
      <Nav email={user.email} active="orders" />
      <LiveRefresh
        {...getSupabaseConfig()}
        channelName="orders"
        subscriptions={[{ table: 'orders', event: '*' }]}
      />
      <main className="container">
        <div className="page-header">
          <div className="page-row">
            <div>
              <h1 className="page-title">Orders</h1>
              <p className="page-subtitle">
                {orders.length} {orders.length === 1 ? 'order' : 'orders'}
                {' · '}
                {formatCurrency(totalSales, currency)}
                {filtered ? ' (filtered)' : ''}
              </p>
            </div>
          </div>
        </div>

        {error ? <div className="error-box">Failed to load orders: {error}</div> : null}

        <OrdersFilters filters={filters} tiers={tiers} />

        <OrdersCharts data={chartData} currency={currency} />

        <div className="card">
          <div className="card-header">
            <span>Order List</span>
            <span className="muted">
              {orders.length} {orders.length === 1 ? 'order' : 'orders'} · {lines.length}{' '}
              {lines.length === 1 ? 'line' : 'lines'}
            </span>
          </div>
          {orders.length === 0 ? (
            <div className="empty">
              {filtered ? 'No orders match the selected filters.' : 'No orders yet.'}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Tier</th>
                    <th>Status</th>
                    <th className="num">Total</th>
                    <th className="num">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link href={`/orders/${order.id}`} className="row-link">
                          <span className="mono">#{shortId(order.id)}</span>
                          {order.po_number ? <span> · {order.po_number}</span> : null}
                        </Link>
                      </td>
                      <td>{order.customer_name}</td>
                      <td>
                        {order.tier_code ? (
                          <span className="badge badge-tier">{order.tier_name}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-${order.status}`}>
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="num">{formatCurrency(order.total, order.currency)}</td>
                      <td className="num">{formatDateTime(order.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
