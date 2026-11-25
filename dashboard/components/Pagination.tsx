import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import type { PageWindow } from '@/lib/pagination';
import { cn } from '@/lib/utils';

type PaginationProps = {
  pages: PageWindow;
  basePath: string;
  params?: Record<string, string>;
  itemLabel: string;
  previousLabel?: string;
  nextLabel?: string;
};

function pageHref(basePath: string, params: Record<string, string>, page: number): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  if (page > 1) query.set('page', String(page));
  const qs = query.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function Pagination({
  pages,
  basePath,
  params = {},
  itemLabel,
  previousLabel = '← Previous',
  nextLabel = 'Next →',
}: PaginationProps) {
  if (pages.pageCount <= 1) return null;

  const { page, pageCount, total, from, to } = pages;
  const hasPrevious = page > 1;
  const hasNext = page < pageCount;
  const disabledClass = cn(
    buttonVariants({ variant: 'outline', size: 'sm' }),
    'pointer-events-none opacity-50'
  );

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border"
      aria-label={`${itemLabel} pages`}
    >
      {hasPrevious ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={pageHref(basePath, params, page - 1)}>{previousLabel}</Link>
        </Button>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          {previousLabel}
        </span>
      )}
      <span className="text-xs text-muted-foreground tabular-nums">
        {from + 1}–{to} of {total} {itemLabel} · Page {page} of {pageCount}
      </span>
      {hasNext ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={pageHref(basePath, params, page + 1)}>{nextLabel}</Link>
        </Button>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          {nextLabel}
        </span>
      )}
    </nav>
  );
}
