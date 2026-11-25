'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { reviewReasonLabel } from '@/app/orders/[id]/OrderReviewActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, shortId } from '@/lib/format';
import { formatWaitingAge, type HeldOrder } from '@/lib/orders';

type NeedsReviewListProps = {
  orders: HeldOrder[];
  nowMs: number;
};

export function NeedsReviewList({ orders, nowMs }: NeedsReviewListProps) {
  return (
    <section id="needs-review" aria-labelledby="needs-review-heading" className="scroll-mt-6">
      <Card className="py-0 gap-0 overflow-hidden border-amber-300/90">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-amber-200/90 bg-amber-50/90 px-4 py-3 text-amber-950">
          <div className="flex items-center gap-2 min-w-0">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-[var(--dot-amber)] ring-1 ring-amber-900/20"
            />
            <CardTitle id="needs-review-heading" className="text-[13.5px] font-semibold">
              Needs Review
            </CardTitle>
          </div>
          <span className="text-xs font-medium text-amber-900/80 tabular-nums shrink-0">
            {orders.length} {orders.length === 1 ? 'held' : 'held'} · Oldest first
          </span>
        </CardHeader>

        {orders.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing waiting for review.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {orders.map((order) => {
              const refLabel = order.po_number ? order.po_number : `#${shortId(order.id)}`;
              const reasons =
                order.review_reasons.length > 0
                  ? order.review_reasons.map((reason) => reviewReasonLabel(reason))
                  : ['Requires staff confirmation'];
              const waiting = formatWaitingAge(order.updated_at, nowMs);

              return (
                <li
                  key={order.id}
                  className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-amber-50/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-mono text-sm font-semibold text-foreground hover:text-[var(--brand-crimson)] hover:underline underline-offset-4 tabular-nums"
                      >
                        {refLabel}
                      </Link>
                      {order.po_number ? (
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                          #{shortId(order.id)}
                        </span>
                      ) : null}
                      <span className="text-sm font-medium text-foreground">
                        {order.customer_name}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {reasons.map((label) => (
                        <Badge
                          key={label}
                          variant="outline"
                          className="border-amber-300/90 bg-amber-50/80 text-amber-950 font-medium"
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
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/orders/${order.id}`}>
                        Review
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
