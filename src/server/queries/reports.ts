import { and, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { transactions } from "@/db/schema";

export type MonthlyPoint = {
  month: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
};

// Income and spending per month (transfers excluded). generate_series fills
// empty months with zeros.
export async function getMonthlyTrend(
  userId: string,
  months = 12,
): Promise<MonthlyPoint[]> {
  const rows = await db.execute<{
    month: string;
    income_cents: number;
    expense_cents: number;
  }>(sql`
    WITH bounds AS (
      SELECT (date_trunc('month', current_date) - make_interval(months => ${months - 1}))::date AS first_month,
             date_trunc('month', current_date)::date AS last_month
    ),
    months AS (
      SELECT generate_series(
        (SELECT first_month FROM bounds),
        (SELECT last_month FROM bounds),
        '1 month'
      )::date AS month
    )
    SELECT
      to_char(m.month, 'YYYY-MM-DD') AS month,
      coalesce(sum(t.amount_cents) FILTER (WHERE t.type = 'income'), 0)::int AS income_cents,
      coalesce(-sum(t.amount_cents) FILTER (WHERE t.type = 'expense'), 0)::int AS expense_cents
    FROM months m
    LEFT JOIN transactions t
      ON date_trunc('month', t.occurred_on)::date = m.month
     AND t.user_id = ${userId}
     AND t.type <> 'transfer'
    GROUP BY m.month
    ORDER BY m.month
  `);

  return rows.map((row) => ({
    month: row.month,
    incomeCents: row.income_cents,
    // positive
    expenseCents: row.expense_cents,
    netCents: row.income_cents - row.expense_cents,
  }));
}

export type CategoryTotal = {
  id: string | null;
  name: string;
  color: string | null;
  cents: number;
  share: number;
};

// Spending per category, largest first. Uncategorised gets its own row.
export async function getSpendingByCategory(
  userId: string,
  from: string,
  to: string,
): Promise<CategoryTotal[]> {
  const rows = await db.execute<{
    id: string | null;
    name: string | null;
    color: string | null;
    cents: number;
    share: number;
  }>(sql`
    SELECT c.id, c.name, c.color, (-sum(t.amount_cents))::int AS cents,
           sum(t.amount_cents)::float8 / sum(sum(t.amount_cents)) OVER () AS share
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.user_id = ${userId}
      AND t.type = 'expense'
      AND t.occurred_on >= ${from}
      AND t.occurred_on <= ${to}
    GROUP BY c.id, c.name, c.color
    ORDER BY (-sum(t.amount_cents)) DESC
  `);

  return rows.map((row) => ({
    id: row.id,
    name: row.name ?? "Uncategorised",
    color: row.color,
    cents: row.cents,
    share: row.share,
  }));
}

// Income, spending and months with any of either, between two dates.
export async function getPeriodTotals(userId: string, from: string, to: string) {
  const [row] = await db
    .select({
      incomeCents: sql<number>`coalesce(sum(${transactions.amountCents}) filter (where ${transactions.type} = 'income'), 0)::int`,
      expenseCents: sql<number>`coalesce(-sum(${transactions.amountCents}) filter (where ${transactions.type} = 'expense'), 0)::int`,
      activeMonths: sql<number>`count(distinct date_trunc('month', ${transactions.occurredOn})) filter (where ${transactions.type} <> 'transfer')::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.occurredOn, from),
        lte(transactions.occurredOn, to),
      ),
    );

  return row;
}
