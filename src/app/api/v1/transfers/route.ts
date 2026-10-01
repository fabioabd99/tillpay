import { NextResponse, type NextRequest } from "next/server";

import { transferInputSchema } from "@/lib/validators/transaction";
import {
  apiError,
  notFound,
  parseBody,
  requireApiUserForWrite,
} from "@/server/api";
import {
  TRANSFER_CURRENCY_MISMATCH,
  TRANSFER_SAME_ACCOUNT,
  createTransfer,
} from "@/server/queries/transactions";

export async function POST(request: NextRequest) {
  const { user, response } = await requireApiUserForWrite();
  if (!user) return response;

  const { body, invalid } = await parseBody(request, transferInputSchema);
  if (!body) return invalid;

  const result = await createTransfer(user.id, body);

  if (result === TRANSFER_SAME_ACCOUNT) {
    return apiError("validation_failed", "Choose two different accounts.", {
      toAccountId: ["Choose two different accounts."],
    });
  }

  if (result === TRANSFER_CURRENCY_MISMATCH) {
    return apiError(
      "conflict",
      "Those accounts hold different currencies, and Tillpay does not convert between them.",
    );
  }

  if (!result) return notFound();

  return NextResponse.json({ data: result }, { status: 201 });
}
