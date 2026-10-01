"use client";

import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";

import { Button } from "@/components/ui/button";
import { isoDate, parseDate } from "@/lib/dates";

export function MonthNav({
  month,
  isCustomRange,
}: {
  month: string;
  isCustomRange: boolean;
}) {
  const [, setRange] = useQueryStates(
    {
      from: parseAsString,
      to: parseAsString,
      page: parseAsInteger.withDefault(1),
    },
    { shallow: false, history: "replace" },
  );

  const current = parseDate(month);

  function go(offset: number) {
    const target = addMonths(current, offset);
    void setRange({
      from: isoDate(startOfMonth(target)),
      to: isoDate(endOfMonth(target)),
      page: 1,
    });
  }

  if (isCustomRange) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-lg font-semibold tracking-tight">Custom range</p>
        <Button
          variant="ghost"
          className="h-11"
          onClick={() => void setRange({ from: null, to: null, page: 1 })}
        >
          Back to this month
        </Button>
      </div>
    );
  }

  const isThisMonth = month === isoDate(startOfMonth(new Date()));

  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="size-11"
        aria-label="Previous month"
        onClick={() => go(-1)}
      >
        <ChevronLeft />
      </Button>

      <p className="text-lg font-semibold tracking-tight">
        {format(current, "MMMM yyyy")}
      </p>

      <Button
        variant="ghost"
        size="icon"
        className="size-11"
        aria-label="Next month"
        disabled={isThisMonth}
        onClick={() => go(1)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
