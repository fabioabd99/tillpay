import { Amount } from "@/components/amount";
import { formatCents } from "@/lib/money";

// Sample ledger shown on the auth pages.
const ENTRIES = [
  { date: "01 Sep", label: "ATM withdrawal", cents: -24000, balance: 1569035 },
  { date: "03 Sep", label: "Supermarket", cents: -6240, balance: 1562795 },
  { date: "08 Sep", label: "Streaming", cents: -1299, balance: 1561496 },
  { date: "12 Sep", label: "Freelance invoice", cents: 68000, balance: 1629496 },
  { date: "25 Sep", label: "Monthly salary", cents: 255000, balance: 1884496 },
  { date: "26 Sep", label: "To savings", cents: -32000, balance: 1852496 },
] as const;

export function LedgerPanel() {
  return (
    <section className="relative isolate hidden flex-col justify-between overflow-hidden bg-brand-ink p-10 text-brand-ink-foreground lg:flex xl:p-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-80 bg-primary/25 blur-3xl"
      />

      <p
        translate="no"
        className="text-xs uppercase tracking-[0.18em] text-brand-ink-foreground/55"
      >
        Tillpay
      </p>

      <div className="flex flex-col gap-10">
        {/* not an h1, the form has the page heading */}
        <p className="max-w-md text-4xl font-semibold leading-[1.1] tracking-tight xl:text-5xl">
          Every euro, accounted for.
        </p>

        <div className="max-w-md">
          <div className="mb-3 flex items-baseline justify-between text-[0.65rem] uppercase tracking-[0.14em] text-brand-ink-foreground/45">
            <span>September</span>
            <span>Balance</span>
          </div>

          <ol className="border-t border-brand-rule">
            {ENTRIES.map((entry, index) => (
              <li
                key={entry.label}
                style={{ animationDelay: `${120 + index * 70}ms` }}
                className="grid grid-cols-[3.5rem_1fr_auto] items-baseline gap-x-4 border-b border-brand-rule py-2.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-backwards motion-safe:duration-500"
              >
                <span className="text-xs text-brand-ink-foreground/45">
                  {entry.date}
                </span>

                <span className="truncate text-sm text-brand-ink-foreground/85">
                  {entry.label}
                </span>

                <span className="flex items-baseline gap-4 text-sm tabular-nums">
                  <Amount cents={entry.cents} />
                  <span className="hidden w-24 text-right text-brand-ink-foreground/70 xl:inline">
                    {formatCents(entry.balance, "EUR")}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <p className="max-w-sm text-sm leading-relaxed text-brand-ink-foreground/55">
        Amounts are stored as whole cents, never as decimals that drift. Totals
        are computed by the database, not the browser.
      </p>
    </section>
  );
}
