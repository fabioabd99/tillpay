import { NextResponse, type NextRequest } from "next/server";

import { recurringRuleInputSchema } from "@/lib/validators/recurring";
import {
  notFound,
  parseBody,
  requireApiUser,
  requireApiUserForWrite,
} from "@/server/api";
import {
  createRecurringRule,
  listRecurringRules,
} from "@/server/queries/recurring";

export async function GET() {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  return NextResponse.json({ data: await listRecurringRules(user.id) });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireApiUserForWrite();
  if (!user) return response;

  const { body, invalid } = await parseBody(request, recurringRuleInputSchema);
  if (!body) return invalid;

  const row = await createRecurringRule(user.id, body);
  if (!row) return notFound();

  return NextResponse.json({ data: row }, { status: 201 });
}
