import { format } from "date-fns";
import { Check, TriangleAlert, Wallet } from "lucide-react";

import { Amount } from "@/components/amount";
import { Tile } from "@/components/home/tile";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

// "On track" = share of money used is not ahead of the share of the cycle gone
// (with a bit of slack).
export function SpendHero({
  safeToSpendCents,
  perDayCents,
  payday,
  cycleDays,
  daysLeft,
  usedFraction,
  balanceCents,
  committedCents,
  hasSalary,
  salaryPrompt,
}: {
  safeToSpendCents: number;
  perDayCents: number;
  payday: Date;
  cycleDays: number;
  daysLeft: number;
  usedFraction: number;
  balanceCents: number;
  committedCents: number;
  hasSalary: boolean;
  // shown when there is no salary to count to
  salaryPrompt?: React.ReactNode;
}) {
  const elapsedFraction = Math.max(0, cycleDays - daysLeft) / cycleDays;
  const used = Math.max(0, Math.min(1, usedFraction));
  const ahead = used > elapsedFraction + 0.05;
  const overdrawn = safeToSpendCents < 0;

  return (
    <Tile
      title="You can spend"
      icon={Wallet}
      aside={`until ${format(payday, "d MMM")}`}
      className="h-full"
    >
      <p
        className={cn(
          "text-5xl font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-6xl lg:text-7xl",
          overdrawn && "text-negative",
        )}
      >
        {formatCents(safeToSpendCents, "EUR")}
      </p>

      <p className="mt-4 text-lg text-muted-foreground">
        <strong className="font-semibold text-foreground tabular-nums">
          {formatCents(perDayCents, "EUR")}
        </strong>{" "}
        {hasSalary ? "a day until payday" : "a day until the end of the month"}
      </p>

      {hasSalary ? null : salaryPrompt}

      <p
        className={cn(
          "mt-4 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
          ahead ? "bg-warning/12 text-warning" : "bg-positive/12 text-positive",
        )}
      >
        {ahead ? (
          <TriangleAlert className="size-4" aria-hidden />
        ) : (
          <Check className="size-4" strokeWidth={2.5} aria-hidden />
        )}
        {ahead ? "Spending a bit fast" : "On track"}
      </p>

      <div className="mt-6">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <span
            className={cn("block h-full rounded-full", ahead ? "bg-warning" : "bg-primary")}
            style={{ width: `${Math.max(1.5, used * 100)}%` }}
          />
        </div>
        <p className="mt-2 flex justify-between gap-4 text-sm text-muted-foreground tabular-nums">
          <span>{Math.round(used * 100)}% of the money used</span>
          <span>
            {daysLeft} {daysLeft === 1 ? "day" : "days"} {hasSalary ? "to payday" : "left this month"}
          </span>
        </p>
      </div>

      {/* how the number above is worked out */}
      <dl className="mt-8 flex flex-col gap-2 border-t pt-4 text-base lg:mt-auto">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">In your accounts</dt>
          <dd className="font-medium tabular-nums">{formatCents(balanceCents, "EUR")}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">Bills still to pay</dt>
          <dd className="font-medium">
            <Amount cents={-committedCents} colored={false} />
          </dd>
        </div>
      </dl>
    </Tile>
  );
}
