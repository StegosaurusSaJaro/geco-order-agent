import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { formatCurrency, formatDateTime, one, shortId, statusLabel } from '@/lib/format';
import { requireUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type CustomerRow = { name: string; tiers: { name: string } | { name: string }[] | null };
type OrderListRow = {
  id: string;
  status: string;
  po_number: string | null;
  currency: string;
  total: number | string;
  created_at: string;
  customers: CustomerRow | CustomerRow[] | null;
};

export default async function OrdersPage() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, po_number, currency, total, created_at, customers(name, tiers(name))')
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as OrderListRow[];

  return (
    <>
      <Nav email={user.email} active="orders" />
      <main className="container">
        <div className="page-header">
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">{rows.length} {rows.length === 1 ? 'order' : 'orders'}</p>
        </div>
        {error ? <div className="error-box">Failed to load orders: {error.message}</div> : null}
        <div className="card">
          {rows.length === 0 ? (
            <div className="empty">No orders yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order</th><th>Customer</th><th>Tier</th><th>Status</th>
                    <th className="num">Total</th><th className="num">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((order) => {
                    const customer = one(order.customers);
                    const tier = one(customer?.tiers);
                    return (
                      <tr key={order.id}>
                        <td>
                          <Link href={`/orders/${order.id}`} className="row-link">
                            <span className="mono">#{shortId(order.id)}</span>
                            {order.po_number ? <span> · {order.po_number}</span> : null}
                          </Link>
                        </td>
                        <td>{customer?.name ?? '—'}</td>
                        <td>{tier ? <span className="badge badge-tier">{tier.name}</span> : '—'}</td>
                        <td><span className={`badge badge-${order.status}`}>{statusLabel(order.status)}</span></td>
                        <td className="num">{formatCurrency(order.total, order.currency)}</td>
                        <td className="num">{formatDateTime(order.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
