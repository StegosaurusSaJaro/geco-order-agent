import ExcelJS from 'exceljs';
import type { ExportRow, OrderFilters } from '@/lib/orders';

export const EXPORT_HEADERS = [
  'Order',
  'Customer',
  'Tier',
  'Status',
  'PO',
  'SKU',
  'Qty',
  'Unit',
  'Unit Price',
  'Line Total',
  'Created',
] as const;

function sanitizeText(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

function escapeCsvCell(value: string | number | null): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = typeof value === 'number' ? String(value) : sanitizeText(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(rows: ExportRow[]): string {
  const lines: string[] = [EXPORT_HEADERS.join(',')];
  for (const row of rows) {
    lines.push(
      [
        escapeCsvCell(row.order),
        escapeCsvCell(row.customer),
        escapeCsvCell(row.tier),
        escapeCsvCell(row.status),
        escapeCsvCell(row.po),
        escapeCsvCell(row.sku),
        escapeCsvCell(row.qty),
        escapeCsvCell(row.unit),
        escapeCsvCell(row.unitPrice !== null ? row.unitPrice.toFixed(2) : null),
        escapeCsvCell(row.lineTotal !== null ? row.lineTotal.toFixed(2) : null),
        escapeCsvCell(row.created),
      ].join(',')
    );
  }
  return lines.join('\r\n');
}

export async function buildXlsx(rows: ExportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GECO Order Dashboard';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Orders');
  sheet.columns = [
    { header: 'Order', key: 'order', width: 12 },
    { header: 'Customer', key: 'customer', width: 26 },
    { header: 'Tier', key: 'tier', width: 18 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'PO', key: 'po', width: 18 },
    { header: 'SKU', key: 'sku', width: 15 },
    { header: 'Qty', key: 'qty', width: 10 },
    { header: 'Unit', key: 'unit', width: 10 },
    { header: 'Unit Price', key: 'unitPrice', width: 13 },
    { header: 'Line Total', key: 'lineTotal', width: 13 },
    { header: 'Created', key: 'created', width: 24 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };

  for (const row of rows) {
    sheet.addRow({
      order: sanitizeText(row.order),
      customer: sanitizeText(row.customer),
      tier: sanitizeText(row.tier),
      status: sanitizeText(row.status),
      po: sanitizeText(row.po),
      sku: sanitizeText(row.sku),
      qty: row.qty,
      unit: sanitizeText(row.unit),
      unitPrice: row.unitPrice,
      lineTotal: row.lineTotal,
      created: sanitizeText(row.created),
    });
  }

  sheet.getColumn('unitPrice').numFmt = '#,##0.00';
  sheet.getColumn('lineTotal').numFmt = '#,##0.00';

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

export function exportFilename(filters: OrderFilters, ext: 'csv' | 'xlsx'): string {
  const parts = ['geco-orders'];
  if (filters.tier) parts.push(filters.tier);
  if (filters.status) parts.push(filters.status);
  if (filters.from) parts.push(`from-${filters.from}`);
  if (filters.to) parts.push(`to-${filters.to}`);
  return `${parts.join('-')}.${ext}`;
}
