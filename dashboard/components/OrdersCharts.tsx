'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '@/lib/format';
import type { OrdersChartData } from '@/lib/orders';

type OrdersChartsProps = {
  data: OrdersChartData;
  currency: string;
};

const TIER_COLORS: Record<string, string> = {
  cafe: '#0f766e',
  restaurant_group: '#0284c7',
  hotel_chain: '#d97706',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#64748b',
  needs_review: '#d97706',
  confirmed: '#0f766e',
  fulfilled: '#16a34a',
  cancelled: '#dc2626',
  expired: '#9ca3af',
};

function compactCurrency(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${Math.round(value)}`;
}

export function OrdersCharts({ data, currency }: OrdersChartsProps) {
  const tooltipStyle = {
    backgroundColor: '#fff',
    border: '1px solid #e2e6e1',
    borderRadius: '8px',
    fontSize: '12.5px',
    color: '#18221f',
  };

  return (
    <section className="charts-grid" aria-label="Order charts">
      <div className="card chart-card">
        <div className="card-header">
          <span>Orders Over Time</span>
          <span className="muted">Daily count</span>
        </div>
        <div className="chart-body">
          {data.ordersOverTime.length === 0 ? (
            <div className="chart-empty">No matching orders.</div>
          ) : (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={data.ordersOverTime}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e6e1" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#5a6863' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e6e1' }}
                    minTickGap={20}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#5a6863' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => {
                      const num = Number(value ?? 0);
                      if (name === 'sales') {
                        return [formatCurrency(num, currency), 'Sales'];
                      }
                      return [num, 'Orders'];
                    }}
                    labelFormatter={(_label, payload) => {
                      const item = payload?.[0]?.payload as { date?: string; sales?: number } | undefined;
                      if (!item?.date) return '';
                      return `${item.date} · ${formatCurrency(item.sales ?? 0, currency)}`;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#0f766e"
                    strokeWidth={2}
                    fill="#e6f4f1"
                    activeDot={{ r: 4, fill: '#0f766e' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card chart-card">
        <div className="card-header">
          <span>Sales by Tier</span>
          <span className="muted">DB order totals</span>
        </div>
        <div className="chart-body">
          {data.salesByTier.length === 0 ? (
            <div className="chart-empty">No matching orders.</div>
          ) : (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={data.salesByTier}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e6e1" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#5a6863' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e6e1' }}
                    interval={0}
                  />
                  <YAxis
                    tickFormatter={compactCurrency}
                    tick={{ fontSize: 11, fill: '#5a6863' }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [formatCurrency(Number(value ?? 0), currency), 'Sales']}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload as { count?: number } | undefined;
                      return `${String(label)} (${item?.count ?? 0} orders)`;
                    }}
                  />
                  <Bar dataKey="sales" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {data.salesByTier.map((entry) => (
                      <Cell
                        key={entry.code}
                        fill={TIER_COLORS[entry.code] ?? '#0f766e'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card chart-card">
        <div className="card-header">
          <span>Top SKUs</span>
          <span className="muted">By line total</span>
        </div>
        <div className="chart-body">
          {data.topSkus.length === 0 ? (
            <div className="chart-empty">No matching order lines.</div>
          ) : (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={data.topSkus}
                  layout="vertical"
                  margin={{ top: 4, right: 14, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e6e1" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={compactCurrency}
                    tick={{ fontSize: 11, fill: '#5a6863' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e6e1' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="sku"
                    width={92}
                    tick={{ fontSize: 11, fill: '#18221f' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [formatCurrency(Number(value ?? 0), currency), 'Sales']}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload as { name?: string; qty?: number } | undefined;
                      return `${String(label)} · ${item?.name ?? ''} (qty ${item?.qty ?? 0})`;
                    }}
                  />
                  <Bar dataKey="sales" fill="#0f766e" radius={[0, 6, 6, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card chart-card">
        <div className="card-header">
          <span>Orders by Status</span>
          <span className="muted">Order count</span>
        </div>
        <div className="chart-body">
          {data.ordersByStatus.length === 0 ? (
            <div className="chart-empty">No matching orders.</div>
          ) : (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={data.ordersByStatus}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e6e1" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#5a6863' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e6e1' }}
                    interval={0}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#5a6863' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [Number(value ?? 0), 'Orders']}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload as { sales?: number } | undefined;
                      return `${String(label)} · ${formatCurrency(item?.sales ?? 0, currency)}`;
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={52}>
                    {data.ordersByStatus.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLORS[entry.status] ?? '#0f766e'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
