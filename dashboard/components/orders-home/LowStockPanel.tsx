import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { LowStockItem } from '@/lib/orders';
import { cn } from '@/lib/utils';

const LOW_STOCK_DISPLAY_LIMIT = 8;

type LowStockPanelProps = {
  items: LowStockItem[];
  totalCount: number;
  threshold: number;
};

export function LowStockPanel({ items, totalCount, threshold }: LowStockPanelProps) {
  const visibleItems = items.slice(0, LOW_STOCK_DISPLAY_LIMIT);
  const hasMore = totalCount > visibleItems.length;

  return (
    <section id="low-stock" aria-labelledby="low-stock-heading" className="scroll-mt-6">
      <div className="rounded-xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(24,27,49,0.04)] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-border/70 px-5 py-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <span
              aria-hidden="true"
              className={cn(
                'size-2 shrink-0 rounded-full',
                totalCount > 0
                  ? 'bg-[var(--dot-amber)] ring-1 ring-foreground/15'
                  : 'bg-[var(--dot-green)]'
              )}
            />
            <h2
              id="low-stock-heading"
              className="text-[14px] font-semibold tracking-[-0.01em] text-foreground truncate"
            >
              Low Stock
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
              {totalCount} {totalCount === 1 ? 'item' : 'items'}
            </span>
          </div>

          <Link
            href="/inventory"
            className="inline-flex items-center gap-1 rounded-sm px-1 py-1.5 -my-1.5 text-xs font-medium text-muted-foreground transition-[color,transform] duration-150 ease-out hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 shrink-0"
          >
            Inventory
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        {visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 px-5 py-10 text-center">
            <p className="text-sm font-medium text-foreground">All stocked</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              No active products at or below {threshold} packs.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/70">
            {visibleItems.map((item) => {
              const isOutOfStock = item.stock_qty <= 0;
              return (
                <li
                  key={item.sku}
                  className="flex items-center justify-between gap-3 px-5 py-3 transition-colors duration-150 ease-out hover:bg-sidebar/50"
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-sm font-medium text-foreground truncate"
                      title={item.name}
                    >
                      {item.name}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-muted-foreground tabular-nums">
                      {item.sku}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shrink-0',
                      isOutOfStock
                        ? 'border-destructive/30 bg-[var(--destructive-soft)] text-destructive'
                        : 'border-border/80 bg-sidebar/50 font-mono tabular-nums text-foreground'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        isOutOfStock
                          ? 'bg-[var(--dot-red)]'
                          : 'bg-[var(--dot-amber)] ring-1 ring-foreground/15'
                      )}
                    />
                    {isOutOfStock ? (
                      <>
                        <span className="sr-only">Out of stock: </span>
                        <span className="font-mono tabular-nums">
                          {item.stock_qty} {item.unit_code}
                        </span>
                        <span>· Out</span>
                      </>
                    ) : (
                      <>
                        <span className="sr-only">Low stock: </span>
                        {item.stock_qty} {item.unit_code}
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-sidebar/30 px-5 py-3 text-xs">
            <span className="text-muted-foreground tabular-nums">
              Showing {visibleItems.length} of {totalCount} low-stock items
            </span>
            <Link
              href="/inventory"
              className="inline-flex items-center gap-1 rounded-sm px-1 py-1 -my-1 font-medium text-foreground transition-[color,transform] duration-150 ease-out hover:text-[var(--brand-crimson)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2"
            >
              View all in Inventory
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
