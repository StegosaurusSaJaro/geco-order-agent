import { Fragment, Suspense } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { InventorySkeleton } from '@/components/InventorySkeleton';
import { Pagination } from '@/components/Pagination';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { one } from '@/lib/format';
import { pageWindow, parsePage, slicePage } from '@/lib/pagination';
import { requireUser } from '@/lib/supabase';
import { InventoryFilters } from './InventoryFilters';
import { StockRow } from './StockRow';

export const dynamic = 'force-dynamic';

const INVENTORY_PAGE_SIZE = 10;

const CATEGORY_LABELS = {
  dairy: 'Dairy',
  coffee_tea: 'Coffee & Tea',
  dry_goods: 'Dry Goods',
  sauces: 'Sauces',
  packaging: 'Packaging',
} as const;

type CategoryKey = keyof typeof CATEGORY_LABELS;

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as CategoryKey[];

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label })
);

function isCategoryKey(value: string): value is CategoryKey {
  return Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, value);
}

function categorySortIndex(category: string): number {
  const index = CATEGORY_ORDER.indexOf(category as CategoryKey);
  return index === -1 ? 999 : index;
}

function categoryLabel(category: string): string {
  return isCategoryKey(category) ? CATEGORY_LABELS[category] : category;
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

type ProductRow = {
  sku: string;
  name: string;
  category: string;
  unit_code: string;
  list_price: number | string;
  stock_qty: number | string;
  units_of_measure: { name: string } | { name: string }[] | null;
};

type SupabaseServerClient = Awaited<ReturnType<typeof requireUser>>['supabase'];

async function InventoryContent({
  supabase,
  requestedPage,
  category,
  q,
}: {
  supabase: SupabaseServerClient;
  requestedPage: number;
  category: string;
  q: string;
}) {
  const { data, error } = await supabase
    .from('products')
    .select(
      'sku, name, category, unit_code, list_price, stock_qty, units_of_measure(name)'
    )
    .eq('active', true)
    .order('sku', { ascending: true });

  const allProducts = ((data ?? []) as ProductRow[])
    .map((row) => ({
      sku: row.sku,
      name: row.name,
      category: row.category,
      categoryLabel: categoryLabel(row.category),
      unitCode: row.unit_code,
      unitName: one(row.units_of_measure)?.name ?? null,
      listPrice: Number(row.list_price),
      stockQty: Number(row.stock_qty),
    }))
    .sort((a, b) => {
      const orderDiff =
        categorySortIndex(a.category) - categorySortIndex(b.category);
      if (orderDiff !== 0) return orderDiff;
      return a.sku.localeCompare(b.sku);
    });

  const needle = q.toLowerCase();
  const filtered = allProducts.filter((product) => {
    if (category && product.category !== category) return false;
    if (
      needle &&
      !product.sku.toLowerCase().includes(needle) &&
      !product.name.toLowerCase().includes(needle)
    ) {
      return false;
    }
    return true;
  });

  const pages = pageWindow(requestedPage, filtered.length, INVENTORY_PAGE_SIZE);
  const visible = slicePage(filtered, pages);
  const hasFilters = Boolean(category || q);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight leading-tight">
          Inventory
        </h1>
        <p className="text-sm text-muted-foreground">
          {hasFilters
            ? `${filtered.length} of ${allProducts.length} ${allProducts.length === 1 ? 'product' : 'products'} · Whole packs only`
            : `${allProducts.length} active ${allProducts.length === 1 ? 'product' : 'products'} · Whole packs only`}
        </p>
      </div>

      <InventoryFilters
        category={category}
        q={q}
        categories={CATEGORY_OPTIONS}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            Failed to load inventory: {error.message}
          </AlertDescription>
        </Alert>
      ) : hasFilters && filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
            <p>No products match.</p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/inventory">Clear filters</Link>
            </Button>
          </CardContent>
        </Card>
      ) : allProducts.length === 0 ? (
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
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="hidden md:table-cell">Unit</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right pr-4 md:pr-6">Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((product, idx) => {
                const showCategoryHeading =
                  idx === 0 || visible[idx - 1].category !== product.category;
                return (
                  <Fragment key={product.sku}>
                    {showCategoryHeading && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell
                          colSpan={6}
                          className="pl-4 md:pl-6 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                          {product.categoryLabel}
                        </TableCell>
                      </TableRow>
                    )}
                    <StockRow
                      sku={product.sku}
                      name={product.name}
                      categoryLabel={product.categoryLabel}
                      unitCode={product.unitCode}
                      unitName={product.unitName}
                      listPrice={product.listPrice}
                      initialQty={product.stockQty}
                    />
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
          <Pagination
            pages={pages}
            basePath="/inventory"
            params={{ category, q }}
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
  const resolvedParams = await searchParams;
  const requestedPage = parsePage(resolvedParams);
  const rawCategory = firstParam(resolvedParams.category);
  const category = isCategoryKey(rawCategory) ? rawCategory : '';
  const q = firstParam(resolvedParams.q).trim();

  return (
    <AppShell
      email={user.email}
      active="inventory"
      breadcrumb={[{ label: 'Inventory' }]}
    >
      <Suspense
        key={`page=${requestedPage}&category=${category}&q=${q}`}
        fallback={<InventorySkeleton />}
      >
        <InventoryContent
          supabase={supabase}
          requestedPage={requestedPage}
          category={category}
          q={q}
        />
      </Suspense>
    </AppShell>
  );
}
