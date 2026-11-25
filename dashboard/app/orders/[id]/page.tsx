import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Nav } from '@/components/Nav';
import { formatCurrency, formatDateTime, one, shortId, statusLabel } from '@/lib/format';
import { getSupabaseConfig, requireUser } from '@/lib/supabase';
import { LiveRefresh } from '@/components/LiveRefresh';
import { OrderReviewActions, reviewReasonLabel } from './OrderReviewActions';

export const dynamic = 'force-dynamic';

type CustomerRow = { name: string; tiers: { name: string } | { name: string }[] | null };
type OrderDetailRow = {
  id: string; conversation_id: string; status: string; source: string; po_number: string | null;
  version: number; currency: string; total: number | string; review_reasons: string[] | null;
  confirmed_at: string | null; created_at: string; customers: CustomerRow | CustomerRow[] | null;
};
type ProductInfo = { name: string; stock_qty: number | string };
type OrderLineRow = {
  line_no: number; sku: string; quantity: number | string; unit_code: string;
  unit_price: number | string; line_total: number | string;
  products: ProductInfo | ProductInfo[] | null;
};
type MessageRow = {
  id: string; direction: string; author: string; kind: string;
  body: string | null; file_name: string | null; created_at: string;
};
type OrderMessageLinkRow = { message_id: string; messages: MessageRow | MessageRow[] | null };

