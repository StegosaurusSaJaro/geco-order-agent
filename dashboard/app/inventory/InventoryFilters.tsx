'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type CategoryOption = {
  value: string;
  label: string;
};

type InventoryFiltersProps = {
  category: string;
  q: string;
  categories: readonly CategoryOption[];
};

const SELECT_CLASS =
  'h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring';

function buildInventoryUrl(category: string, q: string): string {
  const params = new URLSearchParams();
  if (category) {
    params.set('category', category);
  }
  const trimmed = q.trim();
  if (trimmed) {
    params.set('q', trimmed);
  }
  const qs = params.toString();
  return qs ? `/inventory?${qs}` : '/inventory';
}

export function InventoryFilters({
  category,
  q,
  categories,
}: InventoryFiltersProps) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(q);
  const hasActiveFilters = Boolean(category || q);

  useEffect(() => {
    setSearchValue(q);
  }, [q]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(buildInventoryUrl(category, searchValue));
  }

  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          method="GET"
          action="/inventory"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col gap-1.5 sm:w-56">
            <Label htmlFor="inventory-category" className="text-xs text-muted-foreground">
              Category
            </Label>
            <select
              id="inventory-category"
              name="category"
              className={SELECT_CLASS}
              value={category}
              onChange={(event) =>
                router.push(buildInventoryUrl(event.target.value, searchValue))
              }
            >
              <option value="">All categories</option>
              {categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="inventory-search" className="text-xs text-muted-foreground">
              Search
            </Label>
            <Input
              id="inventory-search"
              type="search"
              name="q"
              className="bg-background"
              placeholder="Search by SKU or product name"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:pb-0.5">
            <Button type="submit" size="sm">
              Search
            </Button>
            {hasActiveFilters ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/inventory">Reset</Link>
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
