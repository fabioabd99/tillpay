import { NextResponse, type NextRequest } from "next/server";

import { categoryInputSchema } from "@/lib/validators/category";
import { apiError, requireApiUser,
  requireApiUserForWrite, validationError } from "@/server/api";
import {
  CATEGORY_NAME_TAKEN,
  createCategory,
  listCategories,
} from "@/server/queries/categories";

export async function GET() {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  return NextResponse.json({
    data: await listCategories(user.id),
  });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireApiUserForWrite();
  if (!user) return response;

  const body = await request.json().catch(() => null);
  const parsed = categoryInputSchema.safeParse(body);

  if (!parsed.success) return validationError(parsed.error);

  const result = await createCategory(user.id, parsed.data);

  if (result === CATEGORY_NAME_TAKEN) {
    return apiError("conflict", "You already have a category with that name.");
  }

  return NextResponse.json({ data: result }, { status: 201 });
}
