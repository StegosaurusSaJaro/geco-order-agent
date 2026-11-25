'use client';

import { useActionState, useState } from 'react';
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
    <tr data-sku={sku}>
      <td className="mono">{sku}</td>
      <td>{name}</td>
      <td>
        <span className="mono">{unitCode}</span>
        {unitName ? <div className="muted">{unitName}</div> : null}
      </td>
      <td className="num stock-cell">
        <form action={formAction} className="stock-form" noValidate>
          <input type="hidden" name="sku" value={sku} />
          <input type="hidden" name="loadedQty" value={state.stockQty} />
          <input
            type="text"
            inputMode="numeric"
            name="stockQty"
            className="input stock-input"
            aria-label={`Stock quantity for ${sku}`}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            disabled={pending}
          />
          <button
            type="submit"
            className="btn btn-primary"
            aria-label={`Save stock for ${sku}`}
            disabled={pending}
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </form>
        {state.message ? (
          <div
            className={`stock-msg ${
              state.status === 'saved' ? 'stock-msg-ok' : 'stock-msg-err'
            }`}
            role={state.status === 'saved' ? 'status' : 'alert'}
          >
            {state.message}
          </div>
        ) : null}
      </td>
    </tr>
  );
}
