export type SpendingSegment = {
  id: string;
  name: string;
  color: string | null;
  cents: number;
};

// Largest categories for the Home spending bar, the rest grouped as "Other".
// Rows come largest first with a running total from SQL (getCategoryPace).
export function spendingSegments(
  rows: readonly {
    id: string;
    name: string;
    color: string | null;
    thisMonthCents: number;
    runningCents: number;
  }[],
  totalCents: number,
  max = 4,
): SpendingSegment[] {
  const top = rows.slice(0, max);
  const rest = totalCents - (top.at(-1)?.runningCents ?? 0);

  const segments = top.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    cents: row.thisMonthCents,
  }));

  return rest > 0
    ? [...segments, { id: "other", name: "Other", color: null, cents: rest }]
    : segments;
}
