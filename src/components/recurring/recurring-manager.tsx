"use client";

import { format } from "date-fns";
import { Pause, Play, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Amount } from "@/components/amount";
import { CategoryIcon } from "@/components/category-icon";
import { MoneyInput } from "@/components/money-input";
import { OptionSelect } from "@/components/option-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { isoDate, parseDate } from "@/lib/dates";
import { parseAmountToCents } from "@/lib/money";
import { sendJson } from "@/lib/send-json";
import { cn } from "@/lib/utils";
import {
  FREQUENCIES,
  FREQUENCY_LABELS,
  recurringRuleInputSchema,
} from "@/lib/validators/recurring";
import type { RecurringRuleRow } from "@/server/queries/recurring";

type Option = { id: string; name: string; kind?: string };

export function RecurringManager({
  rules,
  accounts,
  categories,
  generated,
}: {
  rules: RecurringRuleRow[];
  accounts: Option[];
  categories: Option[];
  generated: Record<string, number>;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  async function update(rule: RecurringRuleRow, body: { active: boolean } | { isSalary: true }) {
    await sendJson(`/api/v1/recurring-rules/${rule.id}`, "PUT", body);
    router.refresh();
  }

  async function remove(rule: RecurringRuleRow) {
    await fetch(`/api/v1/recurring-rules/${rule.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base text-muted-foreground">
          {rules.length === 0
            ? "Nothing repeating yet."
            : `${rules.length} ${rules.length === 1 ? "thing repeats" : "things repeat"}.`}
        </p>

        <Button className="h-11" onClick={() => setAdding(true)}>
          <Plus data-icon="inline-start" />
          Add a repeating item
        </Button>
      </div>

      {rules.length === 0 ? (
        <Surface className="p-8 text-center">
          <p className="text-base font-medium">Rent, salary, subscriptions</p>
          <p className="mt-1 text-base text-muted-foreground">
            Set them up once and they appear on their own, on the right day.
          </p>
        </Surface>
      ) : (
        <Surface as="ul" className="overflow-hidden">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className={cn(
                "flex flex-wrap items-center gap-4 border-b border-border/60 px-5 py-4 last:border-b-0",
                !rule.active && "opacity-60",
              )}
            >
              <CategoryIcon
                category={rule.categoryName}
                color={rule.categoryColor}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
              />

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-base font-medium">
                  <span className="truncate">{rule.description}</span>
                  {rule.isSalary ? <Badge>Salary</Badge> : null}
                  {!rule.active ? (
                    <Badge variant="secondary">Paused</Badge>
                  ) : null}
                </p>
                <p className="text-sm text-muted-foreground">
                  {FREQUENCY_LABELS[rule.frequency]}
                  {rule.interval > 1 ? ` · every ${rule.interval}` : ""} ·{" "}
                  {rule.accountName}
                  {generated[rule.id]
                    ? ` · ${generated[rule.id]} created so far`
                    : ""}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <Amount cents={rule.amountCents} className="text-base" />
                <p className="text-sm text-muted-foreground">
                  {rule.active
                    ? `next ${format(parseDate(rule.nextRunOn), "d MMM")}`
                    : "not scheduled"}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {rule.type === "income" && rule.active && !rule.isSalary ? (
                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={() => update(rule, { isSalary: true })}
                  >
                    Set as salary
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={
                    rule.active
                      ? `Pause ${rule.description}`
                      : `Resume ${rule.description}`
                  }
                  onClick={() => update(rule, { active: !rule.active })}
                >
                  {rule.active ? <Pause /> : <Play />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={`Remove ${rule.description}`}
                  onClick={() => remove(rule)}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </Surface>
      )}

      <p className="px-1 text-sm text-muted-foreground">
        Removing a repeating item keeps the transactions it already created.
        It only stops future ones.
      </p>

      {adding ? (
        <RuleDialog
          accounts={accounts}
          categories={categories}
          onDone={() => setAdding(false)}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </section>
  );
}

function RuleDialog({
  accounts,
  categories,
  onDone,
  onSaved,
}: {
  accounts: Option[];
  categories: Option[];
  onDone: () => void;
  onSaved: () => void;
}) {
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] =
    useState<(typeof FREQUENCIES)[number]>("monthly");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("none");
  const [startsOn, setStartsOn] = useState(isoDate(new Date()));
  const [isSalary, setIsSalary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const visibleCategories = categories.filter((category) =>
    direction === "in"
      ? category.kind === "income"
      : category.kind === "expense",
  );

  async function save() {
    // the API validates with the same schema
    const magnitude = parseAmountToCents(amount) ?? 0;
    const parsed = recurringRuleInputSchema.safeParse({
      accountId,
      categoryId: categoryId === "none" ? null : categoryId,
      description,
      type: direction === "in" ? "income" : "expense",
      amountCents: direction === "in" ? magnitude : -magnitude,
      frequency,
      // taken from the start date
      dayOfMonth:
        frequency === "monthly" || frequency === "yearly"
          ? Number(startsOn.slice(8, 10)) || null
          : null,
      weekday: frequency === "weekly" ? parseDate(startsOn).getDay() : null,
      startsOn,
      isSalary: direction === "in" && isSalary,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setSaving(true);
    const response = await sendJson("/api/v1/recurring-rules", "POST", parsed.data);
    setSaving(false);

    if (!response.ok) {
      setError("That did not save. Check the details and try again.");
      return;
    }

    onDone();
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onDone()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Something that repeats</DialogTitle>
          <DialogDescription>
            Rent, a salary, a subscription. It will appear on its own each time
            it is due.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>What kind?</FieldLabel>
            <ToggleGroup
              value={[direction]}
              onValueChange={(value) => {
                const next = value[0];
                if (next !== "in" && next !== "out") return;
                setDirection(next);
                setCategoryId("none");
              }}
              className="grid grid-cols-2"
            >
              <ToggleGroupItem value="out" className="h-11">
                Money goes out
              </ToggleGroupItem>
              <ToggleGroupItem value="in" className="h-11">
                Money comes in
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>

          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="rule-name">Name</FieldLabel>
            <Input
              id="rule-name"
              className="h-11"
              placeholder="Rent"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setError(null);
              }}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="rule-amount">Amount</FieldLabel>
            <MoneyInput
              id="rule-amount"
              placeholder="0.00"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setError(null);
              }}
            />
            {error ? <FieldDescription>{error}</FieldDescription> : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="rule-frequency">How often?</FieldLabel>
            <OptionSelect
              id="rule-frequency"
              value={frequency}
              placeholder="Choose"
              options={FREQUENCIES.map((option) => ({
                value: option,
                label: FREQUENCY_LABELS[option],
              }))}
              onChange={(value) => {
                const next = FREQUENCIES.find((option) => option === value);
                if (next) setFrequency(next);
              }}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="rule-category">Category</FieldLabel>
            <OptionSelect
              id="rule-category"
              value={categoryId}
              placeholder="No category"
              options={[
                { value: "none", label: "No category" },
                ...visibleCategories.map((category) => ({
                  value: category.id,
                  label: category.name,
                })),
              ]}
              onChange={(value) => setCategoryId(value || "none")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="rule-account">Account</FieldLabel>
            <OptionSelect
              id="rule-account"
              value={accountId}
              placeholder="Choose an account"
              options={accounts.map((account) => ({ value: account.id, label: account.name }))}
              onChange={setAccountId}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="rule-start">First one on</FieldLabel>
            <Input
              id="rule-start"
              type="date"
              className="h-11"
              value={startsOn}
              onChange={(event) => setStartsOn(event.target.value)}
            />
            <FieldDescription>
              For a monthly item this also sets the day it lands on.
            </FieldDescription>
          </Field>

          {direction === "in" ? (
            <Field orientation="horizontal">
              <Checkbox
                id="rule-salary"
                checked={isSalary}
                onCheckedChange={(checked) => setIsSalary(checked === true)}
              />
              <FieldLabel htmlFor="rule-salary" className="font-normal">
                This is my salary. What you can spend is counted until it arrives.
              </FieldLabel>
            </Field>
          ) : null}
        </FieldGroup>

        <DialogFooter className="mt-4">
          <Button className="h-11" disabled={saving} onClick={save}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
