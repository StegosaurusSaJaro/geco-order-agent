import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const METRIC_TILES = [0, 1, 2];
const REVIEW_ROWS = [0, 1, 2];
const LOW_STOCK_ROWS = [0, 1, 2, 3];
const TABLE_ROWS = [0, 1, 2, 3, 4, 5, 6, 7];

export function OrdersSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading orders dashboard" className="contents">
      <section aria-label="Loading metrics" className="border-y border-border/80">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/70">
          {METRIC_TILES.map((idx) => (
            <div key={idx} className="flex flex-col gap-2 px-4 py-3.5 sm:px-5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 min-w-0 rounded-xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(24,27,49,0.04)] overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-5 py-3.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3.5 w-20" />
          </div>
          <div className="divide-y divide-border/70">
            {REVIEW_ROWS.map((idx) => (
              <div
                key={idx}
                className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-5 w-40 rounded-full" />
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <div className="flex flex-col gap-1.5 sm:items-end">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 min-w-0 rounded-xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(24,27,49,0.04)] overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-5 py-3.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3.5 w-16" />
          </div>
          <div className="divide-y divide-border/70">
            {LOW_STOCK_ROWS.map((idx) => (
              <div key={idx} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(24,27,49,0.04)] overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border/70 px-5 py-3.5">
          <Skeleton className="h-4 w-32" />
        </div>
        <Table>
          <TableHeader className="bg-sidebar/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-5 text-xs font-medium text-muted-foreground">Order</TableHead>
              <TableHead className="px-5 text-xs font-medium text-muted-foreground">Customer</TableHead>
              <TableHead className="px-5 text-xs font-medium text-muted-foreground">Tier</TableHead>
              <TableHead className="px-5 text-xs font-medium text-muted-foreground">Status</TableHead>
              <TableHead className="px-5 text-right text-xs font-medium text-muted-foreground">Total</TableHead>
              <TableHead className="px-5 text-right text-xs font-medium text-muted-foreground">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TABLE_ROWS.map((idx) => (
              <TableRow key={idx}>
                <TableCell className="px-5 py-3.5">
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell className="px-5 py-3.5">
                  <Skeleton className="h-4 w-36" />
                </TableCell>
                <TableCell className="px-5 py-3.5">
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell className="px-5 py-3.5">
                  <Skeleton className="h-5 w-24 rounded-full" />
                </TableCell>
                <TableCell className="px-5 py-3.5">
                  <Skeleton className="ml-auto h-4 w-16" />
                </TableCell>
                <TableCell className="px-5 py-3.5">
                  <Skeleton className="ml-auto h-4 w-28" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
