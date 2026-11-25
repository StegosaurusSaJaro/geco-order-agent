import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const FILTER_FIELDS = [0, 1, 2, 3];
const CHART_CARDS = [0, 1, 2, 3];
const TABLE_ROWS = [0, 1, 2, 3, 4, 5, 6, 7];

export function ReportsSkeleton() {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] leading-tight">Reports</h1>
          <Skeleton className="mt-1.5 h-4 w-44" />
        </div>
      </div>

      <Card className="py-4">
        <CardContent className="px-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {FILTER_FIELDS.map((idx) => (
              <div key={idx} className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-12" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-border">
            <Skeleton className="h-8 w-24" />
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="Loading order charts">
        {CHART_CARDS.map((idx) => (
          <Card key={idx} className="py-0 gap-0 min-w-0">
            <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3.5 w-20" />
            </CardHeader>
            <CardContent className="p-4">
              <Skeleton className="h-[220px] w-full" />
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="py-0 gap-0 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3.5 w-28" />
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
