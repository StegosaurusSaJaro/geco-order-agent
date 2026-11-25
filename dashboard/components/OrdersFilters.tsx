'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { statusLabel } from '@/lib/format';
import {
  buildFilterQuery,
  hasActiveFilters,
  ORDER_STATUSES,
  type OrderFilters,
  type TierOption,
} from '@/lib/orders';

type OrdersFiltersProps = {
  filters: OrderFilters;
  tiers: TierOption[];
};

const SELECT_CLASS =
  'h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring';

export function OrdersFilters({ filters, tiers }: OrdersFiltersProps) {
  const router = useRouter();
  const active = hasActiveFilters(filters);
  const csvHref = `/api/orders/export?${buildFilterQuery(filters, { format: 'csv' })}`;
  const xlsxHref = `/api/orders/export?${buildFilterQuery(filters, { format: 'xlsx' })}`;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const next: OrderFilters = {
      from: String(formData.get('from') ?? '').trim(),
      to: String(formData.get('to') ?? '').trim(),
      tier: String(formData.get('tier') ?? '').trim(),
      status: String(formData.get('status') ?? '').trim(),
    };
    const qs = buildFilterQuery(next);
    router.push(qs ? `/orders?${qs}` : '/orders');
  }

  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <form
          className="flex flex-col gap-3"
          method="GET"
          action="/orders"
          onSubmit={handleSubmit}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-from" className="text-xs text-muted-foreground">
                From
              </Label>
              <Input
                id="filter-from"
                type="date"
                name="from"
                className="bg-background"
                defaultValue={filters.from}
                key={`from-${filters.from}`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input
                id="filter-to"
                type="date"
                name="to"
                className="bg-background"
                defaultValue={filters.to}
                key={`to-${filters.to}`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-tier" className="text-xs text-muted-foreground">
                Tier
              </Label>
              <select
                id="filter-tier"
                name="tier"
                className={SELECT_CLASS}
                defaultValue={filters.tier}
                key={`tier-${filters.tier}`}
              >
                <option value="">All tiers</option>
                {tiers.map((tier) => (
                  <option key={tier.code} value={tier.code}>
                    {tier.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-status" className="text-xs text-muted-foreground">
                Status
              </Label>
              <select
                id="filter-status"
                name="status"
                className={SELECT_CLASS}
                defaultValue={filters.status}
                key={`status-${filters.status}`}
              >
                <option value="">All statuses</option>
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-border">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm">
                Apply filters
              </Button>
              {active ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/orders">Reset</Link>
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={csvHref} download>
                  Export CSV
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={xlsxHref} download>
                  Export XLSX
                </a>
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
