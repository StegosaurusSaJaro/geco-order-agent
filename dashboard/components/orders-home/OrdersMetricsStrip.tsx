type OrdersMetricsStripProps = {
  heldCount: number;
  oldestHeldAge: string | null;
  ordersToday: number;
  ordersYesterday: number;
  lowStockCount: number;
  lowStockThreshold: number;
};

export function OrdersMetricsStrip({
  heldCount,
  oldestHeldAge,
  ordersToday,
  ordersYesterday,
  lowStockCount,
  lowStockThreshold,
}: OrdersMetricsStripProps) {
  const needsReviewFoot = oldestHeldAge ? `Oldest waiting ${oldestHeldAge}` : 'None waiting';

  return (
    <section
      aria-label="Order desk metrics"
      className="border-y border-border/80"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/70">
        <a
          href="#needs-review"
          className="flex flex-col gap-1.5 px-4 py-3.5 sm:px-5 text-left transition-[background-color,transform] duration-150 ease-out hover:bg-sidebar/50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
        >
          <div className="flex items-center justify-between text-[12.5px] font-medium text-muted-foreground">
            <span>Needs review</span>
            {heldCount > 0 ? (
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full bg-[var(--dot-amber)] ring-1 ring-foreground/15"
              />
            ) : null}
          </div>
          <div className="text-[28px] font-semibold tracking-[-0.03em] leading-none tabular-nums text-foreground">
            {heldCount}
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">{needsReviewFoot}</div>
        </a>

        <div className="flex flex-col gap-1.5 px-4 py-3.5 sm:px-5 text-left">
          <div className="flex items-center justify-between text-[12.5px] font-medium text-muted-foreground">
            <span>Orders today</span>
          </div>
          <div className="text-[28px] font-semibold tracking-[-0.03em] leading-none tabular-nums text-foreground">
            {ordersToday}
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            Yesterday {ordersYesterday}
          </div>
        </div>

        <a
          href="#low-stock"
          className="flex flex-col gap-1.5 px-4 py-3.5 sm:px-5 text-left transition-[background-color,transform] duration-150 ease-out hover:bg-sidebar/50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
        >
          <div className="flex items-center justify-between text-[12.5px] font-medium text-muted-foreground">
            <span>Low stock</span>
            {lowStockCount > 0 ? (
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full bg-[var(--dot-amber)] ring-1 ring-foreground/15"
              />
            ) : null}
          </div>
          <div className="text-[28px] font-semibold tracking-[-0.03em] leading-none tabular-nums text-foreground">
            {lowStockCount}
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            At or below {lowStockThreshold} packs
          </div>
        </a>
      </div>
    </section>
  );
}
