# Setup note

From a clean clone to a running bot, database and dashboard, in Windows PowerShell. Synthetic data only.

## Prerequisites

Git; Python 3.12+ with [uv](https://docs.astral.sh/uv/); Node.js 22+ with npm; PostgreSQL 18 for the local checks only. Tested with Git 2.54.0, Python 3.14.7, uv 0.11.7, Node 24.15.0, npm 11.12.1 and PostgreSQL 18.3.

```powershell
git clone https://github.com/StegosaurusSaJaro/geco-order-agent.git; cd geco-order-agent
```

## Accounts and free tools

- **Telegram:** create a bot with `@BotFather` (`/newbot`). **GitHub:** hosts the repository.
- **Supabase:** free-tier project. **Google AI Studio:** free-tier API key, in a project with **no billing account** linked.
- **Open source:** python-telegram-bot, Google ADK, psycopg, openpyxl, xlrd, fpdf2, Next.js, React, Tailwind CSS, Recharts, ExcelJS, PostgreSQL.

## Environment variables

Never commit either file. At the repository root, run `Copy-Item .env.example .env` (macOS or Linux: `cp`) for the bot. Create `dashboard/.env.local` by hand for the dashboard.

| Variable | File | Where it comes from |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | both | `@BotFather`; the dashboard uses it for staff replies |
| `SUPABASE_DB_URL` | `.env` | Supabase **Connect**: Postgres connection string with your database password |
| `GOOGLE_API_KEY` | `.env` | Google AI Studio; read by the Google library |
| `SUPABASE_URL` | `.env.local` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | `.env.local` | Supabase API keys: publishable, never secret |

Optional, with defaults in `load_settings` in `bot/geco_bot/config.py`: `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `REVIEW_THRESHOLD_USD`, `QUANTITY_FACTOR`, `QUANTITY_MIN_HISTORY`, `POLL_SECONDS`, `FLOOD_MAX_MESSAGES`, `FLOOD_WINDOW_SECONDS`.

## Database

On a new Supabase project, run these in the **SQL Editor**, one file at a time: every file in `supabase/migrations/` in filename order, then `supabase/seed.sql`, then `supabase/stock.sql`. Never run `supabase/tests/` there.

## Link a test Telegram account

Start the bot (below) and send it `hi`. This starts a sign-up that records your Telegram ID. Find it in the SQL Editor:

```sql
select telegram_user_id, telegram_username, created_at from signups order by created_at desc limit 5;
```

Link it to `Kapé Corner` (café) or `Harbourline Hotel Manila` (hotel), which have no account yet:

```sql
update customers set telegram_user_id = <YOUR_TELEGRAM_USER_ID> where name = 'Kapé Corner';
```

## Run the bot

In its own terminal, from the repository root, run one copy per bot token:

```powershell
cd bot; uv sync; uv run python -m geco_bot.main
```

After linking, send `2 bags arabica tmr`; expect a priced draft with Confirm and Cancel buttons.

## Run the dashboard

In Supabase **Authentication**, add a confirmed email and password user (the staff login) and turn off public sign-ups: every signed-in user gets staff access. In a second terminal from the repository root:

```powershell
cd dashboard; npm ci; npm run build; npm start
```

At `✓ Ready in`, open `http://localhost:3000` and sign in. `Ctrl+C` stops either program.

## Check it works

No cloud credentials needed. Run each from the repository root.

- **Database** (Windows, default PostgreSQL 18 folder): `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-db.ps1` ends with `CHECK-DB PASS`.
- **Bot tests:** `cd bot; uv sync; uv run pytest tests` ends with `passed` and no failures.
- **Dashboard build:** `cd dashboard; npm ci; npm run build` prints a `Route (app)` table and no error.

## Troubleshooting

**`npm start` fails with `EADDRINUSE`, or the page shows old behaviour after a rebuild.** An earlier `next start` is still running and still answers on the port. Find it:

```powershell
$id = (Get-NetTCPConnection -LocalPort 3000 -State Listen).OwningProcess | Select-Object -Unique
Get-CimInstance Win32_Process -Filter "ProcessId=$id" | Select-Object ProcessId, CommandLine
```

If the command line shows this project's old `next start`, run `Stop-Process -Id $id`, then `npm start` again.
