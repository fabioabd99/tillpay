import { and, asc, eq, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { accounts, categories, recurringRules, transactions } from "@/db/schema";
import type { RecurringRuleInput } from "@/lib/validators/recurring";
import { computeOccurrences, nextRunAfter } from "@/server/recurring";

export type RecurringRuleRow = {
  id: string;
  description: string;
  type: "income" | "expense" | "transfer";
  amountCents: number;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  dayOfMonth: number | null;
  weekday: number | null;
  startsOn: string;
  endsOn: string | null;
  nextRunOn: string;
  active: boolean;
  isSalary: boolean;
  accountId: string;
  accountName: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
};

export async function listRecurringRules(
  userId: string,
): Promise<RecurringRuleRow[]> {
  return db
    .select({
      id: recurringRules.id,
      description: recurringRules.description,
      type: recurringRules.type,
      amountCents: recurringRules.amountCents,
      frequency: recurringRules.frequency,
      interval: recurringRules.interval,
      dayOfMonth: recurringRules.dayOfMonth,
      weekday: recurringRules.weekday,
      startsOn: recurringRules.startsOn,
      endsOn: recurringRules.endsOn,
      nextRunOn: recurringRules.nextRunOn,
      active: recurringRules.active,
      isSalary: recurringRules.isSalary,
      accountId: accounts.id,
      accountName: accounts.name,
      categoryId: categories.id,
      categoryName: categories.name,
      categoryColor: categories.color,
    })
    .from(recurringRules)
    .innerJoin(accounts, eq(accounts.id, recurringRules.accountId))
    .leftJoin(categories, eq(categories.id, recurringRules.categoryId))
    .where(eq(recurringRules.userId, userId))
    .orderBy(asc(recurringRules.active), asc(recurringRules.nextRunOn));
}

// Creates the transactions for every due rule up to `until`.
// Safe to run more than once thanks to the unique index on
// (recurring_rule_id, occurrence_date). Not one big transaction on purpose,
// so one bad rule doesn't roll back the rest.
export async function generateDueTransactions(userId: string, until: string) {
  const due = await db
    .select()
    .from(recurringRules)
    .where(
      and(
        eq(recurringRules.userId, userId),
        eq(recurringRules.active, true),
        lte(recurringRules.nextRunOn, until),
      ),
    );

  let created = 0;

  for (const rule of due) {
    const occurrences = computeOccurrences(rule, until);
    if (occurrences.length === 0) continue;

    const inserted = await db
      .insert(transactions)
      .values(
        occurrences.map((occurrenceDate) => ({
          userId,
          accountId: rule.accountId,
          categoryId: rule.categoryId,
          type: rule.type,
          amountCents: rule.amountCents,
          occurredOn: occurrenceDate,
          description: rule.description,
          recurringRuleId: rule.id,
          occurrenceDate,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: transactions.id });

    created += inserted.length;

    const next = nextRunAfter(rule, occurrences.at(-1)!);

    await db
      .update(recurringRules)
      .set(
        next
          ? { nextRunOn: next }
          : // no more occurrences, deactivate it
            { active: false },
      )
      .where(eq(recurringRules.id, rule.id));
  }

  return { rulesRun: due.length, created };
}

export async function listUsersWithDueRules(until: string) {
  const rows = await db
    .selectDistinct({ userId: recurringRules.userId })
    .from(recurringRules)
    .where(
      and(eq(recurringRules.active, true), lte(recurringRules.nextRunOn, until)),
    );

  return rows.map((row) => row.userId);
}

async function ownsTargets(
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

export async function createRecurringRule(
  userId: string,
  input: RecurringRuleInput,
) {
  if (!(await ownsTargets(userId, input.accountId, input.categoryId))) {
    return null;
  }

  // only one salary per user, the new one replaces the old
  return db.transaction(async (tx) => {
    if (input.isSalary) await clearSalary(tx, userId);

    const [row] = await tx
      .insert(recurringRules)
      .values({ userId, ...input, nextRunOn: input.startsOn })
      .returning();

    return row;
  });
}

function clearSalary(tx: Pick<typeof db, "update">, userId: string) {
  return tx
    .update(recurringRules)
    .set({ isSalary: false })
    .where(and(eq(recurringRules.userId, userId), eq(recurringRules.isSalary, true)));
}

// Marks an income rule as the salary, unmarking any other. The CHECK
// constraint backs the type filter; a non-income rule comes back as null.
export async function setRuleSalary(userId: string, id: string) {
  return db.transaction(async (tx) => {
    await clearSalary(tx, userId);

    const [row] = await tx
      .update(recurringRules)
      .set({ isSalary: true })
      .where(
        and(
          eq(recurringRules.id, id),
          eq(recurringRules.userId, userId),
          eq(recurringRules.type, "income"),
        ),
      )
      .returning();

    return row ?? null;
  });
}

export async function setRuleActive(
  userId: string,
  id: string,
  active: boolean,
) {
  const [row] = await db
    .update(recurringRules)
    .set({ active })
    .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, userId)))
    .returning();

  return row ?? null;
}

// Generated transactions are kept (FK is ON DELETE SET NULL).
export async function deleteRecurringRule(userId: string, id: string) {
  const [row] = await db
    .delete(recurringRules)
    .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, userId)))
    .returning({ id: recurringRules.id });

  return row ?? null;
}

export async function countGeneratedByRule(userId: string) {
  const rows = await db
    .select({
      ruleId: transactions.recurringRuleId,
      count: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        sql`${transactions.recurringRuleId} is not null`,
      ),
    )
    .groupBy(transactions.recurringRuleId);

  return new Map(rows.map((row) => [row.ruleId, row.count]));
}
