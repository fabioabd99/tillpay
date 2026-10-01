import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { accounts, recurringRules, transactions } from "@/db/schema";

// Savings are left out of what can be spent.
const SPENDABLE_KINDS = ["checking", "cash", "card"] as const;

export async function getSpendableBalance(userId: string) {
  const [opening] = await db
    .select({
      cents: sql<number>`coalesce(sum(${accounts.initialBalanceCents}), 0)::int`,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        isNull(accounts.archivedAt),
        inArray(accounts.kind, SPENDABLE_KINDS),
      ),
    );

  const [movements] = await db
    .select({
      cents: sql<number>`coalesce(sum(${transactions.amountCents}), 0)::int`,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(accounts.archivedAt),
        inArray(accounts.kind, SPENDABLE_KINDS),
      ),
    );

  return opening.cents + movements.cents;
}

// Next salary date, or null (caller falls back to month end).
export async function getNextPayday(userId: string) {
  const [row] = await db
    .select({ on: recurringRules.nextRunOn })
    .from(recurringRules)
    .where(
      and(
        eq(recurringRules.userId, userId),
        eq(recurringRules.active, true),
        eq(recurringRules.isSalary, true),
        gte(recurringRules.nextRunOn, sql`current_date`),
      ),
    )
    .orderBy(recurringRules.nextRunOn)
    .limit(1);

  return row?.on ?? null;
}

// Recurring expenses due between today and `until`.
export function getUpcomingBills(userId: string, until: string) {
  return db
    .select({
      id: recurringRules.id,
      description: recurringRules.description,
      amountCents: recurringRules.amountCents,
      dueOn: recurringRules.nextRunOn,
    })
    .from(recurringRules)
    .where(
      and(
        eq(recurringRules.userId, userId),
        eq(recurringRules.active, true),
        eq(recurringRules.type, "expense"),
        gte(recurringRules.nextRunOn, sql`current_date`),
        lte(recurringRules.nextRunOn, until),
      ),
    )
    .orderBy(recurringRules.nextRunOn);
}

export type CategoryPace = {
  id: string;
  name: string;
  color: string | null;
  thisMonthCents: number;
  usualCents: number | null;
};

// This month's spending per category vs. the average of previous months up to
// the same day of the month.
export async function getCategoryPace(userId: string): Promise<CategoryPace[]> {
  const rows = await db.execute<{
    id: string;
    name: string;
    color: string | null;
    this_month_cents: number;
    usual_cents: number | null;
    months_of_history: number;
  }>(sql`
    WITH bounds AS (
      SELECT date_trunc('month', current_date)::date AS month_start,
             current_date AS today,
             extract(day FROM current_date)::int AS day_of_month
    ),
    this_month AS (
      SELECT t.category_id, sum(-t.amount_cents)::int AS cents
      FROM transactions t, bounds b
      WHERE t.user_id = ${userId}
        AND t.type = 'expense'
        AND t.occurred_on >= b.month_start
        AND t.occurred_on <= b.today
      GROUP BY t.category_id
    ),
    prior_months AS (
      SELECT t.category_id,
             date_trunc('month', t.occurred_on) AS month,
             sum(-t.amount_cents)::int AS cents
      FROM transactions t, bounds b
      WHERE t.user_id = ${userId}
        AND t.type = 'expense'
        AND t.occurred_on < b.month_start
        AND t.occurred_on >= (b.month_start - interval '6 months')
        AND extract(day FROM t.occurred_on) <= b.day_of_month
      GROUP BY t.category_id, date_trunc('month', t.occurred_on)
    ),
    usual AS (
      SELECT category_id,
             avg(cents)::int AS cents,
             count(*)::int AS months
      FROM prior_months
      GROUP BY category_id
    )
    SELECT c.id,
           c.name,
           c.color,
           coalesce(tm.cents, 0) AS this_month_cents,
           u.cents AS usual_cents,
           coalesce(u.months, 0) AS months_of_history
    FROM categories c
    LEFT JOIN this_month tm ON tm.category_id = c.id
    LEFT JOIN usual u ON u.category_id = c.id
    WHERE c.user_id = ${userId}
      AND c.kind = 'expense'
      AND c.archived_at IS NULL
      AND coalesce(tm.cents, 0) > 0
    ORDER BY coalesce(tm.cents, 0) DESC
  `);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    thisMonthCents: row.this_month_cents,
    // need at least 2 months of history for an average
    usualCents: row.months_of_history >= 2 ? row.usual_cents : null,
  }));
}

export async function getUncategorisedCount(userId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.categoryId),
        sql`${transactions.type} <> 'transfer'`,
      ),
    );

  return row.count;
}

export async function getSpentSince(userId: string, from: string) {
  const [row] = await db
    .select({
      cents: sql<number>`coalesce(-sum(${transactions.amountCents}) filter (where ${transactions.type} = 'expense'), 0)::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.occurredOn, from),
        // ignore future-dated transactions
        lte(transactions.occurredOn, sql`current_date`),
      ),
    );

  return row.cents;
}

export async function getMonthTotals(userId: string) {
  const [row] = await db
    .select({
      incomeCents: sql<number>`coalesce(sum(${transactions.amountCents}) filter (where ${transactions.type} = 'income'), 0)::int`,
      spentCents: sql<number>`coalesce(-sum(${transactions.amountCents}) filter (where ${transactions.type} = 'expense'), 0)::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.occurredOn, sql`date_trunc('month', current_date)::date`),
      ),
    );

  return row;
}
