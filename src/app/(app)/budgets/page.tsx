import { format, startOfMonth } from "date-fns";

import { BudgetManager } from "@/components/budgets/budget-manager";
import { PageHeader } from "@/components/ui/surface";
import { isoDate } from "@/lib/dates";
import { requireUser } from "@/server/auth-context";
import { getBudgetProgress } from "@/server/queries/budgets";
import { listCategoriesForUser } from "@/server/queries/transactions";

export const metadata = { title: "Budgets · Tillpay" };

export default async function BudgetsPage() {
  const user = await requireUser();
  const month = isoDate(startOfMonth(new Date()));

  const [budgets, categories] = await Promise.all([
    getBudgetProgress(user.id, month),
    listCategoriesForUser(user.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 lg:py-10">
      <PageHeader
        title="Budgets"
        description={`Limits you set for ${format(new Date(), "MMMM")}. Going over one doesn't block anything.`}
      />

      <BudgetManager
        budgets={budgets}
        categories={categories}
        month={month}
      />
    </main>
  );
}
