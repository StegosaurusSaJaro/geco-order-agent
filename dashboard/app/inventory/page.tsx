import { Suspense } from 'react';
import { AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { InventorySkeleton } from '@/components/InventorySkeleton';
import { Pagination } from '@/components/Pagination';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { one } from '@/lib/format';
import { pageWindow, parsePage, slicePage } from '@/lib/pagination';
import { requireUser } from '@/lib/supabase';
import { StockRow } from './StockRow';

export const dynamic = 'force-dynamic';

const INVENTORY_PAGE_SIZE = 20;

type ProductRow = {
  sku: string;
  name: string;
  unit_code: string;
  stock_qty: number | string;
  units_of_measure: { name: string } | { name: string }[] | null;
};

type SupabaseServerClient = Awaited<ReturnType<typeof requireUser>>['supabase'];

async function InventoryContent({
  supabase,
  requestedPage,
}: {
  supabase: SupabaseServerClient;
  requestedPage: number;
}) {
  const { data, error } = await supabase
    .from('products')
    .select('sku, name, unit_code, stock_qty, units_of_measure(name)')
    .eq('active', true)
    .order('sku', { ascending: true });

  const products = ((data ?? []) as ProductRow[]).map((row) => ({
    sku: row.sku,
    name: row.name,
    unitCode: row.unit_code,
    unitName: one(row.units_of_measure)?.name ?? null,
    stockQty: Number(row.stock_qty),
  }));
  const pages = pageWindow(requestedPage, products.length, INVENTORY_PAGE_SIZE);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight leading-tight">
          Inventory
        </h1>
        <p className="text-sm text-muted-foreground">
          {products.length} active{' '}
          {products.length === 1 ? 'product' : 'products'} · Whole packs only
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            Failed to load inventory: {error.message}
          </AlertDescription>
        </Alert>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No active products found.
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 py-0 overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 md:pl-6">SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right pr-4 md:pr-6">Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slicePage(products, pages).map((product) => (
                <StockRow
                  key={product.sku}
                  sku={product.sku}
                  name={product.name}
                  unitCode={product.unitCode}
                  unitName={product.unitName}
                  initialQty={product.stockQty}
                />
              ))}
            </TableBody>
          </Table>
          <Pagination
            pages={pages}
            basePath="/inventory"
            itemLabel="products"
          />
        </Card>
      )}
    </>
  );
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user } = await requireUser();
  const requestedPage = parsePage(await searchParams);

  return (
    <AppShell
      email={user.email}
      active="inventory"
      breadcrumb={[{ label: 'Inventory' }]}
    >
      <Suspense key={`page=${requestedPage}`} fallback={<InventorySkeleton />}>
        <InventoryContent supabase={supabase} requestedPage={requestedPage} />
      </Suspense>
    </AppShell>
  );
}
