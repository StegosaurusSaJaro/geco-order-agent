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

export function InventorySkeleton() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight leading-tight">
          Inventory
        </h1>
        <Skeleton className="mt-0.5 h-4 w-56" />
      </div>

      <Card className="gap-0 py-0 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4 md:pl-6">SKU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="hidden md:table-cell">Category</TableHead>
              <TableHead className="hidden md:table-cell">Unit</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right pr-4 md:pr-6">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TABLE_ROWS.map((idx) => (
              <TableRow key={idx}>
                <TableCell className="pl-4 md:pl-6 py-3">
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className="py-3">
                  <Skeleton className="h-4 w-48" />
                </TableCell>
                <TableCell className="hidden md:table-cell py-3">
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className="hidden md:table-cell py-3">
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell className="py-3 text-right">
                  <Skeleton className="ml-auto h-4 w-16" />
                </TableCell>
                <TableCell className="pr-4 md:pr-6 py-3">
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
