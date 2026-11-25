import { Nav } from '@/components/Nav';
import { one } from '@/lib/format';
import { requireUser } from '@/lib/supabase';
import { StockRow } from './StockRow';

export const dynamic = 'force-dynamic';

type ProductRow = {
  sku: string;
  name: string;
  unit_code: string;
  stock_qty: number | string;
  units_of_measure: { name: string } | { name: string }[] | null;
};

export default async function InventoryPage() {
  const { supabase, user } = await requireUser();
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

  return (
    <>
      <Nav email={user.email} active="inventory" />
      <main className="container">
        <div className="page-header">
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">
            {products.length} active {products.length === 1 ? 'product' : 'products'} · Whole packs only
          </p>
        </div>

        {error ? (
          <div className="error-box">Failed to load inventory: {error.message}</div>
        ) : products.length === 0 ? (
          <div className="card">
            <div className="empty">No active products found.</div>
          </div>
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Unit</th>
                    <th className="num">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <StockRow
                      key={product.sku}
                      sku={product.sku}
                      name={product.name}
                      unitCode={product.unitCode}
                      unitName={product.unitName}
                      initialQty={product.stockQty}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
