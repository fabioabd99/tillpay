import { RecurringManager } from "@/components/recurring/recurring-manager";
import { PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/server/auth-context";
import { listRecurringRules } from "@/server/queries/recurring";
import {
  listAccountBalances,
  listCategoriesForUser,
} from "@/server/queries/transactions";

export const metadata = { title: "Repeating · Tillpay" };

export default async function RecurringPage() {
  const user = await requireUser();

  const [rules, accounts, categories] = await Promise.all([
    listRecurringRules(user.id),
    listAccountBalances(user.id),
    listCategoriesForUser(user.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 lg:py-10">
      <PageHeader
        title="Repeating"
        description="Things that happen every month on their own: rent, your salary, subscriptions."
      />

      <RecurringManager
        rules={rules}
        accounts={accounts}
        categories={categories}
      />
    </main>
  );
}
