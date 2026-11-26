$ErrorActionPreference = 'Stop'

$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$initdb = Join-Path $pgBin 'initdb.exe'
$pgCtl = Join-Path $pgBin 'pg_ctl.exe'
$psql = Join-Path $pgBin 'psql.exe'

$repoRoot = Split-Path -Parent $PSScriptRoot
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
$dataDir = Join-Path $tempDir 'data'
$logFile = Join-Path $tempDir 'postgres.log'

New-Item -ItemType Directory -Path $tempDir | Out-Null

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$listener.Stop()

$started = $false

try {
  & $initdb -D $dataDir -U postgres -A trust --encoding=UTF8 --locale=C
  if ($LASTEXITCODE -ne 0) {
    throw "initdb failed with exit code $LASTEXITCODE"
  }

  & $pgCtl -D $dataDir -l $logFile -o "-p $port -h 127.0.0.1" -w start
  if ($LASTEXITCODE -ne 0) {
    throw "pg_ctl start failed with exit code $LASTEXITCODE"
  }
  $started = $true

  foreach ($relPath in @(
    'supabase/tests/stubs.sql',
    'supabase/migrations/20261123000000_init.sql',
    'supabase/migrations/20261124000000_staff_order_message_links.sql',
    'supabase/migrations/20261124000100_product_stock.sql',
    'supabase/migrations/20261125000000_review_order.sql',
    'supabase/migrations/20261126000000_realtime.sql',
    'supabase/migrations/20261127000000_receipts.sql',
    'supabase/migrations/20261127000100_flagged_messages.sql',
    'supabase/migrations/20261127000200_signups.sql',
    'supabase/migrations/20261127000300_reject_notice.sql',
    'supabase/seed.sql',
    'supabase/stock.sql',
    'supabase/tests/check.sql'
  )) {
    $sqlFile = Join-Path $repoRoot $relPath
    & $psql -h 127.0.0.1 -p $port -U postgres -d postgres -v ON_ERROR_STOP=1 -f $sqlFile
    if ($LASTEXITCODE -ne 0) {
      throw "psql failed on $relPath with exit code $LASTEXITCODE"
    }
  }

  Write-Output 'CHECK-DB PASS'
}
finally {
  if ($started) {
    & $pgCtl -D $dataDir -m immediate -w stop | Out-Null
  }
  if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
  }
}
