import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { accounts, transactions } from "@/db/schema";
import type { AccountInput } from "@/lib/validators/account";

// Accounts are archived, never deleted (the FK cascades to transactions).

// Hidden accounts included, listed last.
export function listAccounts(userId: string) {
  return db
    .select({
      id: accounts.id,
      name: accounts.name,
      kind: accounts.kind,
      currency: accounts.currency,
      initialBalanceCents: accounts.initialBalanceCents,
      balanceCents: sql<number>`(
        ${accounts.initialBalanceCents} + coalesce(sum(${transactions.amountCents}), 0)
      )::int`,
      transactionCount: sql<number>`count(${transactions.id})::int`,
      archivedAt: accounts.archivedAt,
    })
    .from(accounts)
    .leftJoin(transactions, eq(transactions.accountId, accounts.id))
    .where(eq(accounts.userId, userId))
    .groupBy(accounts.id)
    .orderBy(sql`${accounts.archivedAt} IS NOT NULL`, asc(accounts.name));
}

export type AccountListRow = Awaited<ReturnType<typeof listAccounts>>[number];

export async function createAccount(userId: string, input: AccountInput) {
  const [row] = await db
    .insert(accounts)
    .values({ userId, ...input })
    .returning();

  return row;
}

export async function updateAccount(
  userId: string,
  id: string,
  input: AccountInput,
) {
  const [row] = await db
    .update(accounts)
    .set(input)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning();

  return row ?? null;
}

export async function setAccountHidden(
  userId: string,
  id: string,
  hidden: boolean,
) {
  const [row] = await db
    .update(accounts)
    .set({ archivedAt: hidden ? new Date() : null })
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning();

  return row ?? null;
}
