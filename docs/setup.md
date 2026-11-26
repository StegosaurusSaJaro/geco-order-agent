# Setup note

From a clean clone to a running bot, database and staff dashboard. Commands are for Windows PowerShell. Synthetic data only.

## Prerequisites

| Tool | Needed | Tested with |
|---|---|---|
| Git | any recent | 2.54.0 |
| Python and [uv](https://docs.astral.sh/uv/) | Python 3.12+ | Python 3.14.7, uv 0.11.7 |
| Node.js and npm | Node 22+ | Node 24.15.0, npm 11.12.1 |
| PostgreSQL | 18, only for the local checks | 18.3 |

```powershell
git clone https://github.com/StegosaurusSaJaro/geco-order-agent.git
cd geco-order-agent
```

## Accounts and free tools

- **Telegram:** create a bot with `@BotFather` (`/newbot`) and keep its token.
- **Supabase:** create a project on the free tier.
- **Google AI Studio:** create an API key on the free tier, in a project with **no billing account** linked.
- **GitHub:** hosts the repository.

The rest is open source: python-telegram-bot, Google ADK, psycopg, openpyxl, xlrd, fpdf2, Next.js, React, Tailwind CSS, Recharts, ExcelJS and PostgreSQL.

## Environment variables

Never commit either file. For the bot, run `Copy-Item .env.example .env` at the repository root (macOS or Linux: `cp`), then make sure `.env` has these:

| Bot variable | Where it comes from |
|---|---|
| `TELEGRAM_BOT_TOKEN` | `@BotFather` |
| `SUPABASE_DB_URL` | Supabase project, **Connect**: Postgres connection string with your database password |
| `GOOGLE_API_KEY` | Google AI Studio; read by the Google library |

Optional, with defaults: `GEMINI_MODEL` (`gemini-3.5-flash-lite`), `GEMINI_FALLBACK_MODEL` (`gemini-3.1-flash-lite`), `REVIEW_THRESHOLD_USD` (`2000`), `QUANTITY_FACTOR` (`3`), `QUANTITY_MIN_HISTORY` (`2`), `POLL_SECONDS` (`5`), `FLOOD_MAX_MESSAGES` (`8`), `FLOOD_WINDOW_SECONDS` (`60`).

For the dashboard, create `dashboard/.env.local` by hand. It does not use the root `.env`.

| Dashboard variable | Where it comes from |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase project API keys: the publishable key, never the secret one |
| `TELEGRAM_BOT_TOKEN` | Same bot token; sends staff replies |

## Database

On a new Supabase project, open the **SQL Editor** and run, one file at a time:

1. Every file in `supabase/migrations/`, in filename order.
2. `supabase/seed.sql`.
3. `supabase/stock.sql`.

Do not run anything in `supabase/tests/` on Supabase; those files are for the local check.

## Link a test Telegram account

Start the bot (next section) and send it `hi` from your account. It starts a sign-up that records your Telegram ID. Find the ID in the SQL Editor:

```sql
select telegram_user_id, telegram_username, created_at from signups order by created_at desc limit 5;
```

Link your row's ID to a seeded customer. `Kapé Corner` (café, list price) and `Harbourline Hotel Manila` (hotel, 10% off) have no account yet. Each ID can belong to only one customer.

```sql
update customers set telegram_user_id = <YOUR_TELEGRAM_USER_ID> where name = 'Kapé Corner';
```

## Run the bot

In its own terminal, from the repository root. Run only one copy per bot token.

```powershell
cd bot
uv sync
uv run python -m geco_bot.main
```

After linking, send `pls send 3 ctn oat milk + 2 bags arabica tmr`. Expect a priced draft with Confirm and Cancel buttons.

## Run the dashboard

In Supabase, open **Authentication**, then **Users**, and add a user with an email, a password and the email marked as confirmed. This is the staff login. Turn off public sign-ups in the Authentication settings, because every signed-in user gets staff access. Then, in a second terminal from the repository root:

```powershell
cd dashboard
npm ci
npm run build
npm start
```

Open `http://localhost:3000` and sign in. Stop either program with `Ctrl+C`.

## Check it works

These use no cloud credentials. Run each block from the repository root. The database check and the bot tests use throwaway local PostgreSQL servers.

| Check | Command | Healthy output |
|---|---|---|
| Database (Windows only; expects `C:\Program Files\PostgreSQL\18\bin`) | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-db.ps1` | last line `CHECK-DB PASS` |
| Bot tests | `cd bot; uv sync; uv run pytest tests` | last line says `passed`, with no failures |
| Dashboard build | `cd dashboard; npm ci; npm run build` | a `Route (app)` table and no error |
| Dashboard start (after the build; needs port 3000 free) | `cd dashboard; npm start` | `✓ Ready in` followed by the time |

If PostgreSQL is elsewhere, set `$env:PG_BIN` to its `bin` folder before the bot tests (macOS or Linux, not tested: `PG_BIN=/path/to/bin uv run pytest tests`).

## Troubleshooting

**`npm start` fails with `EADDRINUSE`, or the page shows old behaviour after a rebuild.** An earlier `next start` is still running and still answers on the port. Find it:

```powershell
$id = (Get-NetTCPConnection -LocalPort 3000 -State Listen).OwningProcess | Select-Object -Unique
Get-CimInstance Win32_Process -Filter "ProcessId=$id" | Select-Object ProcessId, CommandLine
```

If the command line shows this project's old `next start`, run `Stop-Process -Id $id`, then `npm start` again.

**`Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY`.** Check `dashboard/.env.local`, then restart the dashboard.

**The bot stops with `KeyError`.** The named required variable is missing from the root `.env`.
