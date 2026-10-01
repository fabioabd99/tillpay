import { CategoryIcon } from "@/components/category-icon";
import { Surface } from "@/components/ui/surface";
import { formatCents } from "@/lib/money";
import type { CategoryTotal } from "@/server/queries/reports";

export function CategoryBreakdown({ rows }: { rows: CategoryTotal[] }) {
  if (rows.length === 0) {
    return (
      <Surface as="p" className="p-6 text-center text-muted-foreground">
        Nothing spent in this period.
      </Surface>
    );
  }

  const largest = rows[0].cents || 1;

  return (
    <Surface className="overflow-hidden">
      <table className="w-full">
        <caption className="sr-only">
          Spending by category, largest first
        </caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Share of spending</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id ?? "none"} className="border-b last:border-b-0">
              <th
                scope="row"
                className="py-3 pl-4 pr-3 text-left font-medium align-middle"
              >
                <span className="flex items-center gap-3">
                  <CategoryIcon
                    category={row.name}
                    color={row.color}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  />
                  <span className="truncate">{row.name}</span>
                </span>
              </th>

              <td className="w-full px-3 py-3 align-middle">
                <span className="flex items-center gap-3">
                  <span
                    className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                    aria-hidden
                  >
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.max(2, (row.cents / largest) * 100)}%`,
                        ...(row.color ? { backgroundColor: row.color } : {}),
                      }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {Math.round(row.share * 100)}%
                  </span>
                </span>
              </td>

              <td className="py-3 pl-3 pr-4 text-right align-middle tabular-nums">
                {formatCents(row.cents, "EUR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  );
}
