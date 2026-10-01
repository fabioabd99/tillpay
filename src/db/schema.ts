import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Money is always integer cents. Income > 0, expense < 0 (CHECK constraints below).

export const accountKind = pgEnum("account_kind", [
  "checking",
  "savings",
  "cash",
  "card",
]);

export const categoryKind = pgEnum("category_kind", ["income", "expense"]);

export const transactionType = pgEnum("transaction_type", [
  "income",
  "expense",
  "transfer",
]);

export const recurrenceFrequency = pgEnum("recurrence_frequency", [
  "daily",
  "weekly",
  "monthly",
  "yearly",
]);

// Better Auth tables. Its `account` model is mapped to auth_accounts so it
// doesn't clash with the financial accounts table.
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("auth_accounts_user_id_idx").on(table.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// Better Auth rate limit storage (shared across serverless instances).
export const rateLimits = pgTable("rate_limits", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// Fixed-window rate limit used by the app's own endpoints.
export const appRateLimits = pgTable("app_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStartedAt: bigint("window_started_at", { mode: "number" }).notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: accountKind("kind").notNull(),
    // no currency conversion, reports group by currency
    currency: char("currency", { length: 3 }).notNull().default("EUR"),
    initialBalanceCents: integer("initial_balance_cents").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("accounts_user_idx").on(table.userId)],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: categoryKind("kind").notNull(),
    color: text("color"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // case-insensitive name per kind
    uniqueIndex("categories_user_name_kind_key").on(
      table.userId,
      sql`lower(${table.name})`,
      table.kind,
    ),
  ],
);

export const recurringRules = pgTable(
  "recurring_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    type: transactionType("type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    frequency: recurrenceFrequency("frequency").notNull(),
    interval: smallint("interval").notNull().default(1),
    // monthly/yearly, clamped to the last day of short months
    dayOfMonth: smallint("day_of_month"),
    // 0 = Sunday
    weekday: smallint("weekday"),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on"),
    nextRunOn: date("next_run_on").notNull(),
    active: boolean("active").notNull().default(true),
    // the rule payday is taken from
    isSalary: boolean("is_salary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("recurring_rules_user_idx").on(table.userId),
    uniqueIndex("recurring_rules_one_salary_key")
      .on(table.userId)
      .where(sql`${table.isSalary}`),
    check(
      "recurring_rules_salary_is_income",
      sql`NOT ${table.isSalary} OR ${table.type} = 'income'`,
    ),
    index("recurring_rules_due_idx").on(table.nextRunOn, table.active),
    check(
      "recurring_rules_amount_sign",
      sql`
        (${table.type} = 'income'   AND ${table.amountCents} > 0) OR
        (${table.type} = 'expense'  AND ${table.amountCents} < 0) OR
        (${table.type} = 'transfer' AND ${table.amountCents} <> 0)
      `,
    ),
    check("recurring_rules_interval", sql`${table.interval} > 0`),
    check(
      "recurring_rules_day_of_month",
      sql`${table.dayOfMonth} IS NULL OR (${table.dayOfMonth} BETWEEN 1 AND 31)`,
    ),
    check(
      "recurring_rules_weekday",
      sql`${table.weekday} IS NULL OR (${table.weekday} BETWEEN 0 AND 6)`,
    ),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    type: transactionType("type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    // DATE on purpose, a timestamp could shift into another day/month with timezones
    occurredOn: date("occurred_on").notNull(),
    description: text("description"),
    // transfers are two rows (out and in) sharing this id
    transferGroupId: uuid("transfer_group_id"),
    recurringRuleId: uuid("recurring_rule_id").references(
      () => recurringRules.id,
      { onDelete: "set null" },
    ),
    // with recurringRuleId, makes the recurring generator idempotent
    occurrenceDate: date("occurrence_date"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("transactions_user_date_idx").on(
      table.userId,
      table.occurredOn.desc(),
    ),
    index("transactions_user_category_date_idx").on(
      table.userId,
      table.categoryId,
      table.occurredOn,
    ),
    index("transactions_user_account_date_idx").on(
      table.userId,
      table.accountId,
      table.occurredOn,
    ),
    index("transactions_transfer_group_idx").on(table.transferGroupId),
    // NULLs are distinct, so manual transactions are unaffected
    uniqueIndex("transactions_recurring_occurrence_key").on(
      table.recurringRuleId,
      table.occurrenceDate,
    ),
    check(
      "transactions_amount_sign",
      sql`
        (${table.type} = 'income'   AND ${table.amountCents} > 0) OR
        (${table.type} = 'expense'  AND ${table.amountCents} < 0) OR
        (${table.type} = 'transfer' AND ${table.amountCents} <> 0)
      `,
    ),
    check(
      "transactions_transfer_group",
      sql`(${table.type} = 'transfer') = (${table.transferGroupId} IS NOT NULL)`,
    ),
    check(
      "transactions_recurring_pair",
      sql`(${table.recurringRuleId} IS NULL) = (${table.occurrenceDate} IS NULL)`,
    ),
  ],
);

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    // first day of the month
    periodMonth: date("period_month").notNull(),
    limitCents: integer("limit_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("budgets_user_category_month_key").on(
      table.userId,
      table.categoryId,
      table.periodMonth,
    ),
    check("budgets_limit_positive", sql`${table.limitCents} > 0`),
    check(
      "budgets_period_is_first_of_month",
      sql`${table.periodMonth} = date_trunc('month', ${table.periodMonth})::date`,
    ),
  ],
);
