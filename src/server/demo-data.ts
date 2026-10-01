import { addDays, addMonths, startOfMonth, subMonths } from "date-fns";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  accounts,
  budgets,
  categories,
  recurringRules,
  transactions,
} from "@/db/schema";
import { isoDate } from "@/lib/dates";
import { computeOccurrences, nextRunAfter } from "@/server/recurring";

const MONTHS = 12;

// mulberry32, seeded so the demo data is always the same
function createRandom(seed: number) {
  let state = seed;

  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Seeded as real recurring rules, with their past occurrences linked to them.
const STANDING = [
  {
    description: "Monthly rent",
    category: "Rent",
    type: "expense",
    amountCents: -95000,
    dayOfMonth: 1,
    varies: false,
  },
  {
    description: "Monthly salary",
    category: "Salary",
    type: "income",
    amountCents: 250000,
    dayOfMonth: 25,
    // salary varies a bit month to month
    varies: true,
    isSalary: true,
  },
  {
    description: "Streaming subscription",
    category: "Subscriptions",
    type: "expense",
    amountCents: -1299,
    dayOfMonth: 8,
    varies: false,
  },
] as const;

type ExpenseSpec = {
  category: string;
  perMonth: [number, number];
  cents: [number, number];
  labels: readonly string[];
};

// rent is seeded as a recurring rule (STANDING)
const EXPENSES: readonly ExpenseSpec[] = [
  {
    category: "Groceries",
    perMonth: [4, 7],
    cents: [1800, 9500],
    labels: ["Supermarket", "Grocery run", "Local market", "Bakery"],
  },
  {
    category: "Utilities",
    perMonth: [2, 3],
    cents: [2200, 8800],
    labels: ["Electricity", "Water", "Internet", "Gas"],
  },
  {
    category: "Transport",
    perMonth: [2, 5],
    cents: [150, 6500],
    labels: ["Metro pass", "Fuel", "Taxi", "Train ticket"],
  },
  {
    category: "Dining",
    perMonth: [2, 6],
    cents: [900, 7200],
    labels: ["Lunch", "Dinner out", "Coffee", "Takeaway"],
  },
  {
    category: "Health",
    perMonth: [0, 2],
    cents: [1200, 6000],
    labels: ["Pharmacy", "Dentist", "Gym"],
  },
  {
    category: "Entertainment",
    perMonth: [1, 3],
    cents: [800, 4500],
    labels: ["Cinema", "Concert", "Books"],
  },
  {
    category: "Shopping",
    perMonth: [0, 3],
    cents: [1500, 12000],
    labels: ["Clothes", "Electronics", "Home goods"],
  },
  {
    category: "Subscriptions",
    perMonth: [2, 3],
    cents: [599, 1599],
    labels: ["Streaming", "Music", "Cloud storage"],
  },
];

// A year of sample data for the demo accounts. Expects the default categories
// to exist already (created on sign-up).
export async function seedDemoData(userId: string) {
  // created per call so a long-running server doesn't reuse its start date
  const random = createRandom(20260924);

  const randomInt = (min: number, max: number) =>
    min + Math.floor(random() * (max - min + 1));

  const pick = <T>(items: readonly T[]) => items[randomInt(0, items.length - 1)];

  // clamp to today, the current month is only partly over
  const today = new Date();
  const day = (date: Date) => isoDate(date > today ? today : date);

  const accountRows = await db
    .insert(accounts)
    .values([
      {
        userId,
        name: "Main Checking",
        kind: "checking",
        initialBalanceCents: 120000,
      },
      {
        userId,
        name: "Savings",
        kind: "savings",
        initialBalanceCents: 450000,
      },
      { userId, name: "Cash", kind: "cash", initialBalanceCents: 8000 },
    ])
    .returning();

  const [checking, savings, cash] = accountRows;

  const categoryRows = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));

  const categoryByName = new Map(categoryRows.map((row) => [row.name, row]));
  const categoryId = (name: string) => categoryByName.get(name)!.id;

  type NewTransaction = typeof transactions.$inferInsert;
  const rows: NewTransaction[] = [];

  // both legs of a transfer between two of the demo accounts
  const transfer = (
    from: string,
    to: string,
    cents: number,
    occurredOn: string,
    [fromLabel, toLabel]: [string, string],
  ) => {
    const transferGroupId = crypto.randomUUID();
    rows.push(
      { userId, accountId: from, type: "transfer", amountCents: -cents, occurredOn, description: fromLabel, transferGroupId },
      { userId, accountId: to, type: "transfer", amountCents: cents, occurredOn, description: toLabel, transferGroupId },
    );
  };

  const firstMonth = startOfMonth(subMonths(new Date(), MONTHS - 1));
  const startsOn = isoDate(firstMonth);
  const todayIso = isoDate(today);

  const ruleRows = await db
    .insert(recurringRules)
    .values(
      STANDING.map((spec) => ({
        userId,
        accountId: checking.id,
        categoryId: categoryId(spec.category),
        description: spec.description,
        type: spec.type,
        amountCents: spec.amountCents,
        frequency: "monthly" as const,
        dayOfMonth: spec.dayOfMonth,
        isSalary: "isSalary" in spec && spec.isSalary,
        startsOn,
        // first run *after* today, today's occurrence is inserted below
        nextRunOn: nextRunAfter(
          {
            frequency: "monthly",
            interval: 1,
            dayOfMonth: spec.dayOfMonth,
            weekday: null,
            startsOn,
            endsOn: null,
            nextRunOn: startsOn,
          },
          todayIso,
        )!,
      })),
    )
    .returning();

  for (const rule of ruleRows) {
    const spec = STANDING.find((item) => item.description === rule.description)!;

    for (const occurrenceDate of computeOccurrences(
      { ...rule, nextRunOn: startsOn },
      todayIso,
    )) {
      rows.push({
        userId,
        accountId: rule.accountId,
        categoryId: rule.categoryId,
        type: rule.type,
        amountCents: spec.varies
          ? rule.amountCents + randomInt(0, 8) * 2500
          : rule.amountCents,
        occurredOn: occurrenceDate,
        description: rule.description,
        recurringRuleId: rule.id,
        occurrenceDate,
      });
    }
  }

  for (let monthOffset = 0; monthOffset < MONTHS; monthOffset++) {
    const monthStart = addMonths(firstMonth, monthOffset);

    if (random() < 0.45) {
      rows.push({
        userId,
        accountId: checking.id,
        categoryId: categoryId("Freelance"),
        type: "income",
        amountCents: randomInt(15000, 90000),
        occurredOn: day(addDays(monthStart, randomInt(5, 26))),
        description: "Freelance invoice",
      });
    }

    const monthExpenses: NewTransaction[] = [];

    for (const spec of EXPENSES) {
      const count = randomInt(spec.perMonth[0], spec.perMonth[1]);

      for (let i = 0; i < count; i++) {
        const amountCents = -randomInt(spec.cents[0], spec.cents[1]);

        monthExpenses.push({
          userId,
          // only small purchases in cash
          accountId:
            amountCents > -3000 && random() < 0.4 ? cash.id : checking.id,
          categoryId: categoryId(spec.category),
          type: "expense",
          amountCents,
          occurredOn: day(addDays(monthStart, randomInt(0, 27))),
          description: pick(spec.labels),
        });
      }
    }

    // ATM withdrawal covering the month's cash spending, so cash never goes negative
    const cashSpend = monthExpenses
      .filter((row) => row.accountId === cash.id)
      .reduce((sum, row) => sum + Math.abs(row.amountCents), 0);
    transfer(checking.id, cash.id, cashSpend + randomInt(2000, 6000), day(monthStart), [
      "ATM withdrawal",
      "ATM withdrawal",
    ]);

    rows.push(...monthExpenses);

    transfer(
      checking.id,
      savings.id,
      randomInt(15000, 40000),
      day(addDays(monthStart, 26)),
      ["To savings", "From checking"],
    );
  }

  await db.insert(transactions).values(rows);

  const currentMonth = day(startOfMonth(new Date()));

  const caps = [
    ["Groceries", 40000],
    ["Dining", 15000],
    ["Transport", 12000],
    ["Entertainment", 8000],
  ] as const;

  await db.insert(budgets).values(
    caps.map(([name, limitCents]) => ({
      userId,
      categoryId: categoryId(name),
      periodMonth: currentMonth,
      limitCents,
    })),
  );

  return { accounts: accountRows.length, transactions: rows.length };
}