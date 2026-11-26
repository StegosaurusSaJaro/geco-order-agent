import { AppShell } from '@/components/AppShell';
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

const HELD_ROWS = [0, 1, 2];
const RECENT_ROWS = [0, 1, 2, 3, 4];

export default function FlaggedLoading() {
  return (
    <AppShell email={undefined} active="flagged" breadcrumb={[{ label: 'Flagged' }]}>
      <div className="flex flex-col gap-1">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-72" />
      </div>

      <Card className="py-0 gap-0 overflow-hidden border-amber-300/90">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-amber-200/90 bg-amber-50/90 px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3.5 w-20" />
        </CardHeader>
        <div className="divide-y divide-border">
          {HELD_ROWS.map((idx) => (
            <div
              key={idx}
              className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex flex-col gap-2 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-5 w-28 rounded-full" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
                <Skeleton className="h-4 w-64 max-w-full" />
                <Skeleton className="h-4 w-80 max-w-full" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="py-0 gap-0 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3.5 w-20" />
        </CardHeader>
        <Table>
          <TableHeader className="bg-sidebar">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4 text-xs font-medium text-muted-foreground">Customer</TableHead>
              <TableHead className="px-4 text-xs font-medium text-muted-foreground">Flag</TableHead>
              <TableHead className="px-4 text-xs font-medium text-muted-foreground">Message</TableHead>
              <TableHead className="px-4 text-xs font-medium text-muted-foreground">Outcome</TableHead>
              <TableHead className="px-4 text-right text-xs font-medium text-muted-foreground">Reviewed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {RECENT_ROWS.map((idx) => (
              <TableRow key={idx}>
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-5 w-24 rounded-full" />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-4 w-56" />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="ml-auto h-4 w-28" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </AppShell>
  );
}
