import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import type { CategoryInput } from "@/lib/validators/category";

// Categories are archived, not deleted, so past transactions keep them.

// Hidden categories included.
export function listCategories(userId: string) {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      kind: categories.kind,
      color: categories.color,
      transactionCount: sql<number>`count(${transactions.id})::int`,
      totalCents: sql<number>`coalesce(sum(${transactions.amountCents}), 0)::int`,
      archivedAt: categories.archivedAt,
    })
    .from(categories)
    .leftJoin(transactions, eq(transactions.categoryId, categories.id))
    .where(eq(categories.userId, userId))
    .groupBy(categories.id)
    .orderBy(asc(categories.archivedAt), asc(categories.kind), asc(categories.name));
}

export type CategoryListRow = Awaited<ReturnType<typeof listCategories>>[number];

export const CATEGORY_NAME_TAKEN = "category_name_taken" as const;

// unique_violation, wrapped by Drizzle in `cause`.
const isUniqueViolation = (error: unknown) =>
  (error as { cause?: { code?: string } })?.cause?.code === "23505";

// The unique index is (user_id, lower(name), kind), so a clash inserts nothing.
export async function createCategory(userId: string, input: CategoryInput) {
  const rows = await db
    .insert(categories)
    .values({ userId, ...input })
    .onConflictDoNothing()
    .returning();

  return rows.length > 0 ? rows[0] : CATEGORY_NAME_TAKEN;
}

export async function updateCategory(
  userId: string,
  id: string,
  input: CategoryInput,
) {
  try {
    const [row] = await db
      .update(categories)
      .set(input)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning();

    return row ?? null;
  } catch (error) {
    if (isUniqueViolation(error)) return CATEGORY_NAME_TAKEN;
    throw error;
  }
}

export async function setCategoryHidden(
  userId: string,
  id: string,
  hidden: boolean,
) {
  const [row] = await db
    .update(categories)
    .set({ archivedAt: hidden ? new Date() : null })
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .returning();

  return row ?? null;
}
