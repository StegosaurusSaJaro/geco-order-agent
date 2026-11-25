import Link from 'next/link';
import type { PageWindow } from '@/lib/pagination';

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

  return (
    <nav className="pagination" aria-label={`${itemLabel} pages`}>
      {hasPrevious ? (
        <Link href={pageHref(basePath, params, page - 1)} className="btn btn-ghost">{previousLabel}</Link>
      ) : (
        <span className="btn btn-ghost" aria-disabled="true">{previousLabel}</span>
      )}
      <span className="pagination-status">
        {from + 1}–{to} of {total} {itemLabel} · Page {page} of {pageCount}
      </span>
      {hasNext ? (
        <Link href={pageHref(basePath, params, page + 1)} className="btn btn-ghost">{nextLabel}</Link>
      ) : (
        <span className="btn btn-ghost" aria-disabled="true">{nextLabel}</span>
      )}
    </nav>
  );
}
