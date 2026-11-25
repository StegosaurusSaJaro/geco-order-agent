import { AppShell } from '@/components/AppShell';
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

const SUMMARY_ITEMS = [0, 1, 2, 3, 4, 5, 6];
const LINE_ROWS = [0, 1, 2, 3, 4];

export default function OrderDetailLoading() {
  return (
    <AppShell
      email={undefined}
      active="orders"
      breadcrumb={[{ label: 'Orders', href: '/orders' }, { label: 'Order' }]}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
        <div className="min-w-0 flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-44" />
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>

      <Card className="gap-0 py-0 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b py-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </CardHeader>
        <CardContent className="py-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {SUMMARY_ITEMS.map((idx) => (
              <div key={idx} className="flex flex-col gap-1.5 min-w-0">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b py-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-16" />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 text-right">#</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="pr-6 text-right">Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LINE_ROWS.map((idx) => (
                <TableRow key={idx}>
                  <TableCell className="pl-6">
                    <Skeleton className="ml-auto h-4 w-5" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-44" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ml-auto h-4 w-10" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ml-auto h-4 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ml-auto h-4 w-16" />
                  </TableCell>
                  <TableCell className="pr-6">
                    <Skeleton className="ml-auto h-4 w-16" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-2 py-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-20" />
        </CardHeader>
      </Card>
    </AppShell>
  );
}
