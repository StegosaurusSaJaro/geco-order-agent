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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    backgroundColor: '#ffffff',
    border: '1px solid #e2e3de',
    borderRadius: '8px',
    fontSize: '12.5px',
    color: '#181b31',
  };

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="Order charts">
      <Card className="py-0 gap-0 min-w-0">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
          <CardTitle className="text-[13.5px] font-semibold">Orders Over Time</CardTitle>
          <span className="text-xs text-muted-foreground">Daily count</span>
        </CardHeader>
        <CardContent className="p-4">
          {data.ordersOverTime.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
              No matching orders.
            </div>
          ) : (
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={data.ordersOverTime}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e3de" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#56575e' }}
                    tickLine={false}
                    axisLine={{ stroke: '#d5d7d0' }}
                    minTickGap={20}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, 'auto']}
                    tick={{ fontSize: 11, fill: '#56575e' }}
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
                    type="linear"
                    dataKey="count"
                    baseValue={0}
                    stroke="#181b31"
                    strokeWidth={2}
                    fill="rgba(24, 27, 49, 0.10)"
                    dot={{ r: 2.5, fill: '#e21d3c', strokeWidth: 0 }}
                    activeDot={{ r: 4, fill: '#e21d3c', stroke: '#ffffff', strokeWidth: 1.5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="py-0 gap-0 min-w-0">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
          <CardTitle className="text-[13.5px] font-semibold">Sales by Tier</CardTitle>
          <span className="text-xs text-muted-foreground">DB order totals</span>
        </CardHeader>
        <CardContent className="p-4">
          {data.salesByTier.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
              No matching orders.
            </div>
          ) : (
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={data.salesByTier}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e3de" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#56575e' }}
                    tickLine={false}
                    axisLine={{ stroke: '#d5d7d0' }}
                    interval={0}
                  />
                  <YAxis
                    tickFormatter={compactCurrency}
                    tick={{ fontSize: 11, fill: '#56575e' }}
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
        </CardContent>
      </Card>

      <Card className="py-0 gap-0 min-w-0">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
          <CardTitle className="text-[13.5px] font-semibold">Top SKUs</CardTitle>
          <span className="text-xs text-muted-foreground">By line total</span>
        </CardHeader>
        <CardContent className="p-4">
          {data.topSkus.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
              No matching order lines.
            </div>
          ) : (
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={data.topSkus}
                  layout="vertical"
                  margin={{ top: 4, right: 14, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e3de" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={compactCurrency}
                    tick={{ fontSize: 11, fill: '#56575e' }}
                    tickLine={false}
                    axisLine={{ stroke: '#d5d7d0' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="sku"
                    width={92}
                    tick={{ fontSize: 11, fill: '#181b31' }}
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
        </CardContent>
      </Card>

      <Card className="py-0 gap-0 min-w-0">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
          <CardTitle className="text-[13.5px] font-semibold">Orders by Status</CardTitle>
          <span className="text-xs text-muted-foreground">Order count</span>
        </CardHeader>
        <CardContent className="p-4">
          {data.ordersByStatus.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
              No matching orders.
            </div>
          ) : (
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={data.ordersByStatus}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e3de" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#56575e' }}
                    tickLine={false}
                    axisLine={{ stroke: '#d5d7d0' }}
                    interval={0}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#56575e' }}
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
        </CardContent>
      </Card>
    </section>
  );
}
