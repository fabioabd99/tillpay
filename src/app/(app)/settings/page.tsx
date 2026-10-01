import { AccountManager } from "@/components/settings/account-manager";
import { CategoryManager } from "@/components/settings/category-manager";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/server/auth-context";
import { listAccounts } from "@/server/queries/accounts";
import { listCategories } from "@/server/queries/categories";

export const metadata = { title: "Settings · Tillpay" };

export default async function SettingsPage() {
  const user = await requireUser();

  const [accounts, categories] = await Promise.all([
    listAccounts(user.id),
    listCategories(user.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 py-8 lg:py-10">
      <PageHeader
        title="Settings"
        description="The accounts you track and the categories you sort things into."
      />

      <AccountManager accounts={accounts} />

      <Separator />

      <CategoryManager categories={categories} />
    </main>
  );
}
