"use client";

import { useState } from "react";

import { Amount } from "@/components/amount";
import { CategoryIcon } from "@/components/category-icon";
import {
  TransactionDialog,
  type EditableTransaction,
} from "@/components/transactions/transaction-dialog";
import { Surface } from "@/components/ui/surface";
import { parseDate } from "@/lib/dates";
import type { TransactionRow } from "@/server/queries/transactions";

const weekday = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const withYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const dayAndMonth = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
});

function dayHeading(value: string, today: string, yesterday: string) {
  const date = parseDate(value);
  const isThisYear = date.getFullYear() === parseDate(today).getFullYear();

  if (value === today) return `Today, ${dayAndMonth.format(date)}`;
  if (value === yesterday) return `Yesterday, ${dayAndMonth.format(date)}`;

  return isThisYear ? weekday.format(date) : withYear.format(date);
}

type Option = { id: string; name: string; kind?: string };

export function TransactionList({
  rows,
  accounts,
  categories,
  today,
  yesterday,
  showAccount = true,
}: {
  rows: TransactionRow[];
  accounts: Option[];
  categories: Option[];
  /** from the server, avoids timezone mismatches */
  today: string;
  yesterday: string;
  showAccount?: boolean;
}) {
  const [editing, setEditing] = useState<EditableTransaction | null>(null);

  const days: { date: string; rows: TransactionRow[] }[] = [];
  for (const row of rows) {
    const last = days.at(-1);
    if (last?.date === row.occurredOn) last.rows.push(row);
    else days.push({ date: row.occurredOn, rows: [row] });
  }

  return (
    <>
      <div className="flex flex-col gap-8">
        {days.map((day) => (
          <section key={day.date} className="flex flex-col gap-1">
            <header className="flex items-baseline justify-between gap-4 px-2 pb-2">
              <h2 className="text-base font-medium">
                {dayHeading(day.date, today, yesterday)}
              </h2>
              <Amount
                cents={day.rows[0].dayNetCents}
                colored={false}
                className="text-sm text-muted-foreground"
              />
            </header>

            <Surface
              as="ul"
              data-stagger
              className="overflow-hidden"
            >
              {day.rows.map((row) => (
                <li
                key={row.id}
                className="border-b border-border/60 last:border-b-0"
              >
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({
                        id: row.id,
                        type: row.type,
                        amountCents: row.amountCents,
                        occurredOn: row.occurredOn,
                        description: row.description,
                        accountId: row.accountId,
                        categoryId: row.categoryId,
                      })
                    }
                    className="flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    <CategoryIcon
                      category={row.categoryName}
                      color={row.categoryColor}
                      isTransfer={row.type === "transfer"}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium">
                        {row.description ?? row.categoryName ?? "Transaction"}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {row.type === "transfer"
                          ? "Transfer"
                          : (row.categoryName ?? "No category")}
                        {showAccount ? ` · ${row.accountName}` : ""}
                      </span>
                    </span>

                    <Amount
                      cents={row.amountCents}
                      currency={row.currency}
                      colored={row.type !== "transfer"}
                      className="shrink-0 text-base font-medium"
                    />
                  </button>
                </li>
              ))}
            </Surface>
          </section>
        ))}
      </div>

      {editing ? (
        <TransactionDialog
          // remount when switching transactions
          key={editing.id}
          accounts={accounts}
          categories={categories}
          transaction={editing}
          open
          onOpenChange={(next) => {
            if (!next) setEditing(null);
          }}
        />
      ) : null}
    </>
  );
}
