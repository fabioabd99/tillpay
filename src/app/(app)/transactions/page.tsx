import { endOfMonth, startOfMonth } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, Download, Search } from "lucide-react";

import { Amount } from "@/components/amount";
import { QuickAddButton } from "@/components/quick-add";
import { AccountSwitcher } from "@/components/transactions/account-switcher";
import { BalanceSparkline } from "@/components/transactions/balance-sparkline";
import { MonthNav } from "@/components/transactions/month-nav";
import { TransactionList } from "@/components/transactions/transaction-list";
import { TransactionPagination } from "@/components/transactions/transaction-pagination";
import { TransactionToolbar } from "@/components/transactions/transaction-toolbar";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Surface } from "@/components/ui/surface";
import { orderAccounts } from "@/lib/account-order";
import { isoDate, parseDate } from "@/lib/dates";
import { parseTransactionFilters } from "@/lib/validators/transaction";
import { requireUser } from "@/server/auth-context";
import {
  getBalanceSeries,
  listAccountBalances,
  listCategoriesForUser,
  listTransactions,
} from "@/server/queries/transactions";

export const metadata = { title: "Accounts · Tillpay" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const raw = parseTransactionFilters(await searchParams);

  // defaults to the current month
  const thisMonthStart = startOfMonth(new Date());
  const defaultedToThisMonth = !raw.from && !raw.to;

  const filters = defaultedToThisMonth
    ? {
        ...raw,
        from: isoDate(thisMonthStart),
        to: isoDate(endOfMonth(thisMonthStart)),
      }
    : raw;

  const monthAnchor = filters.from ?? isoDate(thisMonthStart);
  const anchorDate = parseDate(monthAnchor);
  const isCustomRange =
    !defaultedToThisMonth &&
    (filters.from !== isoDate(startOfMonth(anchorDate)) ||
      filters.to !== isoDate(endOfMonth(anchorDate)));

  const [accountBalances, categories] = await Promise.all([
    listAccountBalances(user.id),
    listCategoriesForUser(user.id),
  ]);

  const hasFilters =
    !!filters.q ||
    !!filters.type ||
    !!filters.categoryId ||
    filters.minCents !== undefined ||
    filters.maxCents !== undefined ||
    filters.uncategorised;

  // Default to the first account, unless we came from a filtered link (e.g. from
  // Home) without an account, then search all of them.
  const fallback = orderAccounts(accountBalances)[0];
  const selectedId =
    filters.accountId ?? (hasFilters ? null : (fallback?.id ?? null));
  const viewFilters = selectedId ? { ...filters, accountId: selectedId } : filters;

  const [result, series] = await Promise.all([
    listTransactions(user.id, viewFilters),
    getBalanceSeries(
      user.id,
      selectedId,
      filters.from ?? isoDate(thisMonthStart),
      filters.to ?? isoDate(endOfMonth(thisMonthStart)),
    ),
  ]);

  const selected = accountBalances.find((account) => account.id === selectedId);

  const now = new Date();
  const today = isoDate(now);
  const yesterday = isoDate(new Date(now.getTime() - 86_400_000));

  const exportParams = new URLSearchParams({
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(selectedId ? { accountId: selectedId } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
  }).toString();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 lg:py-10">
      <AccountSwitcher accounts={accountBalances} selectedId={selectedId} />

      <div className="flex min-w-0 flex-col gap-5">
        <Surface as="section" aria-label="This month in the chosen account">
          <div className="border-b px-4 py-2">
            <MonthNav month={monthAnchor} isCustomRange={isCustomRange} />
          </div>

          <div className="grid gap-4 px-6 pt-5 sm:grid-cols-[auto_auto_minmax(0,1fr)] sm:items-end sm:gap-10 lg:px-8">
            <dl className="contents">
              {(
                [
                  [ArrowDownLeft, "Came in", result.incomeCents],
                  [ArrowUpRight, "Went out", result.expenseCents],
                ] as const
              ).map(([Icon, label, cents]) => (
                <div key={label}>
                  <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </dt>
                  <dd className="mt-1">
                    <Amount cents={cents} className="text-2xl font-semibold tracking-tight" />
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <BalanceSparkline points={series} className="mt-3 h-20 w-full" />
        </Surface>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-base text-muted-foreground">
            {result.total} {result.total === 1 ? "movement" : "movements"}
          </p>

          <div className="flex items-center gap-2">
            {/* same filters as the list */}
            <a
              href={`/api/v1/export?${exportParams}`}
              download
              className={buttonVariants({
                variant: "outline",
                className: "h-11",
              })}
            >
              <Download data-icon="inline-start" />
              Download
            </a>

            <QuickAddButton />
          </div>
        </div>

        <TransactionToolbar
          accounts={accountBalances}
          categories={categories}
          hideAccountFilter
        />

        {result.rows.length === 0 ? (
          <Surface className="py-4">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search />
                </EmptyMedia>
                <EmptyTitle>
                  {hasFilters ? "Nothing matches" : "Nothing this month"}
                </EmptyTitle>
                <EmptyDescription>
                  {hasFilters
                    ? "Try clearing a filter, or look at another month."
                    : "Step back to an earlier month, or add something."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </Surface>
        ) : (
          <>
            <TransactionList
              rows={result.rows}
              accounts={accountBalances}
              categories={categories}
              today={today}
              yesterday={yesterday}
              showAccount={!selected}
            />
            <TransactionPagination
              page={filters.page}
              pageCount={result.pageCount}
            />
          </>
        )}
      </div>
    </main>
  );
}
