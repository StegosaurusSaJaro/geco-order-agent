export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export function formatCurrency(
  amount: number | string,
  currency = 'USD'
): string {
  const numeric = typeof amount === 'string' ? Number(amount) : amount;
  const safe = Number.isFinite(numeric) ? numeric : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(safe);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(date);
}

export function shortId(id: string): string {
  return id.replace(/-/g, '').slice(-8);
}

export function statusLabel(status: string): string {
  return status
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

const REVIEW_REASON_LABELS: Record<string, string> = {
  total: 'Over the $2,000 review limit',
  over_threshold: 'Over the $2,000 review limit',
  stock: 'Not enough stock',
  price_mismatch: 'Price mismatch',
  quantity: 'Unusual quantity',
};

export function reviewReasonLabel(reason: string): string {
  return REVIEW_REASON_LABELS[reason] ?? reason;
}
