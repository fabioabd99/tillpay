"use client";

import { Check, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useEffect, useRef, useState } from "react";

import { ACCOUNT_FACE } from "@/components/account-face";
import { Button } from "@/components/ui/button";
import { orderAccounts } from "@/lib/account-order";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { AccountBalance } from "@/server/queries/transactions";

export function AccountSwitcher({
  accounts,
  selectedId,
}: {
  accounts: AccountBalance[];
  selectedId: string | null;
}) {
  const [, setFilters] = useQueryStates(
    {
      accountId: parseAsString,
      page: parseAsInteger.withDefault(1),
    },
    { shallow: false, history: "replace" },
  );

  const rail = useRef<HTMLDivElement>(null);
  // which sides have cards out of view
  const [hidden, setHidden] = useState({ before: false, after: false });

  useEffect(() => {
    const row = rail.current;
    if (!row) return;

    const measure = () =>
      setHidden({
        before: row.scrollLeft > 1,
        after: row.scrollLeft + row.clientWidth < row.scrollWidth - 1,
      });

    measure();
    row.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(row);

    return () => {
      row.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [accounts.length]);

  const ordered = orderAccounts(accounts);

  // Center the selected card. Not using scrollIntoView because it also scrolls
  // the page vertically.
  useEffect(() => {
    const row = rail.current;
    const card = row?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!row || !card) return;

    const offset =
      card.getBoundingClientRect().left - row.getBoundingClientRect().left;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollTo({
      left: row.scrollLeft + offset - (row.clientWidth - card.clientWidth) / 2,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [selectedId]);

  function nudge(direction: 1 | -1) {
    const row = rail.current;
    if (!row) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollBy({
      left: direction * row.clientWidth * 0.8,
      behavior: reduce ? "auto" : "smooth",
    });
  }

  return (
    <section aria-labelledby="accounts-title" className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-4">
        <h1 id="accounts-title" className="text-3xl font-semibold tracking-tight">
          Accounts
        </h1>

        {/* arrows only when something is hidden */}
        {hidden.before || hidden.after ? (
          <div className="hidden items-center gap-2 md:flex">
            <Button
              variant="outline"
              size="icon"
              className="size-11 rounded-full"
              aria-label="Previous accounts"
              disabled={!hidden.before}
              onClick={() => nudge(-1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-11 rounded-full"
              aria-label="More accounts"
              disabled={!hidden.after}
              onClick={() => nudge(1)}
            >
              <ChevronRight />
            </Button>
          </div>
        ) : null}
      </div>
      <div
        ref={rail}
        role="tablist"
        aria-label="Accounts"
        className={cn(
          // bottom padding so the shadow isn't clipped
          "flex snap-x snap-mandatory gap-4 overflow-x-auto pt-3 pb-8",
          hidden.before &&
            hidden.after &&
            "[mask-image:linear-gradient(to_right,transparent,black_2.5rem,black_calc(100%-2.5rem),transparent)]",
          hidden.before &&
            !hidden.after &&
            "[mask-image:linear-gradient(to_right,transparent,black_2.5rem)]",
          !hidden.before &&
            hidden.after &&
            "[mask-image:linear-gradient(to_left,transparent,black_2.5rem)]",
          // full-bleed on mobile
          "-mx-4 scroll-px-4 px-4",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {ordered.map((account) => (
          <WalletCard
            key={account.id}
            selected={selectedId === account.id}
            face={ACCOUNT_FACE[account.kind].face}
            icon={ACCOUNT_FACE[account.kind].icon}
            kind={ACCOUNT_FACE[account.kind].label}
            name={account.name}
            cents={account.balanceCents}
            currency={account.currency}
            onSelect={() => void setFilters({ accountId: account.id, page: 1 })}
          />
        ))}
      </div>
    </section>
  );
}

function WalletCard({
  selected,
  face,
  icon: Icon,
  kind,
  name,
  cents,
  currency,
  onSelect,
}: {
  selected: boolean;
  face: string;
  icon: LucideIcon;
  kind: string;
  name: string;
  cents: number;
  currency: string;
  onSelect: () => void;
}) {
  const overdrawn = cents < 0;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "relative isolate flex aspect-[1.586] w-[17rem] shrink-0 snap-center cursor-pointer flex-col overflow-hidden rounded-[1.25rem] p-5 text-left text-white sm:w-[18.5rem]",
        "transition-[transform,box-shadow] duration-200 ease-out",
        selected
          ? "-translate-y-1 shadow-[0_4px_8px_rgb(0_0_0/0.12),0_22px_40px_-14px_rgb(0_0_0/0.6)]"
          : "shadow-[0_2px_4px_rgb(0_0_0/0.08),0_12px_28px_-12px_rgb(0_0_0/0.45)] hover:-translate-y-0.5",
        face,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 -z-10 size-56 rounded-full bg-white/15 blur-2xl"
      />

      <span className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-white/90">
          {kind.toLowerCase() === name.toLowerCase() ? "" : kind}
        </span>
        {selected ? (
          <span className="flex size-7 items-center justify-center rounded-full bg-white text-neutral-900">
            <Check className="size-4" strokeWidth={3} aria-hidden />
          </span>
        ) : (
          <Icon className="size-6 text-white/90" aria-hidden />
        )}
      </span>

      <span className="mt-1 truncate text-lg font-semibold tracking-tight">
        {name}
      </span>

      <span className="mt-auto flex items-end justify-between gap-3">
        <span className="flex flex-col">
          <span className="text-sm text-white/90">Balance today</span>
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {overdrawn ? "−" : ""}
            {formatCents(Math.abs(cents), currency)}
          </span>
        </span>
        {overdrawn ? (
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium">
            Overdrawn
          </span>
        ) : null}
      </span>
    </button>
  );
}
