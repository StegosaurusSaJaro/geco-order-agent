export type PageWindow = {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
};

type ParamSource = Record<string, string | string[] | undefined>;

export function parsePage(source: ParamSource): number {
  const raw = source.page;
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

export function pageWindow(requestedPage: number, total: number, pageSize: number): PageWindow {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const from = (page - 1) * pageSize;
  const to = Math.min(from + pageSize, total);
  return { page, pageCount, total, from, to };
}

export function slicePage<T>(items: T[], pages: PageWindow): T[] {
  return items.slice(pages.from, pages.to);
}
