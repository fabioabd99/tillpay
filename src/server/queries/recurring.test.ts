import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";

import { db } from "@/db";
import { accounts, transactions, users } from "@/db/schema";
import { createRecurringRule, deleteRecurringRule, generateDueTransactions } from "./recurring";

// On the seeded demo user. Skipped without a database.
let userId: string | null = null;

beforeAll(async () => {
  try {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "demo@tillpay.app"));
    userId = row?.id ?? null;
  } catch {
    userId = null;
  }
});

describe.runIf(process.env.DATABASE_URL)("repeating items", () => {
  test("removing one keeps the transactions it already created", async () => {
    if (!userId) return;

    const [account] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .limit(1);

    const rule = await createRecurringRule(userId, {
      accountId: account.id,
      categoryId: null,
      description: "Delete check",
      type: "expense",
      amountCents: -100,
      frequency: "monthly",
      interval: 1,
      dayOfMonth: 1,
      weekday: null,
      startsOn: "2026-01-01",
      endsOn: "2026-02-01",
      isSalary: false,
    });
    if (!rule) throw new Error("rule not created");

    await generateDueTransactions(userId, "2026-02-01");
    const generated = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.recurringRuleId, rule.id));

    try {
      expect(generated).toHaveLength(2);
      expect(await deleteRecurringRule(userId, rule.id)).toEqual({ id: rule.id });

      for (const { id } of generated) {
        const [kept] = await db.select().from(transactions).where(eq(transactions.id, id));
        expect(kept).toMatchObject({ recurringRuleId: null, occurrenceDate: null });
      }
    } finally {
      for (const { id } of generated) {
        await db.delete(transactions).where(eq(transactions.id, id));
      }
    }
  });
});
