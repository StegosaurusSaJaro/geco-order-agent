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

const PENDING_ROWS = [0, 1, 2];
const RECENT_ROWS = [0, 1, 2, 3, 4];

export default function SignupsLoading() {
  return (
    <AppShell email={undefined} active="signups" breadcrumb={[{ label: 'Sign-ups' }]}>
      <div className="flex flex-col gap-1">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <Card className="py-0 gap-0 overflow-hidden border-amber-300/90">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-amber-200/90 bg-amber-50/90 px-4 py-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3.5 w-28" />
        </CardHeader>
        <div className="divide-y divide-border">
          {PENDING_ROWS.map((idx) => (
            <div key={idx} className="flex flex-col gap-3.5 px-4 py-4">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3.5 w-28" />
                  </div>
                  <Skeleton className="h-3.5 w-32" />
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-md border border-border bg-sidebar/60 px-3 py-2.5 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-44 max-w-full" />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-32" />
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
          <Skeleton className="h-3.5 w-16" />
        </CardHeader>
        <Table>
          <TableHeader className="bg-sidebar">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                Customer / Business
              </TableHead>
              <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                Type &amp; Tier
              </TableHead>
              <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                Telegram
              </TableHead>
              <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                Outcome
              </TableHead>
              <TableHead className="px-4 text-right text-xs font-medium text-muted-foreground">
                Decided
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {RECENT_ROWS.map((idx) => (
              <TableRow key={idx}>
                <TableCell className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
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
