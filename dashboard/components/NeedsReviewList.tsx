'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { reviewReasonLabel } from '@/app/orders/[id]/OrderReviewActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, shortId } from '@/lib/format';
import { formatWaitingAge, type HeldOrder } from '@/lib/orders';
import { cn } from '@/lib/utils';

export const HELD_ORDERS_DISPLAY_LIMIT = 8;

type NeedsReviewListProps = {
  orders: HeldOrder[];
  nowMs: number;
};

export function NeedsReviewList({ orders, nowMs }: NeedsReviewListProps) {
  const visibleOrders = orders.slice(0, HELD_ORDERS_DISPLAY_LIMIT);
  const hasOverflow = orders.length > HELD_ORDERS_DISPLAY_LIMIT;

  return (
    <section id="needs-review" aria-labelledby="needs-review-heading" className="scroll-mt-6">
      <div className="rounded-xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(24,27,49,0.04)] overflow-hidden flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-5 py-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <span
              aria-hidden="true"
              className={cn(
                'size-2 shrink-0 rounded-full',
                orders.length > 0
                  ? 'bg-[var(--dot-amber)] ring-1 ring-foreground/15'
                  : 'bg-[var(--dot-green)]'
              )}
            />
            <h2
              id="needs-review-heading"
              className="text-[14px] font-semibold tracking-[-0.01em] text-foreground truncate"
            >
              Needs Review
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
              {orders.length === 0 ? '0 held' : `${orders.length} held · Oldest first`}
            </span>
          </div>

          {hasOverflow ? (
            <Link
              href="/reports?status=needs_review"
              className="inline-flex items-center gap-1 rounded-sm px-1 py-1.5 -my-1.5 text-xs font-medium text-muted-foreground transition-[color,transform] duration-150 ease-out hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 shrink-0"
            >
              View all {orders.length}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </div>

        {visibleOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 px-5 py-10 text-center">
            <p className="text-sm font-medium text-foreground">All clear</p>
            <p className="text-xs text-muted-foreground">
              No held orders waiting for staff confirmation.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/70">
            {visibleOrders.map((order) => {
              const refLabel = order.po_number ? order.po_number : `#${shortId(order.id)}`;
              const reasons =
                order.review_reasons.length > 0
                  ? order.review_reasons.map((reason) => reviewReasonLabel(reason))
                  : ['Requires staff confirmation'];
              const waiting = formatWaitingAge(order.updated_at, nowMs);

              return (
                <li
                  key={order.id}
                  className="flex flex-col gap-3 px-5 py-3.5 transition-colors duration-150 ease-out hover:bg-sidebar/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
                      <Link
                        href={`/orders/${order.id}`}
                        className="rounded-sm font-mono text-sm font-semibold text-foreground transition-colors duration-150 ease-out hover:text-[var(--brand-crimson)] hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 tabular-nums shrink-0"
                      >
                        {refLabel}
                      </Link>
                      {order.po_number ? (
                        <span className="font-mono text-xs text-muted-foreground tabular-nums shrink-0">
                          #{shortId(order.id)}
                        </span>
                      ) : null}
                      <span
                        className="text-sm font-medium text-foreground truncate max-w-full"
                        title={order.customer_name}
                      >
                        {order.customer_name}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {reasons.map((label) => (
                        <Badge
                          key={label}
                          variant="outline"
                          className="border-border/80 bg-sidebar/60 text-foreground/85 font-medium"
                        >
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:justify-end shrink-0">
                    <div className="flex flex-col sm:items-end">
                      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(order.total, order.currency)}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        Waiting {waiting}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.98]"
                      asChild
                    >
                      <Link href={`/orders/${order.id}`}>
                        Review
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {hasOverflow ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-sidebar/30 px-5 py-3 text-xs">
            <span className="text-muted-foreground tabular-nums">
              Showing {visibleOrders.length} of {orders.length} held orders
            </span>
            <Link
              href="/reports?status=needs_review"
              className="inline-flex items-center gap-1 rounded-sm px-1 py-1 -my-1 font-medium text-foreground transition-[color,transform] duration-150 ease-out hover:text-[var(--brand-crimson)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2"
            >
              View full held list
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
