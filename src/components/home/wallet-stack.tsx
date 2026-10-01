import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { ACCOUNT_FACE } from "@/components/account-face";
import { orderAccounts } from "@/lib/account-order";
import { formatCents } from "@/lib/money";
import { ACCOUNT_KIND_LABELS } from "@/lib/validators/account";
import { cn } from "@/lib/utils";
import type { AccountBalance } from "@/server/queries/transactions";

// Accounts as overlapping wallet cards. The overlap uses container query units
// so it scales with the column width.
export function WalletStack({ accounts }: { accounts: AccountBalance[] }) {
  const front = orderAccounts(accounts);
  const stack = [...front].reverse();

  return (
    <section aria-labelledby="stack-label" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 lg:mt-3.5">
        <h2 id="stack-label" className="text-lg font-medium text-muted-foreground">
          Accounts
        </h2>
        <Link
          href="/transactions"
          className="inline-flex min-h-11 items-center gap-0.5 text-base font-medium text-primary hover:underline hover:underline-offset-4"
        >
          See all
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>

      {stack.length === 0 ? (
        <p className="text-base text-muted-foreground">No accounts yet.</p>
      ) : (
        <ul className="@container flex flex-col">
          {stack.map((account, index) => {
            const face = ACCOUNT_FACE[account.kind];
            const Icon = face.icon;
            const isFront = index === stack.length - 1;
            const overdrawn = account.balanceCents < 0;

            return (
              <li
                key={account.id}
                className={cn(
                  "relative",
                  // overlap = card height (100cqw / 1.586) minus the visible 3.75rem strip
                  index > 0 && "mt-[calc(3.75rem_-_100cqw/1.586)]",
                )}
                style={{ zIndex: index }}
              >
                <Link
                  href={`/transactions?accountId=${account.id}`}
                  className={cn(
                    "relative isolate flex aspect-[1.586] w-full flex-col overflow-hidden rounded-[1.25rem] p-5 text-white",
                    "shadow-[0_-1px_0_rgb(255_255_255/0.12)_inset,0_10px_30px_-12px_rgb(0_0_0/0.45)]",
                    "transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
                    !isFront && "hover:-translate-y-3 focus-visible:-translate-y-3",
                    face.face,
                  )}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-16 -top-24 -z-10 size-60 rounded-full bg-white/15 blur-2xl"
                  />

                  {isFront ? (
                    <>
                      <span className="flex items-start justify-between gap-4">
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-lg font-semibold tracking-tight">
                            {account.name}
                          </span>
                          <span className="text-sm font-medium text-white/90">
                            {ACCOUNT_KIND_LABELS[account.kind]}
                          </span>
                        </span>
                        <Icon className="size-7 shrink-0 text-white/90" aria-hidden />
                      </span>

                      <span className="mt-auto flex flex-col">
                        <span className="text-sm text-white/90">
                          {overdrawn ? "Overdrawn" : "Balance today"}
                        </span>
                        <span className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                          {overdrawn ? "−" : ""}
                          {formatCents(Math.abs(account.balanceCents), account.currency)}
                        </span>
                      </span>
                    </>
                  ) : (
                    <span className="flex items-baseline justify-between gap-4">
                      <span className="truncate text-lg font-semibold tracking-tight">
                        {account.name}
                      </span>
                      <span className="shrink-0 text-lg font-semibold tracking-tight tabular-nums">
                        {overdrawn ? "−" : ""}
                        {formatCents(Math.abs(account.balanceCents), account.currency)}
                      </span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
