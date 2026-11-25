'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { updateStockAction, type StockUpdateState } from './actions';

type StockRowProps = {
  sku: string;
  name: string;
  unitCode: string;
  unitName: string | null;
  initialQty: number;
};

export function StockRow({
  sku,
  name,
  unitCode,
  unitName,
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
  const [inputValue, setInputValue] = useState(String(initialQty));

  return (
    <TableRow data-sku={sku}>
      <TableCell className="pl-4 md:pl-6 font-mono tabular-nums text-[13px] font-medium">
        {sku}
      </TableCell>
      <TableCell className="whitespace-normal min-w-[160px] font-medium">
        {name}
      </TableCell>
      <TableCell>
        <div className="font-mono tabular-nums text-[13px]">{unitCode}</div>
        {unitName ? (
          <div className="text-xs text-muted-foreground">{unitName}</div>
        ) : null}
      </TableCell>
      <TableCell className="pr-4 md:pr-6 text-right">
        <form
          action={formAction}
          className="inline-flex items-center justify-end gap-2"
          noValidate
        >
          <input type="hidden" name="sku" value={sku} />
          <input type="hidden" name="loadedQty" value={state.stockQty} />
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
