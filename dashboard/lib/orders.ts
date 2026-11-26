import type { SupabaseClient } from '@supabase/supabase-js';
import { one, shortId, statusLabel } from '@/lib/format';

export const LOW_STOCK_PACKS = 10;
export const LOW_STOCK_LIST_LIMIT = 8;

export const ORDER_STATUSES = [
  'draft',
  'needs_review',
  'confirmed',
  'fulfilled',
  'cancelled',
  'expired',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderFilters = {
  from: string;
  to: string;
  tier: string;
  status: string;
};

export type TierOption = {
  id: number;
  code: string;
  name: string;
};

type CustomerJoin = {
  name: string;
  tier_id: number;
  tiers: { code: string; name: string } | { code: string; name: string }[] | null;
};

type RawOrderRow = {
  id: string;
  status: string;
  po_number: string | null;
  version: number;
  currency: string;
  total: number | string;
  created_at: string;
  customers: CustomerJoin | CustomerJoin[] | null;
};

type RawOrderLineRow = {
  order_id: string;
  version: number;
  line_no: number;
  sku: string;
  quantity: number | string;
  unit_code: string;
  unit_price: number | string;
  line_total: number | string;
  products: { name: string } | { name: string }[] | null;
};

export type FilteredOrder = {
  id: string;
  status: string;
  po_number: string | null;
  version: number;
  currency: string;
  total: number;
  created_at: string;
  customer_name: string;
  tier_code: string;
  tier_name: string;
};

export type FilteredOrderLine = {
  order_id: string;
  line_no: number;
  sku: string;
  product_name: string;
  quantity: number;
  unit_code: string;
  unit_price: number;
  line_total: number;
};

export type OrdersOverTimePoint = {
  date: string;
  label: string;
  count: number;
  sales: number;
};

export type SalesByTierPoint = {
  code: string;
  name: string;
  sales: number;
  count: number;
};

export type TopSkuPoint = {
  sku: string;
  name: string;
  sales: number;
  qty: number;
};

export type OrdersByStatusPoint = {
  status: string;
  label: string;
  count: number;
  sales: number;
};

export type OrdersChartData = {
  ordersOverTime: OrdersOverTimePoint[];
  salesByTier: SalesByTierPoint[];
  topSkus: TopSkuPoint[];
  ordersByStatus: OrdersByStatusPoint[];
};

export type ExportRow = {
  order: string;
  customer: string;
  tier: string;
  status: string;
  po: string;
  sku: string;
  qty: number | null;
  unit: string;
  unitPrice: number | null;
  lineTotal: number | null;
  created: string;
};

export type HeldOrder = {
  id: string;
  po_number: string | null;
  currency: string;
  total: number;
  review_reasons: string[];
  updated_at: string;
  customer_name: string;
};

export type LowStockItem = {
  sku: string;
  name: string;
  stock_qty: number;
  unit_code: string;
};

export type HomeOrdersData = {
  heldOrders: HeldOrder[];
  ordersToday: number;
  ordersYesterday: number;
  lowStockCount: number;
  lowStockItems: LowStockItem[];
  recentOrders: FilteredOrder[];
  totalOrders: number;
  error: string | null;
};

type RawHeldOrderRow = {
  id: string;
  po_number: string | null;
  currency: string;
  total: number | string;
  review_reasons: string[] | null;
  updated_at: string;
  customers: { name: string } | { name: string }[] | null;
};

type RawLowStockRow = {
  sku: string;
  name: string;
  stock_qty: number | string;
  unit_code: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUS_SET = new Set<string>(ORDER_STATUSES);
const MANILA_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function firstParam(
  source: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string
): string {
  if (source instanceof URLSearchParams) {
    return (source.get(key) ?? '').trim();
  }
  const value = source[key];
  if (Array.isArray(value)) {
    return (value[0] ?? '').trim();
  }
  return (value ?? '').trim();
}

function toNumber(value: number | string | null | undefined): number {
  const numeric = typeof value === 'string' ? Number(value) : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function validDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseOrderFilters(
  source: URLSearchParams | Record<string, string | string[] | undefined>
): OrderFilters {
  const rawFrom = firstParam(source, 'from');
  const rawTo = firstParam(source, 'to');
  const rawTier = firstParam(source, 'tier');
  const rawStatus = firstParam(source, 'status');

  return {
    from: validDate(rawFrom) ? rawFrom : '',
    to: validDate(rawTo) ? rawTo : '',
    tier: rawTier,
    status: STATUS_SET.has(rawStatus) ? rawStatus : '',
  };
}

export function hasActiveFilters(filters: OrderFilters): boolean {
  return Boolean(filters.from || filters.to || filters.tier || filters.status);
}

export function buildFilterQuery(
  filters: OrderFilters,
  extra?: Record<string, string>
): string {
  const params = new URLSearchParams();
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) {
        params.set(key, value);
      }
    }
  }
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.tier) params.set('tier', filters.tier);
  if (filters.status) params.set('status', filters.status);
  return params.toString();
}

