"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { OptionSelect } from "@/components/option-select";
import { TextField } from "@/components/text-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { formatCents, parseAmountToCents } from "@/lib/money";
import { sendJson } from "@/lib/send-json";
import { cn } from "@/lib/utils";
import {
  ACCOUNT_KINDS,
  ACCOUNT_KIND_LABELS,
  accountInputSchema,
} from "@/lib/validators/account";
import type { AccountListRow } from "@/server/queries/accounts";

// the shared schema, with the opening balance typed as text
const formSchema = accountInputSchema.omit({ initialBalanceCents: true }).extend({
  openingBalance: z
    .string()
    .refine((value) => parseAmountToCents(value) !== null, "Enter an amount"),
});

type FormValues = z.output<typeof formSchema>;

export function AccountManager({ accounts }: { accounts: AccountListRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AccountListRow | null>(null);
  const [adding, setAdding] = useState(false);

  async function toggleHidden(account: AccountListRow) {
    await sendJson(`/api/v1/accounts/${account.id}`, "PUT", { hidden: !account.archivedAt });
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Your accounts
          </h2>
          <p className="text-sm text-muted-foreground">
            Where your money sits. Balances come from the opening amount plus
            everything recorded since.
          </p>
        </div>

        <Button className="h-11" onClick={() => setAdding(true)}>
          <Plus data-icon="inline-start" />
          Add account
        </Button>
      </header>

      <Surface as="ul" className="overflow-hidden">
        {accounts.map((account) => (
          <li
            key={account.id}
            className={cn(
              "flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0",
              account.archivedAt && "opacity-60",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium">
                <span className="truncate">{account.name}</span>
                {account.archivedAt ? (
                  <Badge variant="secondary">Hidden</Badge>
                ) : null}
              </p>
              <p className="text-sm text-muted-foreground">
                {ACCOUNT_KIND_LABELS[account.kind]} · {account.currency} ·{" "}
                {account.transactionCount}{" "}
                {account.transactionCount === 1 ? "movement" : "movements"}
              </p>
            </div>

            <span
              className={cn(
                "tabular-nums",
                account.balanceCents < 0 && "text-negative",
              )}
            >
              {formatCents(account.balanceCents, account.currency)}
            </span>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={`Edit ${account.name}`}
                onClick={() => setEditing(account)}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={
                  account.archivedAt
                    ? `Show ${account.name} again`
                    : `Hide ${account.name}`
                }
                onClick={() => toggleHidden(account)}
              >
                {account.archivedAt ? <Eye /> : <EyeOff />}
              </Button>
            </div>
          </li>
        ))}
      </Surface>

      <p className="px-1 text-sm text-muted-foreground">
        Accounts are hidden, not deleted, so their transactions are kept. You
        can show a hidden account again at any time.
      </p>

      {adding ? (
        <AccountDialog
          key="new"
          onDone={() => setAdding(false)}
          onSaved={() => router.refresh()}
        />
      ) : null}

      {editing ? (
        <AccountDialog
          key={editing.id}
          account={editing}
          onDone={() => setEditing(null)}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </section>
  );
}

function AccountDialog({
  account,
  onDone,
  onSaved,
}: {
  account?: AccountListRow;
  onDone: () => void;
  onSaved: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: account
      ? {
          name: account.name,
          kind: account.kind,
          currency: account.currency,
          openingBalance: (account.initialBalanceCents / 100).toFixed(2),
        }
      : { name: "", kind: "checking" as const, currency: "EUR", openingBalance: "0.00" },
  });

  async function submit(values: FormValues) {
    setFormError(null);

    const response = await sendJson(
      account ? `/api/v1/accounts/${account.id}` : "/api/v1/accounts",
      account ? "PATCH" : "POST",
      {
        name: values.name,
        kind: values.kind,
        currency: values.currency,
        initialBalanceCents: parseAmountToCents(values.openingBalance)!,
      },
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setFormError(payload?.error?.message ?? "That did not save.");
      return;
    }

    onDone();
    onSaved();
  }

  const kind = form.watch("kind");

  return (
    <Dialog open onOpenChange={(next) => !next && onDone()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {account ? "Edit account" : "Add an account"}
          </DialogTitle>
          <DialogDescription>
            {account
              ? "Changing the opening amount moves the balance by the same amount."
              : "The opening amount is what was in it before you started tracking."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(submit)} noValidate>
          <FieldGroup>
            {formError ? (
              <Alert variant="destructive">
                <AlertTitle>Could not save</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <TextField
              id="account-name"
              label="Name"
              placeholder="Main Checking"
              error={form.formState.errors.name?.message}
              {...form.register("name")}
            />

            <Field>
              <FieldLabel htmlFor="account-kind">Type</FieldLabel>
              <OptionSelect
                id="account-kind"
                value={kind}
                placeholder="Choose a type"
                options={ACCOUNT_KINDS.map((option) => ({
                  value: option,
                  label: ACCOUNT_KIND_LABELS[option],
                }))}
                onChange={(value) => {
                  const next = ACCOUNT_KINDS.find((option) => option === value);
                  if (next) form.setValue("kind", next);
                }}
              />
              <FieldDescription>
                Savings are left out of &ldquo;you can spend&rdquo; on the home
                screen.
              </FieldDescription>
            </Field>

            <TextField
              id="account-opening"
              label="Opening amount"
              inputMode="decimal"
              autoComplete="off"
              className="tabular-nums"
              placeholder="0.00"
              hint="Can be negative for a card you owe on."
              error={form.formState.errors.openingBalance?.message}
              {...form.register("openingBalance")}
            />

            <TextField
              id="account-currency"
              label="Currency"
              className="font-mono uppercase"
              maxLength={3}
              autoComplete="off"
              spellCheck={false}
              hint="Tillpay does not convert between currencies, so accounts in different ones cannot transfer to each other."
              error={form.formState.errors.currency?.message}
              {...form.register("currency")}
            />
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              type="submit"
              className="h-11"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              {account ? "Save changes" : "Add account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
