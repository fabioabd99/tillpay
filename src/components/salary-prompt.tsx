"use client";

import { CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MoneyInput } from "@/components/money-input";
import { OptionSelect } from "@/components/option-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { parseAmountToCents } from "@/lib/money";
import { sendJson } from "@/lib/send-json";
import { recurringRuleInputSchema } from "@/lib/validators/recurring";
import { nextRunAfter } from "@/server/recurring";

// Shown on Home while no salary is set: asks for the pay day and creates the
// salary as a monthly repeating income.
export function SalaryPrompt({
  accounts,
  salaryCategoryId,
  today,
}: {
  accounts: { id: string; name: string }[];
  salaryCategoryId: string | null;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [error, setError] = useState<{ field: "day" | "amount" | "form"; message: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    // same schema as the API; the day is checked first because the first
    // payday is worked out from it
    const dayOfMonth = recurringRuleInputSchema.shape.dayOfMonth.safeParse(Number(day));
    if (!dayOfMonth.success) {
      setError({ field: "day", message: dayOfMonth.error.issues[0].message });
      return;
    }

    const rule = { frequency: "monthly", interval: 1, dayOfMonth: dayOfMonth.data, weekday: null } as const;
    // a monthly rule never ends, so there is always a next run
    const startsOn = nextRunAfter({ ...rule, startsOn: today, endsOn: null, nextRunOn: today }, today)!;
    const parsed = recurringRuleInputSchema.safeParse({
      accountId,
      categoryId: salaryCategoryId,
      description: "Salary",
      type: "income",
      amountCents: parseAmountToCents(amount) ?? 0,
      ...rule,
      startsOn,
      isSalary: true,
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError({ field: issue.path[0] === "amountCents" ? "amount" : "form", message: issue.message });
      return;
    }

    setSaving(true);
    const response = await sendJson("/api/v1/recurring-rules", "POST", parsed.data);
    setSaving(false);

    if (!response.ok) {
      setError({ field: "form", message: "That did not save. Check the details and try again." });
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" className="mt-4 h-11 w-fit" onClick={() => setOpen(true)}>
        <CalendarDays data-icon="inline-start" />
        When do you get paid?
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>When do you get paid?</DialogTitle>
            <DialogDescription>
              Your money then has to last until that day, not just the end of the month.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field data-invalid={error?.field === "day"}>
              <FieldLabel htmlFor="salary-day">Day of the month</FieldLabel>
              <Input
                id="salary-day"
                inputMode="numeric"
                autoComplete="off"
                className="h-11 w-28 tabular-nums"
                placeholder="25"
                value={day}
                aria-invalid={error?.field === "day"}
                onChange={(event) => {
                  setDay(event.target.value.replace(/\D/g, "").slice(0, 2));
                  setError(null);
                }}
              />
              <FieldDescription>
                {error?.field === "day"
                  ? error.message
                  : "Paid on the 31st? Shorter months use their last day."}
              </FieldDescription>
            </Field>

            <Field data-invalid={error?.field === "amount"}>
              <FieldLabel htmlFor="salary-amount">How much comes in</FieldLabel>
              <MoneyInput
                id="salary-amount"
                placeholder="0.00"
                value={amount}
                aria-invalid={error?.field === "amount"}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setError(null);
                }}
              />
              {error?.field === "amount" ? (
                <FieldDescription>{error.message}</FieldDescription>
              ) : null}
            </Field>

            {accounts.length > 1 ? (
              <Field>
                <FieldLabel htmlFor="salary-account">Paid into</FieldLabel>
                <OptionSelect
                  id="salary-account"
                  value={accountId}
                  placeholder="Choose an account"
                  options={accounts.map((account) => ({ value: account.id, label: account.name }))}
                  onChange={setAccountId}
                />
              </Field>
            ) : null}

            {error?.field === "form" ? (
              <p className="text-sm text-destructive" role="alert">
                {error.message}
              </p>
            ) : null}
          </FieldGroup>

          <DialogFooter className="mt-2">
            <Button className="h-11" disabled={saving || accounts.length === 0} onClick={save}>
              Save my payday
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
