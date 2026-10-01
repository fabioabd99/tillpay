# Tillpay

Personal finance app. The home screen shows how much you can spend until your next payday, after
the bills that are still due.

**Live demo:** https://tillpay.vercel.app (click **Open the demo**, no sign-up needed)

![Tillpay home screen](.github/assets/home.png)

Features: accounts, transactions, transfers, categories, monthly budgets, recurring transactions,
reports and CSV export.

## Stack

Next.js 16 (App Router), TypeScript, PostgreSQL, Drizzle, Zod, Better Auth, Tailwind 4, shadcn/ui,
Recharts, nuqs, Vitest and Playwright.

## Getting started

Requires Node 22+, pnpm and Docker.

```bash
pnpm install
cp .env.example .env          # fill in BETTER_AUTH_SECRET and CRON_SECRET
docker compose up -d          # Postgres 17 on 127.0.0.1:5433
pnpm db:migrate
pnpm db:seed                  # optional, local demo user for development and tests
pnpm dev
```

Open http://localhost:3000 and click **Open the demo**. Each visitor gets their own demo account
with a year of sample data. Demo accounts are deleted after 24 hours.

```bash
pnpm test        # unit + integration tests (integration tests need the database)
pnpm test:e2e    # Playwright smoke test
pnpm lint
pnpm build
```

## Implementation notes

**Money.** Amounts are stored as integer cents. Income is positive and expenses are negative, so a
balance is just a `SUM`. The sign is enforced by a `CHECK` constraint:

```sql
CHECK (
  (type = 'income'   AND amount_cents > 0) OR
  (type = 'expense'  AND amount_cents < 0) OR
  (type = 'transfer' AND amount_cents <> 0)
)
```

**Transfers** are stored as two rows (one negative, one positive) that share a `transfer_group_id`,
inserted in a single database transaction. Deleting one side deletes both, and reports exclude
`type = 'transfer'` from income and expense totals.

**Aggregations** (monthly totals, spending by category, budgets) are done in SQL with `date_trunc`,
`GROUP BY` and `FILTER`. The monthly report uses `generate_series` so months with no activity show
up as zero.

**Pagination** orders by the sort column and then by `id`, so rows with equal values don't move
between pages.

**Recurring transactions** are created by a daily cron job. Each generated row stores the rule id and
the occurrence date, with a unique index on the pair, so running the job twice doesn't create
duplicates. Monthly rules are calculated from the rule's day of the month, so a rule on the 31st
falls on the last day of shorter months and goes back to the 31st afterwards.

**Authorization.** Every query is scoped by the user id from the session (`requireUser()`), never by
an id from the request. Account and category ids sent by the client are checked on every write.
Rows that belong to another user return 404.

**Accessibility.** Amounts always show a sign, so income and expenses don't rely on colour alone.
The spending breakdown is a regular `<table>`.

## Known limitations

- No currency conversion. Reports group by currency, and transfers between accounts in different
  currencies are rejected.
- Email addresses are not verified yet (needs an email provider; Better Auth's
  `requireEmailVerification` can be turned on once there is one).
- Recurring transactions are generated once a day (05:00 UTC), not when a page is opened.
- CSV export only, no PDF.
- Email and password sign-in only, no Google or other providers.

## Deploying

The app runs on Vercel with Postgres on Neon.

1. Create a Neon project and copy the **pooled** connection string (the host contains `-pooler`).
   Run the migrations against it:

   ```bash
   DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require" pnpm db:migrate
   ```

2. Import the repository in Vercel and set these environment variables:

   | Variable               | Value                                              |
   | ---------------------- | -------------------------------------------------- |
   | `DATABASE_URL`         | pooled Neon URL                                    |
   | `BETTER_AUTH_SECRET`   | `openssl rand -hex 48`                             |
   | `BETTER_AUTH_URL`      | optional on Vercel, defaults to the production URL |
   | `CRON_SECRET`          | `openssl rand -hex 32`                             |
   | `NEXT_PUBLIC_SITE_URL` | optional, for a custom domain                      |

   In production the server won't start if a required variable is missing.

3. Deploy. `vercel.json` schedules the daily job at 05:00 UTC, which generates recurring
   transactions and deletes expired demo accounts.

4. Check that `/robots.txt`, `/sitemap.xml` and `/manifest.webmanifest` load, and that responses
   include the `Content-Security-Policy` and `Strict-Transport-Security` headers.

### Security

- Content-Security-Policy with a per-request nonce.
- HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy`.
- Rate limiting stored in Postgres (sign-in, sign-up, demo creation and all writes).
- Passwords need at least 10 characters, and common passwords are rejected.
- Signed-in pages are `noindex`.
