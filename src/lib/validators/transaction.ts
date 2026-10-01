import { z } from "zod";

export const TRANSACTION_TYPES = ["income", "expense", "transfer"] as const;
export const SORT_FIELDS = ["occurredOn", "amountCents", "description"] as const;

export const PAGE_SIZES = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;

// List filters come from the URL, so everything is optional and coerced.
const isTruthy = (value: unknown) =>
  value === true || value === "true" || value === "1";

export const transactionFiltersSchema = z.object({
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  accountId: z.uuid().optional().catch(undefined),
  categoryId: z.uuid().optional().catch(undefined),
  // z.coerce.boolean() would turn "false" into true
  uncategorised: z.unknown().transform(isTruthy).catch(false),
  type: z.enum(TRANSACTION_TYPES).optional().catch(undefined),
  q: z.string().trim().max(200).optional().catch(undefined),
  minCents: z.coerce.number().int().optional().catch(undefined),
  maxCents: z.coerce.number().int().optional().catch(undefined),
  sort: z.enum(SORT_FIELDS).catch("occurredOn"),
  dir: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => PAGE_SIZES.includes(value as (typeof PAGE_SIZES)[number]))
    .catch(DEFAULT_PAGE_SIZE),
});

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

// Each field has its own .catch, so one bad param doesn't reset the others.
export function parseTransactionFilters(
  params: Record<string, string | string[] | undefined>,
): TransactionFilters {
  return transactionFiltersSchema.parse(params);
}

// Income or expense. The sign of amountCents must match the type (also a DB
// CHECK). Transfers use transferInputSchema.
export const transactionInputSchema = z
  .object({
    accountId: z.uuid(),
    categoryId: z.uuid().nullable().default(null),
    type: z.enum(["income", "expense"]),
    amountCents: z.number().int().refine((value) => value !== 0, {
      message: "Enter an amount",
    }),
    occurredOn: z.iso.date(),
    description: z.string().trim().max(200).nullable().default(null),
  })
  .refine(
    (value) =>
      value.type === "income" ? value.amountCents > 0 : value.amountCents < 0,
    { message: "Income must be positive and spending negative", path: ["amountCents"] },
  );

export type TransactionInput = z.infer<typeof transactionInputSchema>;

export const transferInputSchema = z
  .object({
    fromAccountId: z.uuid(),
    toAccountId: z.uuid(),
    amountCents: z.number().int().positive("Enter an amount above zero"),
    occurredOn: z.iso.date(),
    description: z.string().trim().max(200).nullable().default(null),
  })
  .refine((value) => value.fromAccountId !== value.toAccountId, {
    message: "Choose two different accounts",
    path: ["toAccountId"],
  });

export type TransferInput = z.infer<typeof transferInputSchema>;
