import { NextResponse, type NextRequest } from "next/server";

import { categoryInputSchema } from "@/lib/validators/category";
import {
  apiError,
  parseBody,
  requireApiUser,
  requireApiUserForWrite,
} from "@/server/api";
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

  const { body, invalid } = await parseBody(request, categoryInputSchema);
  if (!body) return invalid;

  const result = await createCategory(user.id, body);

  if (result === CATEGORY_NAME_TAKEN) {
    return apiError("conflict", "You already have a category with that name.");
  }

  return NextResponse.json({ data: result }, { status: 201 });
}
