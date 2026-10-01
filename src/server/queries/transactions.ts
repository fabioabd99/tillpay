import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import type {
  TransactionFilters,
  TransactionInput,
  TransferInput,
} from "@/lib/validators/transaction";

// and() / or() skip undefined, so unset filters drop out.
function buildConditions(userId: string, filters: TransactionFilters) {
  // escape LIKE wildcards typed by the user
  const search = filters.q?.replace(/([%_\\])/g, "\\$1");

  return and(
    eq(transactions.userId, userId),
    filters.from ? gte(transactions.occurredOn, filters.from) : undefined,
    filters.to ? lte(transactions.occurredOn, filters.to) : undefined,
    filters.type ? eq(transactions.type, filters.type) : undefined,
    filters.accountId ? eq(transactions.accountId, filters.accountId) : undefined,
    // a category + uncategorised = either
    or(
      filters.categoryId ? eq(transactions.categoryId, filters.categoryId) : undefined,
      filters.uncategorised ? isNull(transactions.categoryId) : undefined,
    ),
    search
      ? sql`${transactions.description} ILIKE ${`%${search}%`} ESCAPE '\\'`
      : undefined,
    // amount filters compare magnitude, so expenses (negative) match too
    filters.minCents !== undefined
      ? sql`abs(${transactions.amountCents}) >= ${filters.minCents}`
      : undefined,
    filters.maxCents !== undefined
      ? sql`abs(${transactions.amountCents}) <= ${filters.maxCents}`
      : undefined,
  )!;
}

const SORT_COLUMNS = {
  occurredOn: transactions.occurredOn,
  amountCents: transactions.amountCents,
  description: transactions.description,
} as const;

export async function listTransactions(
  userId: string,
  filters: TransactionFilters,
) {
  const where = buildConditions(userId, filters);
  const direction = filters.dir === "asc" ? asc : desc;
  const column = SORT_COLUMNS[filters.sort];

  const rows = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amountCents: transactions.amountCents,
      occurredOn: transactions.occurredOn,
      description: transactions.description,
      transferGroupId: transactions.transferGroupId,
      accountId: accounts.id,
      accountName: accounts.name,
      currency: accounts.currency,
      categoryId: categories.id,
      categoryName: categories.name,
      categoryColor: categories.color,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(where)
    // id as tiebreaker, otherwise ties can shuffle between pages
    .orderBy(direction(column), desc(transactions.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  const [totals] = await db
    .select({
      count: sql<number>`count(*)::int`,
      // transfers are neither income nor expense
      incomeCents: sql<number>`coalesce(sum(${transactions.amountCents}) filter (where ${transactions.type} = 'income'), 0)::int`,
      expenseCents: sql<number>`coalesce(sum(${transactions.amountCents}) filter (where ${transactions.type} = 'expense'), 0)::int`,
    })
    .from(transactions)
    .where(where);

  return {
    rows,
    total: totals.count,
    incomeCents: totals.incomeCents,
    expenseCents: totals.expenseCents,
    pageCount: Math.max(1, Math.ceil(totals.count / filters.pageSize)),
  };
}

export type TransactionRow = Awaited<
  ReturnType<typeof listTransactions>
>["rows"][number];

// Returns null if the account or category isn't the user's.
export async function createTransaction(
  userId: string,
  input: TransactionInput,
) {
  if (!(await ownsTargets(userId, input.accountId, input.categoryId))) {
    return null;
  }

  const [row] = await db
    .insert(transactions)
    .values({ userId, ...input })
    .returning();

  return row;
}

export async function getTransaction(userId: string, id: string) {
  const [row] = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      categoryId: transactions.categoryId,
      type: transactions.type,
      amountCents: transactions.amountCents,
      occurredOn: transactions.occurredOn,
      description: transactions.description,
      transferGroupId: transactions.transferGroupId,
    })
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

  return row ?? null;
}

export async function ownsTargets(
  userId: string,
  accountId: string,
  categoryId: string | null,
) {
  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));

  if (!account) return false;

  if (categoryId) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));

    if (!category) return false;
  }

  return true;
}

export const TRANSFER_NOT_EDITABLE = "transfer_not_editable" as const;

// Transfers can't be edited here, only deleted and recreated (two linked rows).
export async function updateTransaction(
  userId: string,
  id: string,
  input: TransactionInput,
) {
  const existing = await getTransaction(userId, id);
  if (!existing) return null;
  if (existing.type === "transfer") return TRANSFER_NOT_EDITABLE;

  if (!(await ownsTargets(userId, input.accountId, input.categoryId))) {
    return null;
  }

  const [row] = await db
    .update(transactions)
    .set(input)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning();

  return row ?? null;
}

