import { NextResponse, type NextRequest } from "next/server";

import {
  parseTransactionFilters,
  transactionInputSchema,
} from "@/lib/validators/transaction";
import {
  notFound,
  parseBody,
  requireApiUser,
  requireApiUserForWrite,
} from "@/server/api";
import {
  createTransaction,
  listTransactions,
} from "@/server/queries/transactions";

export async function GET(request: NextRequest) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseTransactionFilters(params);
  const result = await listTransactions(user.id, filters);

  return NextResponse.json({
    data: result.rows,
    meta: {
      page: filters.page,
      pageSize: filters.pageSize,
      pageCount: result.pageCount,
      total: result.total,
      incomeCents: result.incomeCents,
      expenseCents: result.expenseCents,
    },
  });
}

// Transfers go through /api/v1/transfers.
export async function POST(request: NextRequest) {
  const { user, response } = await requireApiUserForWrite();
  if (!user) return response;

  const { body, invalid } = await parseBody(request, transactionInputSchema);
  if (!body) return invalid;

  const row = await createTransaction(user.id, body);

  if (!row) return notFound();

  return NextResponse.json({ data: row }, { status: 201 });
}
