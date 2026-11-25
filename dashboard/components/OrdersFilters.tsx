'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
    <section className="card filter-card">
      <form className="filter-form" method="GET" action="/orders" onSubmit={handleSubmit}>
        <div className="filter-grid">
          <div className="filter-field">
            <label htmlFor="filter-from">From</label>
            <input
              id="filter-from"
              type="date"
              name="from"
              className="input input-sm"
              defaultValue={filters.from}
              key={`from-${filters.from}`}
            />
          </div>
          <div className="filter-field">
            <label htmlFor="filter-to">To</label>
            <input
              id="filter-to"
              type="date"
              name="to"
              className="input input-sm"
              defaultValue={filters.to}
              key={`to-${filters.to}`}
            />
          </div>
          <div className="filter-field">
            <label htmlFor="filter-tier">Tier</label>
            <select
              id="filter-tier"
              name="tier"
              className="input input-sm"
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
          <div className="filter-field">
            <label htmlFor="filter-status">Status</label>
            <select
              id="filter-status"
              name="status"
              className="input input-sm"
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

        <div className="filter-toolbar">
          <div className="filter-actions">
            <button type="submit" className="btn btn-primary">
              Apply filters
            </button>
            {active ? (
              <Link href="/orders" className="btn btn-ghost">
                Reset
              </Link>
            ) : null}
          </div>
          <div className="export-actions">
            <a href={csvHref} className="btn btn-ghost" download>
              Export CSV
            </a>
            <a href={xlsxHref} className="btn btn-ghost" download>
              Export XLSX
            </a>
          </div>
        </div>
      </form>
    </section>
  );
}
