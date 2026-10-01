import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { accountInputSchema } from "@/lib/validators/account";
import { notFound, parseBody, requireApiUserForWrite } from "@/server/api";
import { setAccountHidden, updateAccount } from "@/server/queries/accounts";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const { user, response } = await requireApiUserForWrite();
  if (!user) return response;

  const { id } = await context.params;
  const { body, invalid } = await parseBody(request, accountInputSchema);
  if (!body) return invalid;

  const row = await updateAccount(user.id, id, body);
  if (!row) return notFound();

  return NextResponse.json({ data: row });
}

const hiddenSchema = z.object({ hidden: z.boolean() });

// Archive / restore. No DELETE since it would cascade to transactions.
export async function PUT(request: NextRequest, context: Context) {
  const { user, response } = await requireApiUserForWrite();
  if (!user) return response;

  const { id } = await context.params;
  const { body, invalid } = await parseBody(request, hiddenSchema);
  if (!body) return invalid;

  const row = await setAccountHidden(user.id, id, body.hidden);
  if (!row) return notFound();

  return NextResponse.json({ data: row });
}
