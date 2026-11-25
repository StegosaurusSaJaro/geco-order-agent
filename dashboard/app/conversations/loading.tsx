import { AppShell } from '@/components/AppShell';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const TABLE_ROWS = [0, 1, 2, 3, 4, 5, 6, 7];

export default function ConversationsLoading() {
  return (
    <AppShell
      email={undefined}
      active="conversations"
      breadcrumb={[{ label: 'Conversations' }]}
    >
      <div className="flex flex-col gap-1.5 min-w-0">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-32" />
      </div>

      <Card className="gap-0 py-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">Customer</TableHead>
              <TableHead className="px-4">Tier</TableHead>
              <TableHead className="px-4">Last message</TableHead>
              <TableHead className="px-4 text-right">Messages</TableHead>
              <TableHead className="px-4 text-right">Orders</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TABLE_ROWS.map((idx) => (
              <TableRow key={idx}>
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-4 w-36" />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell className="px-4 py-3 min-w-[220px] max-w-[420px]">
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-64 max-w-full" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="ml-auto h-4 w-8" />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="ml-auto h-4 w-8" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </AppShell>
  );
}