function formatQty(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('id, conversation_id, status, source, po_number, version, currency, total, review_reasons, confirmed_at, created_at, customers(name, tiers(name))')
    .eq('id', id)
    .maybeSingle();

  if (orderError) {
    return (
      <>
        <Nav email={user.email} active="orders" />
        <main className="container">
          <Link href="/orders" className="back-link">← Back to Orders</Link>
          <div className="error-box">Failed to load order: {orderError.message}</div>
        </main>
      </>
    );
  }
  if (!orderData) notFound();

  const order = orderData as OrderDetailRow;
  const [linesRes, linksRes] = await Promise.all([
    supabase
      .from('order_lines')
      .select('line_no, sku, quantity, unit_code, unit_price, line_total, products(name, stock_qty)')
      .eq('order_id', id).eq('version', order.version).order('line_no', { ascending: true }),
    supabase
      .from('order_messages')
      .select('message_id, messages(id, direction, author, kind, body, file_name, created_at)')
      .eq('order_id', id),
  ]);

  const lines = (linesRes.data ?? []) as OrderLineRow[];
  const linkedMessages = ((linksRes.data ?? []) as OrderMessageLinkRow[])
    .map((row) => one(row.messages))
    .filter((msg): msg is MessageRow => msg !== null)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));

  const customer = one(order.customers);
  const tier = one(customer?.tiers);
  const reviewReasons = Array.isArray(order.review_reasons) ? order.review_reasons : [];
  const meta = [
    ['Customer', customer?.name ?? '—'],
    ['Tier', tier ? <span className="badge badge-tier">{tier.name}</span> : '—'],
    ['Source', statusLabel(order.source)],
    ['PO Number', order.po_number ? <span className="mono">{order.po_number}</span> : '—'],
    ['Total', formatCurrency(order.total, order.currency)],
    ['Created', formatDateTime(order.created_at)],
    ['Confirmed', formatDateTime(order.confirmed_at)],
  ] as const;

  return (
    <>
      <Nav email={user.email} active="orders" />
      <LiveRefresh
        {...getSupabaseConfig()}
        channelName={`order-${order.id}`}
        subscriptions={[
          { table: 'orders', event: 'UPDATE', filter: `id=eq.${order.id}` },
          { table: 'messages', event: 'INSERT', filter: `conversation_id=eq.${order.conversation_id}` },
        ]}
      />
      <main className="container">
        <div className="page-header">
          <Link href="/orders" className="back-link">← Back to Orders</Link>
          <div className="page-row">
            <div>
              <h1 className="page-title">Order <span className="mono">#{shortId(order.id)}</span></h1>
              <p className="page-subtitle">{customer?.name ?? 'Unknown customer'} · v{order.version}</p>
            </div>
            <Link href={`/conversations/${order.conversation_id}`} className="btn btn-ghost">View full chat</Link>
          </div>
        </div>

        <OrderReviewActions
          orderId={order.id}
          status={order.status}
          reviewReasons={reviewReasons}
        />

        <section className="card">
          <div className="card-header">
            <span>Order Summary</span>
            <span className={`badge badge-${order.status}`}>{statusLabel(order.status)}</span>
          </div>
          <div className="card-body">
            <div className="meta-grid">
              {meta.map(([label, val]) => (
                <div key={label} className="meta-item">
                  <span className="meta-label">{label}</span>
                  <span className="meta-value">{val}</span>
                </div>
              ))}
            </div>
            {order.status !== 'needs_review' && reviewReasons.length > 0 ? (
              <div className="meta-item" style={{ marginTop: '14px' }}>
                <span className="meta-label">Review Reasons</span>
                <div className="msg-tags">{reviewReasons.map((r) => <span key={r} className="badge badge-needs_review">{reviewReasonLabel(r)}</span>)}</div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <span>Order Lines</span>
            <span className="page-subtitle">{lines.length} {lines.length === 1 ? 'line' : 'lines'}</span>
          </div>
          {linesRes.error ? (
            <div className="card-body"><div className="error-box">Failed to load order lines: {linesRes.error.message}</div></div>
          ) : lines.length === 0 ? (
            <div className="empty">No order lines found.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="num">#</th><th>SKU</th><th>Product</th><th className="num">Qty</th>
                    <th className="num">Stock</th><th>Unit</th><th className="num">Unit Price</th><th className="num">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const product = one(line.products);
                    const qty = Number(line.quantity);
                    const stockQty = product?.stock_qty !== undefined && product?.stock_qty !== null ? Number(product.stock_qty) : null;
                    const isShort = stockQty !== null && Number.isFinite(stockQty) && Number.isFinite(qty) && stockQty < qty;
                    return (
                      <tr key={line.line_no} className={isShort ? 'row-short' : undefined}>
                        <td className="num">{line.line_no}</td>
                        <td className="mono">{line.sku}</td>
                        <td>{product?.name ?? '—'}</td>
                        <td className="num">{formatQty(line.quantity)}</td>
                        <td className="num">
                          <span className="stock-cell">
                            <span>{formatQty(product?.stock_qty)}</span>
                            {isShort ? <span className="badge badge-short">Short</span> : null}
                          </span>
                        </td>
                        <td>{line.unit_code}</td>
                        <td className="num">{formatCurrency(line.unit_price, order.currency)}</td>
                        <td className="num">{formatCurrency(line.line_total, order.currency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={7} className="num" style={{ fontWeight: 600 }}>Total</td>
                    <td className="num" style={{ fontWeight: 700 }}>{formatCurrency(order.total, order.currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <span>Linked Messages</span>
            <span className="page-subtitle">{linkedMessages.length} {linkedMessages.length === 1 ? 'message' : 'messages'}</span>
          </div>
          <div className="card-body">
            {linksRes.error ? (
              <div className="error-box">Failed to load linked messages: {linksRes.error.message}</div>
            ) : linkedMessages.length === 0 ? (
              <div className="empty">No messages linked to this order.</div>
            ) : (
              <div className="chat-list">
                {linkedMessages.map((msg) => (
                  <div key={msg.id} className={`msg-row ${msg.direction === 'in' ? 'msg-in' : 'msg-out'}`}>
                    <div className="msg-meta">
                      <span>{statusLabel(msg.author)}</span><span>·</span>
                      <span>{msg.direction}</span><span>·</span>
                      <span>{msg.kind}</span><span>·</span>
                      <span>{formatDateTime(msg.created_at)}</span>
                    </div>
                    <div className="msg-bubble">
                      {msg.file_name ? <div style={{ marginBottom: msg.body ? '6px' : 0 }}><span className="badge badge-file">{msg.file_name}</span></div> : null}
                      {msg.body ? <div className="msg-body">{msg.body}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
