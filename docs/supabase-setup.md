# Supabase setup (Kulak)

Everything here happens either in **browser: supabase.com** or in your **terminal**.
The app talks to Supabase only from the server, with the service-role key. No
Postgres connection string, no database password, no anon key is used by the app.

## 0. What you need
- A free Supabase account and one new project.
- The SQL files already in this repo: `supabase/schema.sql`, `supabase/seed.sql`,
  `supabase/reset.sql`.

## 1. Create the project — browser: supabase.com
1. Open https://supabase.com and sign in (GitHub or email).
2. **New project**.
3. Fill in:
   - **Name**: `kulak`
   - **Database Password**: click **Generate a password** and store it in your
     password manager. Kulak does not use it, but do not lose it.
   - **Region**: `Southeast Asia (Singapore)` — closest to Indonesia. This cannot
     be changed later.
   - **Plan**: Free.
4. **Create new project** and wait ~2 minutes until the project is ready.
5. Note the **project ref**: the `xxxx` part of `https://xxxx.supabase.co`.

## 2. Copy credentials — browser: supabase.com, project `kulak`
1. **Project Settings** (gear, bottom left) → **API** (newer dashboards:
   **Project Settings → API Keys**).
2. Copy two values:
   - **Project URL**: `https://xxxx.supabase.co` (no trailing slash).
   - **`service_role` key** (label `service_role` or `secret`, starts with `eyJ...`
     or `sb_secret_...`). Click **Reveal**, then copy.
3. Do **not** use the `anon` / `publishable` key: RLS is enabled with no policies,
   so it can read nothing. Never put the service-role key in browser code and
   never use a `NEXT_PUBLIC_` prefix.

> If the dashboard only offers new keys (`sb_secret_...`), that works too — `@supabase/supabase-js`
> sends it as the `apikey` header. If **Legacy API keys** are listed, prefer the
> `service_role` JWT for maximum compatibility.

## 3. Run the schema — browser: supabase.com → SQL Editor
1. Open `supabase/schema.sql` and copy all of it.
2. **SQL Editor** → **New query** → paste → **Run** (`Ctrl+Enter`).
3. Expected: "Success. No rows returned". Safe to run twice.

Creates `items`, `suppliers`, `supplier_quotes`, `mandate`, `purchase_orders`,
`po_lines`, `events`, with RLS enabled and no policies (service-role only).

## 4. Run the seed — browser: still SQL Editor
1. Copy `supabase/seed.sql` into a new query and **Run**.
2. Expected: "Success. No rows returned". Safe to run twice.

Seeds 1 mandate row (manual, $450 week, $200 auto cap, $600 hard cap, 2.5x, 20%),
6 items, 5 suppliers (`CheapBeans Trading` unapproved and cheapest), 9 quotes.

## 5. Verify — browser: SQL Editor
```sql
select count(*) from items;             -- 6
select count(*) from suppliers;         -- 5
select count(*) from supplier_quotes;   -- 9
select count(*) from mandate;           -- 1

select sku, stock, reorder_point,
       case when stock < reorder_point then 'LOW' else 'OK' end as flag
from items order by sku;

select name, approved from suppliers order by name;
```
Expect 5 items `LOW` (BEANS 6/8, MILK-WHL 14/30, CUP-12 180/400, LID-12 220/400,
SYR-VAN 3/4) and `CheapBeans Trading` with `approved = false`.

## 6. Fill `.env.local` — terminal (your machine, never commit it)
```bash
cd /home/nino/Documents/project/paypal
cp .env.example .env.local
nano .env.local
```
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
Confirm `.env*` is in `.gitignore` before any commit.

## 7. Verify the app connection — terminal (after task T1)
```bash
npm run dev
curl -s http://localhost:3000/api/health
```
Expected: `{"ok":true,"db":true,"time":"..."}`. `db:false` means the URL/key is
wrong or the dev server was not restarted after editing `.env.local`.

## 8. Reset the demo — browser: SQL Editor
Before each rehearsal or take, run `supabase/reset.sql`: clears POs and events,
restores stock and the default mandate. The "Reset demo" button calls the same
logic via `POST /api/sim/reset`.

## 9. Notes
- **Free plan pauses projects after ~1 week of inactivity**, and the demo must
  stay up until 15 Dec 2026. Either ping `/api/health` every 2–3 days (GitHub
  Actions cron) or upgrade to Pro.
- `numeric` columns come back as strings from supabase-js. Convert to numbers in
  `lib/repo.ts` only, not scattered across the code.
- RLS is enabled with no policies by design: the browser has no database access.

## 10. Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| `relation "items" does not exist` | schema not run, or wrong project | rerun step 3, check the project ref |
| `/api/health` → `db:false` | trailing slash in URL, wrong/truncated key, server not restarted | fix `.env.local`, restart `npm run dev` |
| `Invalid API key` | anon key, or truncated copy | re-copy `service_role` |
| `new row violates row-level security policy` | anon key in use | use the service-role key |
| Project paused | free tier idle | Restore in the dashboard, then add a cron ping |
