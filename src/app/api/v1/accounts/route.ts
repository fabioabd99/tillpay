import { NextResponse, type NextRequest } from "next/server";

import { accountInputSchema } from "@/lib/validators/account";
import { parseBody, requireApiUser, requireApiUserForWrite } from "@/server/api";
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

  const { body, invalid } = await parseBody(request, accountInputSchema);
  if (!body) return invalid;

  return NextResponse.json(
    { data: await createAccount(user.id, body) },
    { status: 201 },
  );
}
