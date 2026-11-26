import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Pagination } from '@/components/Pagination';
import { StatusBadge, TierBadge } from '@/components/StatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDateTime, shortId } from '@/lib/format';
import type { FilteredOrder } from '@/lib/orders';
import type { PageWindow } from '@/lib/pagination';

type RecentOrdersTableProps = {
  orders: FilteredOrder[];
  totalOrders: number;
  pages: PageWindow;
};

export function RecentOrdersTable({ orders, totalOrders, pages }: RecentOrdersTableProps) {
  return (
    <section
      aria-labelledby="recent-orders-heading"
      className="rounded-xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(24,27,49,0.04)] overflow-hidden"
    >
      <div className="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-border/70 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <h2
            id="recent-orders-heading"
            className="text-[14px] font-semibold tracking-[-0.01em] text-foreground"
          >
            Recent Orders
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {totalOrders} {totalOrders === 1 ? 'order' : 'orders'}
          </span>
        </div>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-all duration-150 ease-out hover:text-foreground active:scale-[0.98]"
        >
          Reports
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      {totalOrders === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-muted-foreground">
          No orders yet.
        </div>
      ) : (
        <Table>
          <TableHeader className="bg-sidebar/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-5 text-xs font-medium text-muted-foreground">
                Order
              </TableHead>
              <TableHead className="px-5 text-xs font-medium text-muted-foreground">
                Customer
              </TableHead>
              <TableHead className="px-5 text-xs font-medium text-muted-foreground">
                Tier
              </TableHead>
              <TableHead className="px-5 text-xs font-medium text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="px-5 text-right text-xs font-medium text-muted-foreground">
                Total
              </TableHead>
              <TableHead className="px-5 text-right text-xs font-medium text-muted-foreground">
                Time
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow
                key={order.id}
                className="transition-colors duration-150 ease-out hover:bg-sidebar/50"
              >
                <TableCell className="px-5 py-3.5">
                  <Link
                    href={`/orders/${order.id}`}
                    className="font-medium text-foreground transition-colors duration-150 ease-out hover:text-[var(--brand-crimson)] hover:underline underline-offset-4"
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
                <TableCell className="px-5 py-3.5">{order.customer_name}</TableCell>
                <TableCell className="px-5 py-3.5">
                  {order.tier_code ? (
                    <TierBadge name={order.tier_name} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="px-5 py-3.5">
                  <StatusBadge status={order.status} />
                </TableCell>
                <TableCell className="px-5 py-3.5 text-right font-mono tabular-nums">
                  {formatCurrency(order.total, order.currency)}
                </TableCell>
                <TableCell className="px-5 py-3.5 text-right font-mono tabular-nums text-muted-foreground">
                  {formatDateTime(order.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Pagination pages={pages} basePath="/orders" itemLabel="orders" />
    </section>
  );
}