// Deleting one leg of a transfer deletes the other one too.
export async function deleteTransaction(userId: string, id: string) {
  const existing = await getTransaction(userId, id);
  if (!existing) return null;

  const removed = await db
    .delete(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        existing.transferGroupId
          ? eq(transactions.transferGroupId, existing.transferGroupId)
          : eq(transactions.id, id),
      ),
    )
    .returning({ id: transactions.id });

  return { deleted: removed.length, wasTransfer: !!existing.transferGroupId };
}

export const TRANSFER_SAME_ACCOUNT = "transfer_same_account" as const;
export const TRANSFER_CURRENCY_MISMATCH = "transfer_currency_mismatch" as const;

// Both legs in one DB transaction.
export async function createTransfer(userId: string, input: TransferInput) {
  if (input.fromAccountId === input.toAccountId) return TRANSFER_SAME_ACCOUNT;

  const owned = await db
    .select({ id: accounts.id, currency: accounts.currency })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        inArray(accounts.id, [input.fromAccountId, input.toAccountId]),
      ),
    );

  if (owned.length !== 2) return null;

  // no currency conversion
  if (owned[0].currency !== owned[1].currency) {
    return TRANSFER_CURRENCY_MISMATCH;
  }

  const transferGroupId = crypto.randomUUID();
  const legs = [
    [input.fromAccountId, -input.amountCents],
    [input.toAccountId, input.amountCents],
  ] as const;

  return db.transaction(async (tx) =>
    tx
      .insert(transactions)
      .values(
        legs.map(([accountId, amountCents]) => ({
          userId,
          accountId,
          type: "transfer" as const,
          amountCents,
          occurredOn: input.occurredOn,
          description: input.description,
          transferGroupId,
        })),
      )
      .returning(),
  );
}

// Grouped by account so the opening balance is only counted once.
export function listAccountBalances(userId: string) {
  return db
    .select({
      id: accounts.id,
      name: accounts.name,
      kind: accounts.kind,
      currency: accounts.currency,
      balanceCents: sql<number>`(
        ${accounts.initialBalanceCents} + coalesce(sum(${transactions.amountCents}), 0)
      )::int`,
    })
    .from(accounts)
    .leftJoin(transactions, eq(transactions.accountId, accounts.id))
    .where(and(eq(accounts.userId, userId), isNull(accounts.archivedAt)))
    .groupBy(accounts.id)
    .orderBy(asc(accounts.name));
}

export type AccountBalance = Awaited<ReturnType<typeof listAccountBalances>>[number];

// End-of-day balance for each day in the range (sparkline).
export async function getBalanceSeries(
  userId: string,
  accountId: string | null,
  from: string,
  to: string,
) {
  const accountFilter = accountId
    ? sql`AND a.id = ${accountId}`
    : sql``;
  const txAccountFilter = accountId
    ? sql`AND t.account_id = ${accountId}`
    : sql``;

  const rows = await db.execute<{ day: string; balance_cents: number }>(sql`
    WITH opening AS (
      SELECT
        coalesce((
          SELECT sum(a.initial_balance_cents)
          FROM accounts a
          WHERE a.user_id = ${userId} AND a.archived_at IS NULL ${accountFilter}
        ), 0)
        + coalesce((
          SELECT sum(t.amount_cents)
          FROM transactions t
          WHERE t.user_id = ${userId} AND t.occurred_on < ${from} ${txAccountFilter}
        ), 0) AS cents
    ),
    days AS (
      SELECT generate_series(${from}::date, ${to}::date, '1 day')::date AS day
    ),
    deltas AS (
      SELECT d.day, coalesce(sum(t.amount_cents), 0)::int AS delta
      FROM days d
      LEFT JOIN transactions t
        ON t.occurred_on = d.day
       AND t.user_id = ${userId}
       ${txAccountFilter}
      GROUP BY d.day
    )
    SELECT
      to_char(deltas.day, 'YYYY-MM-DD') AS day,
      ((SELECT cents FROM opening) + sum(deltas.delta) OVER (ORDER BY deltas.day))::int
        AS balance_cents
    FROM deltas
    ORDER BY deltas.day
  `);

  return rows.map((row) => ({
    day: row.day,
    balanceCents: row.balance_cents,
  }));
}

export function listAccountsForUser(userId: string) {
  return db
    .select({
      id: accounts.id,
      name: accounts.name,
      kind: accounts.kind,
      currency: accounts.currency,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), isNull(accounts.archivedAt)))
    .orderBy(asc(accounts.name));
}

export function listCategoriesForUser(userId: string) {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      kind: categories.kind,
      color: categories.color,
    })
    .from(categories)
    .where(and(eq(categories.userId, userId), isNull(categories.archivedAt)))
    .orderBy(asc(categories.name));
}