export async function fetchOrdersData(
  supabase: SupabaseClient,
  filters: OrderFilters
): Promise<{
  orders: FilteredOrder[];
  lines: FilteredOrderLine[];
  tiers: TierOption[];
  error: string | null;
}> {
  const tiersRes = await supabase
    .from('tiers')
    .select('id, code, name')
    .order('id', { ascending: true });

  if (tiersRes.error) {
    return { orders: [], lines: [], tiers: [], error: tiersRes.error.message };
  }

  const tiers = (tiersRes.data ?? []) as TierOption[];
  const matchedTier = filters.tier
    ? tiers.find((t) => t.code === filters.tier) ?? null
    : null;

  if (filters.tier && !matchedTier) {
    return { orders: [], lines: [], tiers, error: null };
  }

  const selectColumns = matchedTier
    ? 'id, status, po_number, version, currency, total, created_at, customers!inner(name, tier_id, tiers(code, name))'
    : 'id, status, po_number, version, currency, total, created_at, customers(name, tier_id, tiers(code, name))';

  let query = supabase
    .from('orders')
    .select(selectColumns)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (filters.from) {
    query = query.gte('created_at', `${filters.from}T00:00:00+08:00`);
  }
  if (filters.to) {
    const end = new Date(`${filters.to}T00:00:00+08:00`);
    end.setUTCDate(end.getUTCDate() + 1);
    query = query.lt('created_at', end.toISOString());
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (matchedTier) {
    query = query.eq('customers.tier_id', matchedTier.id);
  }

  const pageSize = 500;
  const rawOrders: RawOrderRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const ordersRes = await query.range(offset, offset + pageSize - 1);
    if (ordersRes.error) {
      return { orders: [], lines: [], tiers, error: ordersRes.error.message };
    }
    const page = (ordersRes.data ?? []) as unknown as RawOrderRow[];
    rawOrders.push(...page);
    if (page.length < pageSize) break;
  }
  const orders: FilteredOrder[] = rawOrders.map((row) => {
    const customer = one(row.customers);
    const tier = one(customer?.tiers);
    return {
      id: row.id,
      status: row.status,
      po_number: row.po_number,
      version: row.version,
      currency: row.currency,
      total: toNumber(row.total),
      created_at: row.created_at,
      customer_name: customer?.name ?? '—',
      tier_code: tier?.code ?? '',
      tier_name: tier?.name ?? '—',
    };
  });

  if (orders.length === 0) {
    return { orders, lines: [], tiers, error: null };
  }

  const versionByOrderId = new Map<string, number>();
  for (const order of orders) {
    versionByOrderId.set(order.id, order.version);
  }

  const orderIds = orders.map((order) => order.id);
  const rawLines: RawOrderLineRow[] = [];
  const chunkSize = 100;

  for (let i = 0; i < orderIds.length; i += chunkSize) {
    const chunk = orderIds.slice(i, i + chunkSize);
    for (let offset = 0; ; offset += pageSize) {
      const linesRes = await supabase
        .from('order_lines')
        .select('order_id, version, line_no, sku, quantity, unit_code, unit_price, line_total, products(name)')
        .in('order_id', chunk)
        .order('order_id', { ascending: true })
        .order('version', { ascending: true })
        .order('line_no', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (linesRes.error) {
        return { orders, lines: [], tiers, error: linesRes.error.message };
      }
      const page = (linesRes.data ?? []) as unknown as RawOrderLineRow[];
      rawLines.push(...page);
      if (page.length < pageSize) break;
    }
  }

  const lines: FilteredOrderLine[] = rawLines
    .filter((line) => line.version === versionByOrderId.get(line.order_id))
    .map((line) => ({
      order_id: line.order_id,
      line_no: line.line_no,
      sku: line.sku,
      product_name: one(line.products)?.name ?? line.sku,
      quantity: toNumber(line.quantity),
      unit_code: line.unit_code,
      unit_price: toNumber(line.unit_price),
      line_total: toNumber(line.line_total),
    }));

  return { orders, lines, tiers, error: null };
}

function shortDateLabel(isoDay: string): string {
  const parts = isoDay.split('-');
  if (parts.length !== 3) return isoDay;
  const date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function previousDay(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function formatWaitingAge(iso: string, nowMs: number): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return '—';
  const diffMs = Math.max(0, nowMs - parsed);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return '< 1 m';
  if (minutes < 60) return `${minutes} m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
}

function mapRawOrder(row: RawOrderRow): FilteredOrder {
  const customer = one(row.customers);
  const tier = one(customer?.tiers);
  return {
    id: row.id,
    status: row.status,
    po_number: row.po_number,
    version: row.version,
    currency: row.currency,
    total: toNumber(row.total),
    created_at: row.created_at,
    customer_name: customer?.name ?? '—',
    tier_code: tier?.code ?? '',
    tier_name: tier?.name ?? '—',
  };
}

export async function fetchHomeOrdersData(
  supabase: SupabaseClient,
  requestedPage: number,
  pageSize: number,
  now = new Date()
): Promise<HomeOrdersData> {
  const today = MANILA_DAY_FORMATTER.format(now);
  const tomorrow = nextDay(today);
  const yesterday = previousDay(today);
  const safePage = Math.max(1, requestedPage);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;
  const recentSelect =
    'id, status, po_number, version, currency, total, created_at, customers(name, tier_id, tiers(code, name))';

  const [heldRes, todayRes, yesterdayRes, lowStockRes, recentRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, po_number, currency, total, review_reasons, updated_at, customers(name)')
      .eq('status', 'needs_review')
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00+08:00`)
      .lt('created_at', `${tomorrow}T00:00:00+08:00`),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', `${yesterday}T00:00:00+08:00`)
      .lt('created_at', `${today}T00:00:00+08:00`),
    supabase
      .from('products')
      .select('sku, name, stock_qty, unit_code', { count: 'exact' })
      .eq('active', true)
      .lte('stock_qty', LOW_STOCK_PACKS)
      .order('stock_qty', { ascending: true })
      .order('sku', { ascending: true })
      .limit(LOW_STOCK_LIST_LIMIT),
    supabase
      .from('orders')
      .select(recentSelect, { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  ]);

  const firstError =
    heldRes.error ??
    todayRes.error ??
    yesterdayRes.error ??
    lowStockRes.error ??
    recentRes.error;

  if (firstError) {
    return {
      heldOrders: [],
      ordersToday: 0,
      ordersYesterday: 0,
      lowStockCount: 0,
      lowStockItems: [],
      recentOrders: [],
      totalOrders: 0,
      error: firstError.message,
    };
  }

  const lowStockItems: LowStockItem[] = (
    (lowStockRes.data ?? []) as unknown as RawLowStockRow[]
  ).map((row) => ({
    sku: row.sku,
    name: row.name,
    stock_qty: toNumber(row.stock_qty),
    unit_code: row.unit_code,
  }));

  const totalOrders = recentRes.count ?? 0;
  let rawRecent = (recentRes.data ?? []) as unknown as RawOrderRow[];

  if (totalOrders > 0 && from >= totalOrders) {
    const lastPage = Math.max(1, Math.ceil(totalOrders / pageSize));
    const clampedFrom = (lastPage - 1) * pageSize;
    const clampedTo = clampedFrom + pageSize - 1;
    const clampedRes = await supabase
      .from('orders')
      .select(recentSelect)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(clampedFrom, clampedTo);
    if (clampedRes.error) {
      return {
        heldOrders: [],
        ordersToday: todayRes.count ?? 0,
        ordersYesterday: yesterdayRes.count ?? 0,
        lowStockCount: lowStockRes.count ?? 0,
        lowStockItems,
        recentOrders: [],
        totalOrders,
        error: clampedRes.error.message,
      };
    }
    rawRecent = (clampedRes.data ?? []) as unknown as RawOrderRow[];
  }

  const heldOrders: HeldOrder[] = ((heldRes.data ?? []) as unknown as RawHeldOrderRow[]).map(
    (row) => ({
      id: row.id,
      po_number: row.po_number,
      currency: row.currency,
      total: toNumber(row.total),
      review_reasons: Array.isArray(row.review_reasons) ? row.review_reasons : [],
      updated_at: row.updated_at,
      customer_name: one(row.customers)?.name ?? '—',
    })
  );

  return {
    heldOrders,
    ordersToday: todayRes.count ?? 0,
    ordersYesterday: yesterdayRes.count ?? 0,
    lowStockCount: lowStockRes.count ?? 0,
    lowStockItems,
    recentOrders: rawRecent.map(mapRawOrder),
    totalOrders,
    error: null,
  };
}

export function buildChartData(
  orders: FilteredOrder[],
  lines: FilteredOrderLine[],
  filters: OrderFilters
): OrdersChartData {
  const byDay = new Map<string, { count: number; sales: number }>();
  const byTier = new Map<string, { code: string; name: string; sales: number; count: number }>();
  const byStatus = new Map<string, { count: number; sales: number }>();

  for (const order of orders) {
    const day = MANILA_DAY_FORMATTER.format(new Date(order.created_at));
    const dayEntry = byDay.get(day) ?? { count: 0, sales: 0 };
    dayEntry.count += 1;
    dayEntry.sales = roundMoney(dayEntry.sales + order.total);
    byDay.set(day, dayEntry);

    const tierKey = order.tier_code || 'unknown';
    const tierEntry = byTier.get(tierKey) ?? {
      code: tierKey,
      name: order.tier_name,
      sales: 0,
      count: 0,
    };
    tierEntry.sales = roundMoney(tierEntry.sales + order.total);
    tierEntry.count += 1;
    byTier.set(tierKey, tierEntry);

    const statusEntry = byStatus.get(order.status) ?? { count: 0, sales: 0 };
    statusEntry.count += 1;
    statusEntry.sales = roundMoney(statusEntry.sales + order.total);
    byStatus.set(order.status, statusEntry);
  }

  const bySku = new Map<string, { sku: string; name: string; sales: number; qty: number }>();
  for (const line of lines) {
    const entry = bySku.get(line.sku) ?? {
      sku: line.sku,
      name: line.product_name,
      sales: 0,
      qty: 0,
    };
    entry.sales = roundMoney(entry.sales + line.line_total);
    entry.qty = roundMoney(entry.qty + line.quantity);
    bySku.set(line.sku, entry);
  }

  const days = Array.from(byDay.keys()).sort();
  const firstDay = filters.from || days[0];
  const lastDay = filters.to || days[days.length - 1];
  const ordersOverTime: OrdersOverTimePoint[] = [];
  if (firstDay && lastDay) {
    for (let date = firstDay; date <= lastDay; date = nextDay(date)) {
      const stats = byDay.get(date) ?? { count: 0, sales: 0 };
      ordersOverTime.push({ date, label: shortDateLabel(date), ...stats });
      if (date === lastDay) break;
    }
  }

  const salesByTier: SalesByTierPoint[] = Array.from(byTier.values()).sort(
    (a, b) => b.sales - a.sales
  );

  const topSkus: TopSkuPoint[] = Array.from(bySku.values())
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 8);

  const ordersByStatus: OrdersByStatusPoint[] = ORDER_STATUSES.filter((s) =>
    byStatus.has(s)
  ).map((status) => {
    const stats = byStatus.get(status)!;
    return {
      status,
      label: statusLabel(status),
      count: stats.count,
      sales: stats.sales,
    };
  });

  return {
    ordersOverTime,
    salesByTier,
    topSkus,
    ordersByStatus,
  };
}

