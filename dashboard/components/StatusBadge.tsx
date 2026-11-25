import { Badge } from '@/components/ui/badge';
import { statusLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

function dotClassForStatus(status: string): string {
  switch (status) {
    case 'needs_review':
      return 'bg-[var(--dot-amber)] ring-1 ring-foreground/15';
    case 'confirmed':
    case 'fulfilled':
      return 'bg-[var(--dot-green)]';
    case 'cancelled':
      return 'bg-[var(--dot-red)]';
    case 'draft':
    case 'expired':
    default:
      return 'bg-[var(--dot-zinc)]';
  }
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className="gap-1.5 font-medium">
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full shrink-0', dotClassForStatus(status))}
      />
      {statusLabel(status)}
    </Badge>
  );
}

export function TierBadge({ name }: { name: string }) {
  return (
    <Badge variant="secondary" className="font-medium">
      {name}
    </Badge>
  );
}
