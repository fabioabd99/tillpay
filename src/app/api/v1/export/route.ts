import { type NextRequest } from "next/server";

import { csvRow } from "@/lib/csv";
import { isoDate } from "@/lib/dates";
import { parseTransactionFilters } from "@/lib/validators/transaction";
import { requireApiUser } from "@/server/api";
import { listTransactions } from "@/server/queries/transactions";

const PAGE_SIZE = 100;

// GET /api/v1/export?format=csv, same filters as the list. Streams page by page.
export async function GET(request: NextRequest) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseTransactionFilters(params);
  const userId = user.id;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          "Date,Description,Category,Account,Type,Amount,Currency\n",
        ),
      );

      let page = 1;

      for (;;) {
        const { rows, pageCount } = await listTransactions(userId, {
          ...filters,
          page,
          pageSize: PAGE_SIZE,
        });

        for (const row of rows) {
          controller.enqueue(
            encoder.encode(
              csvRow([
                row.occurredOn,
                // user input, csvRow escapes formulas
                row.description,
                row.categoryName,
                row.accountName,
                row.type,
                // plain number so spreadsheets can use it
                (row.amountCents / 100).toFixed(2),
                row.currency,
              ]),
            ),
          );
        }

        if (page >= pageCount || rows.length === 0) break;
        page++;
      }

      controller.close();
    },
  });

  const stamp = isoDate(new Date());

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tillpay-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