export function buildExportRows(
  orders: FilteredOrder[],
  lines: FilteredOrderLine[]
): ExportRow[] {
  const linesByOrder = new Map<string, FilteredOrderLine[]>();
  for (const line of lines) {
    const list = linesByOrder.get(line.order_id);
    if (list) {
      list.push(line);
    } else {
      linesByOrder.set(line.order_id, [line]);
    }
  }

  const rows: ExportRow[] = [];
  for (const order of orders) {
    const orderLines = linesByOrder.get(order.id) ?? [];
    const orderLabel = `#${shortId(order.id)}`;
    const statusText = statusLabel(order.status);

    if (orderLines.length === 0) {
      rows.push({
        order: orderLabel,
        customer: order.customer_name,
        tier: order.tier_name,
        status: statusText,
        po: order.po_number ?? '',
        sku: '',
        qty: null,
        unit: '',
        unitPrice: null,
        lineTotal: null,
        created: order.created_at,
      });
      continue;
    }

    for (const line of orderLines) {
      rows.push({
        order: orderLabel,
        customer: order.customer_name,
        tier: order.tier_name,
        status: statusText,
        po: order.po_number ?? '',
        sku: line.sku,
        qty: line.quantity,
        unit: line.unit_code,
        unitPrice: line.unit_price,
        lineTotal: line.line_total,
        created: order.created_at,
      });
    }
  }

  return rows;
}
