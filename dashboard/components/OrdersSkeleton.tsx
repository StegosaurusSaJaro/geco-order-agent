import { Card, CardHeader } from '@/components/ui/card';
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
const REVIEW_ROWS = [0, 1];
const TABLE_ROWS = [0, 1, 2, 3, 4, 5, 6, 7];

export function OrdersSkeleton() {
  return (
    <>
      <section aria-label="Loading metrics" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {METRIC_TILES.map((idx) => (
          <div
            key={idx}
            className="grid gap-2 rounded-lg border border-border bg-card px-4 py-3.5 shadow-xs"
          >
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </section>

      <Card className="py-0 gap-0 overflow-hidden border-amber-300/90">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-amber-200/90 bg-amber-50/90 px-4 py-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3.5 w-24" />
        </CardHeader>
        <div className="divide-y divide-border">
          {REVIEW_ROWS.map((idx) => (
            <div
              key={idx}
              className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
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
      </Card>

      <Card className="py-0 gap-0 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3.5 w-40" />
        </CardHeader>
        <Table>
          <TableHeader className="bg-sidebar">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4 text-xs font-medium text-muted-foreground">Order</TableHead>
              <TableHead className="px-4 text-xs font-medium text-muted-foreground">Customer</TableHead>
              <TableHead className="px-4 text-xs font-medium text-muted-foreground">Tier</TableHead>
              <TableHead className="px-4 text-xs font-medium text-muted-foreground">Status</TableHead>
              <TableHead className="px-4 text-right text-xs font-medium text-muted-foreground">Total</TableHead>
              <TableHead className="px-4 text-right text-xs font-medium text-muted-foreground">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TABLE_ROWS.map((idx) => (
              <TableRow key={idx}>
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-4 w-36" />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-5 w-24 rounded-full" />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="ml-auto h-4 w-16" />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="ml-auto h-4 w-28" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
