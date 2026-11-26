'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/supabase';

export type StockUpdateState = {
  status: 'idle' | 'saved' | 'stale' | 'error';
  message: string | null;
  stockQty: number;
};

export async function updateStockAction(
  prevState: StockUpdateState,
  formData: FormData
): Promise<StockUpdateState> {
  const sku = String(formData.get('sku') ?? '').trim();
  const rawQty = String(formData.get('stockQty') ?? '').trim();
  const rawLoaded = String(formData.get('loadedQty') ?? '').trim();
  const loadedQty = Number(rawLoaded);

  if (!sku || !rawLoaded || !Number.isFinite(loadedQty) || loadedQty < 0) {
    return {
      status: 'error',
      message: 'Invalid product data, reload the page.',
      stockQty: prevState.stockQty,
    };
  }

  if (!rawQty || !/^\d+$/.test(rawQty)) {
    return {
      status: 'error',
      message: 'Enter a whole number (0 or more).',
      stockQty: loadedQty,
    };
  }

  const newQty = Number.parseInt(rawQty, 10);
  const maxStockQty = 99999999;
  if (!Number.isSafeInteger(newQty) || newQty < 0 || newQty > maxStockQty) {
    return {
      status: 'error',
      message: 'Enter a whole number (0 or more).',
      stockQty: loadedQty,
    };
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from('products')
    .update({ stock_qty: newQty })
    .eq('sku', sku)
    .eq('stock_qty', loadedQty)
    .select('sku, stock_qty');

  if (error) {
    return {
      status: 'error',
      message: error.message,
      stockQty: loadedQty,
    };
  }

  if (!data || data.length === 0) {
    return {
      status: 'stale',
      message: 'Stock changed since you loaded this page, reload',
      stockQty: loadedQty,
    };
  }

  revalidatePath('/inventory');
  revalidatePath('/orders');
  const savedQty = Number(data[0].stock_qty);
  return {
    status: 'saved',
    message: 'Saved',
    stockQty: Number.isFinite(savedQty) ? savedQty : newQty,
  };
}
