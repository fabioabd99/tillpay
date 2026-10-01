"use client";

import { ListFilter, Search, X } from "lucide-react";
import {
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import { useEffect, useState } from "react";

import { OptionSelect } from "@/components/option-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatCents, parseAmountToCents } from "@/lib/money";
import { TRANSACTION_TYPES } from "@/lib/validators/transaction";

const ALL = "all";

const TYPE_LABELS: Record<string, string> = {
  income: "Money in",
  expense: "Money out",
  transfer: "Transfers",
};

const parsers = {
  q: parseAsString.withDefault(""),
  type: parseAsStringLiteral(TRANSACTION_TYPES),
  accountId: parseAsString,
  categoryId: parseAsString,
  from: parseAsString.withDefault(""),
  to: parseAsString.withDefault(""),
  minCents: parseAsInteger,
  maxCents: parseAsInteger,
  uncategorised: parseAsBoolean,
  page: parseAsInteger.withDefault(1),
};

type Option = { id: string; name: string };

const nameOf = (options: Option[], id: string | null) =>
  options.find((option) => option.id === id)?.name;

const withAll = (label: string, options: Option[]) => [
  { value: ALL, label },
  ...options.map((option) => ({ value: option.id, label: option.name })),
];

export function TransactionToolbar({
  accounts,
  categories,
  hideAccountFilter = false,
}: {
  accounts: Option[];
  categories: Option[];
  hideAccountFilter?: boolean;
}) {
  const [filters, setFilters] = useQueryStates(parsers, {
    history: "replace",
    shallow: false,
  });

  const [search, setSearch] = useState(filters.q);

  // keep the input in sync when q is cleared from outside
  const [lastQ, setLastQ] = useState(filters.q);
  if (filters.q !== lastQ) {
    setLastQ(filters.q);
    setSearch(filters.q);
  }

  useEffect(() => {
    if (search === filters.q) return;
    const timer = setTimeout(
      () => void setFilters({ q: search || null, page: 1 }),
      300,
    );
    return () => clearTimeout(timer);
  }, [search, filters.q, setFilters]);

  const { accountId, categoryId } = filters;

  const chips = [
    filters.type && {
      key: "type",
      label: TYPE_LABELS[filters.type],
      clear: { type: null },
    },
    !hideAccountFilter &&
      accountId && {
        key: "account",
        label: nameOf(accounts, accountId) ?? "Account",
        clear: { accountId: null },
      },
    categoryId && {
      key: "category",
      label: nameOf(categories, categoryId) ?? "Category",
      clear: { categoryId: null },
    },
    filters.from && {
      key: "from",
      label: `From ${filters.from}`,
      clear: { from: null },
    },
    filters.to && { key: "to", label: `To ${filters.to}`, clear: { to: null } },
    filters.minCents !== null && {
      key: "min",
      label: `Over ${formatCents(filters.minCents, "EUR")}`,
      clear: { minCents: null },
    },
    filters.maxCents !== null && {
      key: "max",
      label: `Under ${formatCents(filters.maxCents, "EUR")}`,
      clear: { maxCents: null },
    },
    filters.uncategorised && {
      key: "uncategorised",
      label: "Without a category",
      clear: { uncategorised: null },
    },
  ].filter(Boolean) as { key: string; label: string; clear: object }[];

  function setAmount(key: "minCents" | "maxCents", raw: string) {
    const trimmed = raw.trim();
    if (trimmed === "") return void setFilters({ [key]: null, page: 1 });

    const cents = parseAmountToCents(trimmed);
    if (cents !== null) void setFilters({ [key]: Math.abs(cents), page: 1 });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="h-11 pl-9"
            type="search"
            name="q"
            autoComplete="off"
            spellCheck={false}
            value={search}
            placeholder="Search your transactions…"
            aria-label="Search your transactions"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <Sheet>
          <SheetTrigger
            render={
              <Button variant="outline" className="h-11">
                <ListFilter data-icon="inline-start" />
                Filters
                {chips.length > 0 ? (
                  <Badge variant="secondary">{chips.length}</Badge>
                ) : null}
              </Button>
            }
          />

          <SheetContent className="flex flex-col gap-0">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>
                Narrow the list down. Everything here is optional.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-type">Show</Label>
                <OptionSelect
                  id="filter-type"
                  value={filters.type ?? ALL}
                  placeholder="Everything"
                  options={[
                    { value: ALL, label: "Everything" },
                    ...TRANSACTION_TYPES.map((type) => ({ value: type, label: TYPE_LABELS[type] })),
                  ]}
                  onChange={(value) =>
                    void setFilters({
                      type: TRANSACTION_TYPES.find((type) => type === value) ?? null,
                      page: 1,
                    })
                  }
                />
              </div>

              <div
                className="flex flex-col gap-2"
                hidden={hideAccountFilter}
              >
                <Label htmlFor="filter-account">Account</Label>
                <OptionSelect
                  id="filter-account"
                  value={accountId ?? ALL}
                  placeholder="Any account"
                  options={withAll("Any account", accounts)}
                  onChange={(value) =>
                    void setFilters({ accountId: value === ALL ? null : value || null, page: 1 })
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-category">Category</Label>
                <OptionSelect
                  id="filter-category"
                  value={categoryId ?? ALL}
                  placeholder="Any category"
                  options={withAll("Any category", categories)}
                  onChange={(value) =>
                    void setFilters({ categoryId: value === ALL ? null : value || null, page: 1 })
                  }
                />
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">Dates</legend>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["from", "From"],
                      ["to", "To"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="flex flex-col gap-2">
                      <Label htmlFor={`filter-${key}`} className="text-muted-foreground">
                        {label}
                      </Label>
                      <Input
                        id={`filter-${key}`}
                        type="date"
                        className="h-11"
                        value={filters[key]}
                        onChange={(event) =>
                          void setFilters({ [key]: event.target.value || null, page: 1 })
                        }
                      />
                    </div>
                  ))}
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">Amount</legend>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["minCents", "min", "At least"],
                      ["maxCents", "max", "At most"],
                    ] as const
                  ).map(([key, id, label]) => (
                    <div key={key} className="flex flex-col gap-2">
                      <Label htmlFor={`filter-${id}`} className="text-muted-foreground">
                        {label}
                      </Label>
                      <Input
                        id={`filter-${id}`}
                        inputMode="decimal"
                        className="h-11"
                        placeholder="0.00"
                        defaultValue={
                          filters[key] === null ? "" : (filters[key] / 100).toFixed(2)
                        }
                        onBlur={(event) => setAmount(key, event.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>
            </div>

            <SheetFooter>
              <SheetClose
                render={<Button className="h-11">Show results</Button>}
              />
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <Button
              key={chip.key}
              variant="secondary"
              size="sm"
              aria-label={`Remove filter: ${chip.label}`}
              onClick={() => void setFilters({ ...chip.clear, page: 1 })}
            >
              {chip.label}
              <X data-icon="inline-end" />
            </Button>
          ))}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void setFilters(null)}
          >
            Clear all
          </Button>
        </div>
      ) : null}
    </div>
  );
}
