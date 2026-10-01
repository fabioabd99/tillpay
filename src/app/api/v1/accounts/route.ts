import { NextResponse, type NextRequest } from "next/server";

import { accountInputSchema } from "@/lib/validators/account";
import { requireApiUser,
  requireApiUserForWrite, validationError } from "@/server/api";
import { createAccount, listAccounts } from "@/server/queries/accounts";

export async function GET() {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  return NextResponse.json({
    data: await listAccounts(user.id),
  });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireApiUserForWrite();
  if (!user) return response;

  const body = await request.json().catch(() => null);
  const parsed = accountInputSchema.safeParse(body);

  if (!parsed.success) return validationError(parsed.error);

  return NextResponse.json(
    { data: await createAccount(user.id, parsed.data) },
    { status: 201 },
  );
}
