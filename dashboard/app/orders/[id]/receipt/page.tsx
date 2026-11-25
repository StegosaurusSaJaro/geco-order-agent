import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { PrintReceiptButton } from '@/components/PrintReceiptButton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDateTime, one, shortId } from '@/lib/format';
import { requireUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type CustomerRow = { name: string; tiers: { name: string } | { name: string }[] | null };
type OrderReceiptRow = {
  id: string;
  status: string;
  po_number: string | null;
  version: number;
  currency: string;
  total: number | string;
  confirmed_at: string | null;
  created_at: string;
  customers: CustomerRow | CustomerRow[] | null;
};
type ProductInfo = { name: string };
type OrderLineRow = {
  line_no: number;
  sku: string;
  quantity: number | string;
  unit_code: string;
  unit_price: number | string;
  line_total: number | string;
  products: ProductInfo | ProductInfo[] | null;
};

function formatQty(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

export default async function OrderReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select(
      'id, status, po_number, version, currency, total, confirmed_at, created_at, customers(name, tiers(name))'
    )
    .eq('id', id)
    .maybeSingle();

  if (orderError) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/orders/${id}`}>
              <ArrowLeft className="size-3.5" />
              Back to Order
            </Link>
          </Button>
          <Alert
            variant="destructive"
            className="border-destructive/40 bg-[var(--destructive-soft)]"
          >
            <AlertCircle className="size-4" />
            <AlertDescription>
              Failed to load order receipt: {orderError.message}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!orderData) notFound();

  const order = orderData as OrderReceiptRow;
  const { data: linesData, error: linesError } = await supabase
    .from('order_lines')
    .select('line_no, sku, quantity, unit_code, unit_price, line_total, products(name)')
    .eq('order_id', id)
    .eq('version', order.version)
    .order('line_no', { ascending: true });

  const lines = (linesData ?? []) as OrderLineRow[];
  const customer = one(order.customers);
  const tier = one(customer?.tiers);
  const orderRef = order.po_number ? order.po_number : `#${shortId(order.id)}`;
  const receiptDate = formatDateTime(order.confirmed_at ?? order.created_at);

  return (
    <div className="min-h-screen bg-muted/60 px-4 py-6 print:min-h-0 print:bg-white print:p-0">
      <style>{`@page { size: A4; margin: 14mm; } @media print { html, body { background: #ffffff !important; } }`}</style>

      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 print:hidden">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/orders/${id}`}>
            <ArrowLeft className="size-3.5" />
            Back to Order
          </Link>
        </Button>
        <PrintReceiptButton />
      </div>

      <article className="mx-auto max-w-[210mm] rounded-md border border-border bg-white p-10 text-foreground shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-start justify-between border-b border-border pb-6">
          <div>
            <div className="text-xl font-bold tracking-tight">GECO Asia</div>
            <div className="mt-1 text-sm font-medium text-muted-foreground">
              Order confirmation
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="font-mono font-semibold">{orderRef}</div>
            <div className="mt-1 text-muted-foreground">{receiptDate} (Asia/Manila)</div>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-4 border-b border-border pb-6 text-sm">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Customer
            </div>
            <div className="mt-1 font-medium">{customer?.name ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tier
            </div>
            <div className="mt-1 font-medium">{tier?.name ?? '—'}</div>
          </div>
        </section>

        <section className="mt-6">
          {linesError ? (
            <Alert
              variant="destructive"
              className="border-destructive/40 bg-[var(--destructive-soft)]"
            >
              <AlertCircle className="size-4" />
              <AlertDescription>
                Failed to load order lines: {linesError.message}
              </AlertDescription>
            </Alert>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">SKU</th>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 px-3 text-right">Quantity</th>
                  <th className="py-2 px-3">Unit</th>
                  <th className="py-2 px-3 text-right">Unit Price</th>
                  <th className="py-2 pl-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      No order lines found.
                    </td>
                  </tr>
                ) : (
                  lines.map((line) => {
                    const product = one(line.products);
                    return (
                      <tr key={line.line_no} className="border-b border-border/60">
                        <td className="py-2.5 pr-3 font-mono text-xs">{line.sku}</td>
                        <td className="py-2.5 pr-3">{product?.name ?? '—'}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          {formatQty(line.quantity)}
                        </td>
                        <td className="py-2.5 px-3">{line.unit_code}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          {formatCurrency(line.unit_price, order.currency)}
                        </td>
                        <td className="py-2.5 pl-3 text-right font-medium tabular-nums">
                          {formatCurrency(line.line_total, order.currency)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td colSpan={5} className="py-3 pr-3 text-right font-semibold">
                    Total ({order.currency})
                  </td>
                  <td className="py-3 pl-3 text-right text-base font-bold tabular-nums">
                    {formatCurrency(order.total, order.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </section>

        <footer className="mt-10 border-t border-border pt-4 text-center text-xs text-muted-foreground">
          This is an order confirmation, not a tax invoice
        </footer>
      </article>
    </div>
  );
}
