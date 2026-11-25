import { NextResponse, type NextRequest } from 'next/server';
import { buildCsv, buildXlsx, exportFilename } from '@/lib/export';
import { buildExportRows, fetchOrdersData, parseOrderFilters } from '@/lib/orders';
import { createSupabaseServerClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formatParam = (request.nextUrl.searchParams.get('format') ?? 'csv').toLowerCase();
  if (formatParam !== 'csv' && formatParam !== 'xlsx') {
    return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
  }

  const filters = parseOrderFilters(request.nextUrl.searchParams);
  const { orders, lines, error } = await fetchOrdersData(supabase, filters);

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const rows = buildExportRows(orders, lines);
  const filename = exportFilename(filters, formatParam);

  if (formatParam === 'csv') {
    const csv = buildCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const buffer = await buildXlsx(rows);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
