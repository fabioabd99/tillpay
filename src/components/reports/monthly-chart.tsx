"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { parseDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import type { MonthlyPoint } from "@/server/queries/reports";

const config = {
  income: { label: "Money in", color: "var(--positive)" },
  expense: { label: "Money out", color: "var(--negative)" },
} satisfies ChartConfig;

const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "short" });

// Income above zero, spending below.
export function MonthlyChart({ points }: { points: MonthlyPoint[] }) {
  const data = points.map((point) => ({
    month: point.month,
    label: monthLabel.format(parseDate(point.month)),
    income: point.incomeCents,
    expense: -point.expenseCents,
  }));

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={data} stackOffset="sign" margin={{ left: 4, right: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />

        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />

        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(value: number) =>
            `${value < 0 ? "−" : ""}${Math.abs(Math.round(value / 100000))}k`
          }
        />

        <ReferenceLine y={0} stroke="var(--border)" />

        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {config[name as keyof typeof config]?.label ?? name}
                  </span>
                  <span className="tabular-nums">
                    {formatCents(Math.abs(Number(value)), "EUR")}
                  </span>
                </div>
              )}
            />
          }
        />

        <ChartLegend content={<ChartLegendContent />} />

        {/* expense declared first so the legend shows "Money in" first */}
        <Bar
          dataKey="expense"
          stackId="a"
          fill="var(--color-expense)"
          radius={[0, 0, 4, 4]}
        />
        <Bar
          dataKey="income"
          stackId="a"
          fill="var(--color-income)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
