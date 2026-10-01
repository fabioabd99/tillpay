import { startOfMonth } from "date-fns";
import { NextResponse, type NextRequest } from "next/server";

import { isoDate } from "@/lib/dates";
import { budgetInputSchema } from "@/lib/validators/budget";
import { requireApiUser,
  requireApiUserForWrite, validationError } from "@/server/api";
import { getBudgetProgress, upsertBudget } from "@/server/queries/budgets";

export async function GET(request: NextRequest) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const month =
    request.nextUrl.searchParams.get("month") ??
    isoDate(startOfMonth(new Date()));

  return NextResponse.json({ data: await getBudgetProgress(user.id, month) });
}

// PUT because it's an upsert
export async function PUT(request: NextRequest) {
  const { user, response } = await requireApiUserForWrite();
  if (!user) return response;

  const body = await request.json().catch(() => null);
  const parsed = budgetInputSchema.safeParse(body);

  if (!parsed.success) return validationError(parsed.error);

  const row = await upsertBudget(
    user.id,
    parsed.data.categoryId,
    parsed.data.periodMonth,
    parsed.data.limitCents,
  );

  return NextResponse.json({ data: row });
}
