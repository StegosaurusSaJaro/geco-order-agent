import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertCircle, ArrowLeft, ChevronDown, MessageSquare, Paperclip, Printer } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { LiveRefresh } from '@/components/LiveRefresh';
import { StatusBadge, TierBadge } from '@/components/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  formatCurrency,
  formatDateTime,
  one,
  reviewReasonLabel,
  shortId,
  statusLabel,
} from '@/lib/format';
import { getSupabaseConfig, requireUser } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { OrderReviewActions } from './OrderReviewActions';

export const dynamic = 'force-dynamic';

type CustomerRow = { name: string; tiers: { name: string } | { name: string }[] | null };
type OrderDetailRow = {
  id: string;
  conversation_id: string;
  status: string;
  source: string;
  po_number: string | null;
  version: number;
  currency: string;
  total: number | string;
  review_reasons: string[] | null;
  confirmed_at: string | null;
  created_at: string;
  customers: CustomerRow | CustomerRow[] | null;
};
type ProductInfo = { name: string; stock_qty: number | string };
type OrderLineRow = {
  line_no: number;
  sku: string;
  quantity: number | string;
  unit_code: string;
  unit_price: number | string;
  line_total: number | string;
  products: ProductInfo | ProductInfo[] | null;
};
type MessageRow = {
  id: string;
  direction: string;
  author: string;
  kind: string;
  body: string | null;
  file_name: string | null;
  created_at: string;
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
    .select(
      'id, conversation_id, status, source, po_number, version, currency, total, review_reasons, confirmed_at, created_at, customers(name, tiers(name))'
    )
    .eq('id', id)
    .maybeSingle();

  if (orderError) {
    return (
      <AppShell
        email={user.email}
        active="orders"
        breadcrumb={[{ label: 'Orders', href: '/orders' }, { label: 'Order' }]}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders">
              <ArrowLeft className="size-3.5" />
              Back to Orders
            </Link>
          </Button>
        </div>
        <Alert
          variant="destructive"
          className="border-destructive/40 bg-[var(--destructive-soft)]"
        >
          <AlertCircle className="size-4" />
          <AlertDescription>
            Failed to load order: {orderError.message}
          </AlertDescription>
        </Alert>
      </AppShell>
    );
  }
  if (!orderData) notFound();

  const order = orderData as OrderDetailRow;
  const [linesRes, linksRes] = await Promise.all([
    supabase
      .from('order_lines')
      .select('line_no, sku, quantity, unit_code, unit_price, line_total, products(name, stock_qty)')
      .eq('order_id', id)
      .eq('version', order.version)
      .order('line_no', { ascending: true }),
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
    ['Tier', tier ? <TierBadge name={tier.name} /> : '—'],
    ['Source', statusLabel(order.source)],
    ['PO Number', order.po_number ? <span className="font-mono">{order.po_number}</span> : '—'],
    ['Total', <span className="font-semibold tabular-nums">{formatCurrency(order.total, order.currency)}</span>],
    ['Created', formatDateTime(order.created_at)],
    ['Confirmed', formatDateTime(order.confirmed_at)],
  ] as const;

  return (
    <AppShell
      email={user.email}
      active="orders"
      breadcrumb={[
        { label: 'Orders', href: '/orders' },
        { label: `#${shortId(order.id)}` },
      ]}
    >
      <LiveRefresh
        {...getSupabaseConfig()}
        channelName={`order-${order.id}`}
        subscriptions={[
          { table: 'orders', event: 'UPDATE', filter: `id=eq.${order.id}` },
          { table: 'messages', event: 'INSERT', filter: `conversation_id=eq.${order.conversation_id}` },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight">
              Order <span className="font-mono">#{shortId(order.id)}</span>
            </h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {customer?.name ?? 'Unknown customer'} · v{order.version}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders">
              <ArrowLeft className="size-3.5" />
              Back to Orders
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/conversations/${order.conversation_id}`}>
              <MessageSquare className="size-3.5" />
              View full chat
            </Link>
          </Button>
          {order.status === 'confirmed' || order.status === 'fulfilled' ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/orders/${order.id}/receipt`}>
                <Printer className="size-3.5" />
                Print receipt
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <OrderReviewActions
        orderId={order.id}
        status={order.status}
        reviewReasons={reviewReasons}
      />

      <Card className="gap-0 py-0 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b py-4">
          <CardTitle className="text-base">Order Summary</CardTitle>
          <StatusBadge status={order.status} />
        </CardHeader>
        <CardContent className="py-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {meta.map(([label, val]) => (
              <div key={label} className="flex flex-col gap-1 min-w-0">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                <span className="text-sm font-medium text-foreground break-words">{val}</span>
              </div>
            ))}
          </div>
          {order.status !== 'needs_review' && reviewReasons.length > 0 ? (
            <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-4">
              <span className="text-xs font-medium text-muted-foreground">Review Reasons</span>
              <div className="flex flex-wrap gap-1.5">
                {reviewReasons.map((r) => (
                  <Badge key={r} variant="outline" className="gap-1.5 font-medium">
                    <span
                      aria-hidden="true"
                      className="size-1.5 shrink-0 rounded-full bg-[var(--dot-amber)] ring-1 ring-foreground/15"
                    />
                    {reviewReasonLabel(r)}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="gap-0 py-0 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b py-4">
          <CardTitle className="text-base">Order Lines</CardTitle>
          <CardDescription>
            {lines.length} {lines.length === 1 ? 'line' : 'lines'}
          </CardDescription>
        </CardHeader>
        {linesRes.error ? (
          <CardContent className="py-5">
            <Alert
              variant="destructive"
              className="border-destructive/40 bg-[var(--destructive-soft)]"
            >
              <AlertCircle className="size-4" />
              <AlertDescription>
                Failed to load order lines: {linesRes.error.message}
              </AlertDescription>
            </Alert>
          </CardContent>
        ) : lines.length === 0 ? (
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No order lines found.
          </CardContent>
        ) : (
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6 text-right">#</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="pr-6 text-right">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => {
                  const product = one(line.products);
                  const qty = Number(line.quantity);
                  const stockQty =
                    product?.stock_qty !== undefined && product?.stock_qty !== null
                      ? Number(product.stock_qty)
                      : null;
                  const isShort =
                    stockQty !== null &&
                    Number.isFinite(stockQty) &&
                    Number.isFinite(qty) &&
                    stockQty < qty;
                  return (
                    <TableRow
                      key={line.line_no}
                      className={isShort ? 'bg-red-50/70 hover:bg-red-50' : undefined}
                    >
                      <TableCell className="pl-6 text-right tabular-nums text-muted-foreground">
                        {line.line_no}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{line.sku}</TableCell>
                      <TableCell className="max-w-[260px] whitespace-normal">
                        {product?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQty(line.quantity)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="inline-flex items-center justify-end gap-1.5">
                          <span>{formatQty(product?.stock_qty)}</span>
                          {isShort ? (
                            <Badge
                              variant="outline"
                              className="gap-1 border-destructive/40 bg-red-50 text-destructive"
                            >
                              <span
                                aria-hidden="true"
                                className="size-1.5 shrink-0 rounded-full bg-[var(--dot-red)]"
                              />
                              Short
                            </Badge>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>{line.unit_code}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(line.unit_price, order.currency)}
                      </TableCell>
                      <TableCell className="pr-6 text-right font-medium tabular-nums">
                        {formatCurrency(line.line_total, order.currency)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="pl-6 text-right font-semibold">
                    Total
                  </TableCell>
                  <TableCell className="pr-6 text-right font-bold tabular-nums">
                    {formatCurrency(order.total, order.currency)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        )}
      </Card>

      <Card className="gap-0 py-0 overflow-hidden">
        <details className="group">
          <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-6 py-4 list-none [&::-webkit-details-marker]:hidden group-open:border-b hover:bg-muted/40 transition-colors">
            <span className="text-base leading-none font-semibold">Linked Messages</span>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {linkedMessages.length} {linkedMessages.length === 1 ? 'message' : 'messages'}
              </span>
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <CardContent className="py-5">
            {linksRes.error ? (
              <Alert
                variant="destructive"
                className="border-destructive/40 bg-[var(--destructive-soft)]"
              >
                <AlertCircle className="size-4" />
                <AlertDescription>
                  Failed to load linked messages: {linksRes.error.message}
                </AlertDescription>
              </Alert>
            ) : linkedMessages.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No messages linked to this order.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {linkedMessages.map((msg) => {
                  const isIncoming = msg.direction === 'in';
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex flex-col gap-1 min-w-0',
                        isIncoming ? 'items-start' : 'items-end'
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">
                          {statusLabel(msg.author)}
                        </span>
                        <span>·</span>
                        <span>{msg.direction}</span>
                        <span>·</span>
                        <span>{msg.kind}</span>
                        <span>·</span>
                        <span>{formatDateTime(msg.created_at)}</span>
                      </div>
                      <div
                        className={cn(
                          'max-w-full sm:max-w-[85%] rounded-lg border border-border px-3.5 py-2.5 text-sm leading-relaxed break-words',
                          isIncoming ? 'bg-card' : 'bg-sidebar'
                        )}
                      >
                        {msg.file_name ? (
                          <div className={msg.body ? 'mb-1.5' : undefined}>
                            <Badge variant="secondary" className="max-w-full gap-1 font-mono text-xs">
                              <Paperclip className="size-3 shrink-0" />
                              <span className="truncate">{msg.file_name}</span>
                            </Badge>
                          </div>
                        ) : null}
                        {msg.body ? (
                          <div className="whitespace-pre-wrap break-words">{msg.body}</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </details>
      </Card>
    </AppShell>
  );
}
