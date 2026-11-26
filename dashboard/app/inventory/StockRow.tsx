'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/format';
import { LOW_STOCK_PACKS } from '@/lib/orders';
import { cn } from '@/lib/utils';
import { updateStockAction, type StockUpdateState } from './actions';

type StockRowProps = {
  sku: string;
  name: string;
  categoryLabel: string;
  unitCode: string;
  unitName: string | null;
  listPrice: number;
  initialQty: number;
};

export function StockRow({
  sku,
  name,
  categoryLabel,
  unitCode,
  unitName,
  listPrice,
  initialQty,
}: StockRowProps) {
  const initialState: StockUpdateState = {
    status: 'idle',
    message: null,
    stockQty: initialQty,
  };
  const [state, formAction, pending] = useActionState(
    updateStockAction,
    initialState
  );
  const [loadedQty, setLoadedQty] = useState(initialQty);
  const [inputValue, setInputValue] = useState(String(initialQty));
  const prevInitialQtyRef = useRef(initialQty);

  useEffect(() => {
    if (state.status === 'saved') {
      setLoadedQty(state.stockQty);
      prevInitialQtyRef.current = state.stockQty;
    }
  }, [state]);

  useEffect(() => {
    if (prevInitialQtyRef.current !== initialQty) {
      prevInitialQtyRef.current = initialQty;
      setLoadedQty(initialQty);
      setInputValue(String(initialQty));
    }
  }, [initialQty]);

  const stockBadge =
    loadedQty <= 0 ? (
      <Badge variant="destructive">Out</Badge>
    ) : loadedQty <= LOW_STOCK_PACKS ? (
      <Badge
        variant="outline"
        className="border-amber-300 bg-amber-50 text-amber-800"
      >
        Low
      </Badge>
    ) : null;

  return (
    <TableRow data-sku={sku}>
      <TableCell className="pl-4 md:pl-6 font-mono tabular-nums text-[13px] font-medium">
        {sku}
      </TableCell>
      <TableCell className="whitespace-normal min-w-[160px] font-medium">
        {name}
      </TableCell>
      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
        {categoryLabel}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="font-mono tabular-nums text-[13px]">{unitCode}</div>
        {unitName ? (
          <div className="text-xs text-muted-foreground">{unitName}</div>
        ) : null}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums text-[13px]">
        {formatCurrency(listPrice)}
      </TableCell>
      <TableCell className="pr-4 md:pr-6 text-right">
        <div className="inline-flex items-center justify-end gap-2">
          {stockBadge}
          <form
            action={formAction}
            className="inline-flex items-center justify-end gap-2"
            noValidate
          >
            <input type="hidden" name="sku" value={sku} />
            <input type="hidden" name="loadedQty" value={loadedQty} />
            <Input
              type="text"
              inputMode="numeric"
              name="stockQty"
              className="w-20 text-right font-mono tabular-nums h-8"
              aria-label={`Stock quantity for ${sku}`}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              disabled={pending}
            />
            <Button
              type="submit"
              size="sm"
              aria-label={`Save stock for ${sku}`}
              disabled={pending}
            >
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </form>
        </div>
        {state.message ? (
          <div
            className={cn(
              'mt-1.5 text-xs text-right',
              state.status === 'saved' ? 'text-emerald-600' : 'text-destructive'
            )}
            role={state.status === 'saved' ? 'status' : 'alert'}
          >
            {state.message}
          </div>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
