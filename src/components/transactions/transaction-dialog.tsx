"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format, subDays } from "date-fns";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Landmark,
  PenLine,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { CategoryIcon } from "@/components/category-icon";
import { OptionSelect } from "@/components/option-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { isoDate, parseDate } from "@/lib/dates";
import { formatCents, parseAmountToCents } from "@/lib/money";
import { sendJson } from "@/lib/send-json";
import { cn } from "@/lib/utils";
import type { TransactionRow } from "@/server/queries/transactions";

type Option = { id: string; name: string; kind?: string; color?: string | null };

const formatDay = (value: string) =>
  format(parseDate(value), "d MMM");

export type EditableTransaction = Pick<
  TransactionRow,
  "id" | "type" | "amountCents" | "occurredOn" | "description" | "accountId" | "categoryId"
>;

const NONE = "none";

// The form works with a direction ("in" / "out") and a positive amount; the
// sign is applied on submit.
const formSchema = z
  .object({
    direction: z.enum(["out", "in", "move"]),
    amount: z.string().refine((value) => {
      const cents = parseAmountToCents(value);
      return cents !== null && cents > 0;
    }, "Enter an amount, like 12.50"),
    description: z.string().trim().max(200),
    categoryId: z.string(),
    accountId: z.uuid("Choose an account"),
    toAccountId: z.string(),
    occurredOn: z.iso.date("Choose a date"),
  })
  .refine(
    (value) =>
      value.direction !== "move" ||
      (!!value.toAccountId && value.toAccountId !== value.accountId),
    {
      message: "Choose a different account to move the money into",
      path: ["toAccountId"],
    },
  );

type FormValues = z.infer<typeof formSchema>;

export function TransactionDialog({
  accounts,
  categories,
  transaction,
  open,
  onOpenChange,
}: {
  accounts: Option[];
  categories: Option[];
  transaction?: EditableTransaction;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [ownOpen, setOwnOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : ownOpen;
  const isEditing = !!transaction;
  const isTransfer = transaction?.type === "transfer";

  function setOpen(next: boolean) {
    if (!next) {
      setFormError(null);
      setConfirmingDelete(false);
    }
    if (isControlled) onOpenChange?.(next);
    else setOwnOpen(next);
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: transaction
      ? {
          direction: transaction.amountCents >= 0 ? "in" : "out",
          amount: (Math.abs(transaction.amountCents) / 100).toFixed(2),
          description: transaction.description ?? "",
          categoryId: transaction.categoryId ?? NONE,
          accountId: transaction.accountId,
          toAccountId: "",
          occurredOn: transaction.occurredOn,
        }
      : {
          direction: "out",
          amount: "",
          description: "",
          categoryId: NONE,
          accountId: accounts[0]?.id ?? "",
          toAccountId: accounts[1]?.id ?? "",
          occurredOn: isoDate(new Date()),
        },
  });

  const direction = form.watch("direction");
  const occurredOn = form.watch("occurredOn");
  // Let the dialog grow but not shrink while it's open, so it doesn't jump
  // when switching tabs.
  const sizeWatcher = useRef<ResizeObserver | null>(null);
  const formRef = useCallback((element: HTMLFormElement | null) => {
    sizeWatcher.current?.disconnect();
    if (!element) return;

    let tallest = 0;
    const hold = () => {
      if (element.offsetHeight > tallest) {
        tallest = element.offsetHeight;
        element.style.minHeight = `${tallest}px`;
      }
    };
    hold();
    sizeWatcher.current = new ResizeObserver(hold);
    sizeWatcher.current.observe(element);
  }, []);

  const dateField = form.register("occurredOn");
  const dateInput = useRef<HTMLInputElement | null>(null);
  const categoryId = form.watch("categoryId");
  const today = isoDate(new Date());
  const yesterday = isoDate(subDays(new Date(), 1));
  const otherDay = !!occurredOn && occurredOn !== today && occurredOn !== yesterday;

  const typedCents = parseAmountToCents(form.watch("amount") ?? "");
  const typed =
    typedCents !== null && typedCents > 0 ? formatCents(typedCents, "EUR") : null;
  const submitLabel = isEditing
    ? "Save changes"
    : direction === "move"
      ? typed
        ? `Move ${typed}`
        : "Move the money"
      : typed
        ? `Add ${typed}`
        : "Add transaction";

  async function submit(values: FormValues) {
    setFormError(null);

    const magnitude = parseAmountToCents(values.amount)!;
    const description = values.description || null;

    const response =
      values.direction === "move"
        ? await sendJson("/api/v1/transfers", "POST", {
            fromAccountId: values.accountId,
            toAccountId: values.toAccountId,
            // positive, the API creates the negative leg
            amountCents: magnitude,
            occurredOn: values.occurredOn,
            description,
          })
        : await sendJson(
            isEditing ? `/api/v1/transactions/${transaction.id}` : "/api/v1/transactions",
            isEditing ? "PATCH" : "POST",
            {
              accountId: values.accountId,
              categoryId: values.categoryId === NONE ? null : values.categoryId,
              type: values.direction === "in" ? "income" : "expense",
              amountCents: values.direction === "in" ? magnitude : -magnitude,
              occurredOn: values.occurredOn,
              description,
            },
          );

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setFormError(
        payload?.error?.message ?? "That did not save. Check the details and try again.",
      );
      return;
    }

    setOpen(false);
    if (!isEditing) {
      form.reset({ ...values, amount: "", description: "", categoryId: NONE });
    }
    router.refresh();
  }

  async function remove() {
    if (!transaction) return;

    setIsDeleting(true);
    const response = await fetch(`/api/v1/transactions/${transaction.id}`, {
      method: "DELETE",
    });
    setIsDeleting(false);

    if (!response.ok) {
      setFormError("That could not be deleted. Try again.");
      setConfirmingDelete(false);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  // categories for the current direction, "Other" last
  const visibleCategories = categories
    .filter((category) =>
      direction === "in"
        ? category.kind === "income"
        : category.kind === "expense",
    )
    .sort(
      (a, b) =>
        Number(a.name === "Other") - Number(b.name === "Other") ||
        a.name.localeCompare(b.name),
    );

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {isControlled ? null : (
        <DialogTrigger
          render={
            <Button className="h-11">
              <Plus data-icon="inline-start" />
              Add transaction
            </Button>
          }
        />
      )}

      <DialogContent className="max-h-svh gap-5 overflow-y-auto p-6 sm:max-w-xl max-sm:top-0 max-sm:left-0 max-sm:flex max-sm:h-svh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:flex-col max-sm:rounded-none max-sm:p-5">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit transaction" : "Add a transaction"}
          </DialogTitle>
          <DialogDescription>
            {isTransfer
              ? "Transfers move money between your own accounts."
              : "Record something you spent or received."}
          </DialogDescription>
        </DialogHeader>

        {formError ? (
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        {isTransfer ? (
          <>
            <Alert>
              <AlertTitle>A transfer cannot be edited here</AlertTitle>
              <AlertDescription>
                To change a transfer, delete it and add it again. Both sides
                are deleted together.
              </AlertDescription>
            </Alert>

            <DialogFooter className="mt-2">
              <DeleteControls
                confirming={confirmingDelete}
                isDeleting={isDeleting}
                label="Delete both sides"
                onAsk={() => setConfirmingDelete(true)}
                onCancel={() => setConfirmingDelete(false)}
                onConfirm={remove}
              />
            </DialogFooter>
          </>
        ) : (
          <form
            ref={formRef}
            onSubmit={form.handleSubmit(submit)}
            noValidate
            className="flex flex-col max-sm:flex-1"
          >
            <div className="flex flex-col gap-3 sm:gap-5">
              <ToggleGroup
                aria-label="What happened?"
                value={[direction]}
                onValueChange={(value) => {
                  const next = value[0];
                  if (next !== "in" && next !== "out" && next !== "move") {
                    return;
                  }
                  form.setValue("direction", next);
                  form.setValue("categoryId", NONE);
                }}
                spacing={0}
                className="grid w-full grid-cols-3 rounded-full bg-muted p-1"
              >
                {(
                  [
                    ["out", "I spent"],
                    ["in", "I received"],
                    ["move", "I moved"],
                  ] as const
                ).map(([value, label]) => (
                  <ToggleGroupItem
                    key={value}
                    value={value}
                    // can't turn a transfer into a single transaction
                    disabled={isEditing && value === "move"}
                    className="h-12 rounded-full! border-0 text-base font-medium text-muted-foreground data-[pressed]:bg-background data-[pressed]:text-foreground data-[pressed]:shadow-sm"
                  >
                    {label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <div className="flex flex-col items-center gap-1">
                <label htmlFor="amount" className="sr-only">
                  Amount
                </label>
                <div className="flex items-baseline justify-center gap-1">
                  <span
                    className="text-4xl font-semibold text-muted-foreground sm:text-5xl"
                    aria-hidden
                  >
                    €
                  </span>
                  <input
                    id="amount"
                    inputMode="decimal"
                    autoComplete="off"
                    autoFocus={!isEditing}
                    placeholder="0.00"
                    aria-invalid={!!form.formState.errors.amount}
                    className="min-w-[3ch] bg-transparent text-left text-5xl font-semibold tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/50 field-sizing-content sm:text-6xl"
                    {...form.register("amount")}
                  />
                </div>
                {/* fixed height so errors don't shift the layout */}
                <p
                  className={cn(
                    "min-h-6 text-center text-base",
                    form.formState.errors.amount
                      ? "text-negative"
                      : "text-muted-foreground",
                  )}
                  role={form.formState.errors.amount ? "alert" : undefined}
                >
                  {form.formState.errors.amount?.message ??
                    (direction === "move"
                      ? "Not counted as spending or income."
                      : "")}
                </p>
              </div>

              {direction === "move" ? (
                <div className="divide-y rounded-2xl bg-muted/60">
                  <Row icon={ArrowUpRight} label="From" htmlFor="accountId">
                    <AccountSelect
                      id="accountId"
                      accounts={accounts}
                      value={form.watch("accountId")}
                      onChange={(value) => form.setValue("accountId", value)}
                    />
                  </Row>
                  <Row icon={ArrowDownLeft} label="To" htmlFor="toAccountId">
                    <AccountSelect
                      id="toAccountId"
                      accounts={accounts}
                      value={form.watch("toAccountId")}
                      onChange={(value) => form.setValue("toAccountId", value)}
                    />
                  </Row>
                  {form.formState.errors.toAccountId ? (
                    <p className="px-4 py-2 text-base text-negative" role="alert">
                      {form.formState.errors.toAccountId.message}
                    </p>
                  ) : null}
                </div>
              ) : (
                <fieldset className="flex flex-col">
                  <legend className="mb-2 text-base font-medium">
                    Category
                  </legend>
                  <div className="grid grid-cols-4 gap-1 sm:grid-cols-5">
                    {visibleCategories.map((category) => {
                      const chosen = categoryId === category.id;
                      return (
                        <button
                          key={category.id}
                          type="button"
                          aria-pressed={chosen}
                          onClick={() =>
                            form.setValue(
                              "categoryId",
                              chosen ? NONE : category.id,
                            )
                          }
                          className={cn(
                            "flex h-[5.5rem] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl px-1 text-center transition-colors duration-150",
                            chosen ? "bg-muted" : "hover:bg-muted/60",
                          )}
                        >
                          <CategoryIcon
                            category={category.name}
                            color={category.color ?? null}
                            solid={chosen}
                            className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
                          />
                          <span
                            className={cn(
                              "w-full truncate text-sm",
                              chosen
                                ? "font-semibold"
                                : "text-muted-foreground",
                            )}
                          >
                            {category.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              <div className="divide-y rounded-2xl bg-muted/60">
                <Row icon={CalendarDays} label="Date" htmlFor="occurredOn">
                  <div className="flex items-center gap-1.5">
                    {(
                      [
                        [today, "Today"],
                        [yesterday, "Yesterday"],
                      ] as const
                    ).map(([value, label]) => (
                      <DateChip
                        key={label}
                        pressed={occurredOn === value}
                        onClick={() => form.setValue("occurredOn", value)}
                      >
                        {label}
                      </DateChip>
                    ))}
                    <DateChip
                      pressed={otherDay}
                      aria-label={otherDay ? undefined : "Pick another day"}
                      onClick={() => dateInput.current?.showPicker?.()}
                    >
                      {otherDay ? (
                        formatDay(occurredOn)
                      ) : (
                        <CalendarDays className="size-5" aria-hidden />
                      )}
                    </DateChip>
                    <input
                      id="occurredOn"
                      type="date"
                      tabIndex={-1}
                      className="sr-only"
                      {...dateField}
                      ref={(element) => {
                        dateField.ref(element);
                        dateInput.current = element;
                      }}
                    />
                  </div>
                </Row>

                {direction === "move" ? null : (
                  <Row icon={Landmark} label="Account" htmlFor="accountId">
                    <AccountSelect
                      id="accountId"
                      accounts={accounts}
                      value={form.watch("accountId")}
                      onChange={(value) => form.setValue("accountId", value)}
                    />
                  </Row>
                )}

                <Row icon={PenLine} label="Note" htmlFor="description">
                  <input
                    id="description"
                    autoComplete="off"
                    placeholder="Add a note"
                    className="h-12 w-full min-w-0 bg-transparent text-right text-base outline-none placeholder:text-muted-foreground"
                    {...form.register("description")}
                  />
                </Row>
              </div>
            </div>

            <DialogFooter className="mt-auto flex-col gap-2 pt-4 sm:flex-col">
              {confirmingDelete ? null : (
                <Button
                  type="submit"
                  className="h-14 w-full rounded-full text-lg"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <Spinner data-icon="inline-start" />
                  ) : null}
                  {submitLabel}
                </Button>
              )}

              {isEditing ? (
                <DeleteControls
                  confirming={confirmingDelete}
                  isDeleting={isDeleting}
                  label="Delete"
                  onAsk={() => setConfirmingDelete(true)}
                  onCancel={() => setConfirmingDelete(false)}
                  onConfirm={remove}
                />
              ) : null}
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({
  icon: Icon,
  label,
  htmlFor,
  children,
}: {
  icon: typeof Plus;
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 sm:min-h-16">
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <label htmlFor={htmlFor} className="shrink-0 text-base font-medium">
        {label}
      </label>
      <div className="flex min-w-0 flex-1 justify-end">{children}</div>
    </div>
  );
}

function DateChip({
  pressed,
  children,
  ...props
}: {
  pressed: boolean;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type">) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-full px-3.5 text-base font-medium transition-colors duration-150",
        pressed
          ? "bg-primary text-primary-foreground"
          : "bg-background text-foreground hover:bg-background/70",
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function AccountSelect({
  id,
  accounts,
  value,
  onChange,
}: {
  id: string;
  accounts: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <OptionSelect
      id={id}
      value={value}
      onChange={onChange}
      placeholder="Choose an account"
      options={accounts.map((account) => ({ value: account.id, label: account.name }))}
      className="h-12 w-auto max-w-full gap-1 border-0 bg-transparent! px-0 text-base shadow-none focus-visible:ring-0 dark:bg-transparent!"
    />
  );
}

// Delete asks for confirmation inline instead of opening another dialog.
function DeleteControls({
  confirming,
  isDeleting,
  label,
  onAsk,
  onCancel,
  onConfirm,
}: {
  confirming: boolean;
  isDeleting: boolean;
  label: string;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!confirming) {
    return (
      <Button type="button" variant="ghost" className="h-11" onClick={onAsk}>
        <Trash2 data-icon="inline-start" />
        {label}
      </Button>
    );
  }

  return (
    <div className="flex flex-1 items-center gap-2" aria-live="polite">
      <p className="flex-1 text-sm">Delete this for good?</p>
      <Button type="button" variant="ghost" className="h-11" onClick={onCancel}>
        Keep it
      </Button>
      <Button
        type="button"
        variant="destructive"
        className="h-11"
        disabled={isDeleting}
        onClick={onConfirm}
      >
        {isDeleting ? <Spinner data-icon="inline-start" /> : null}
        Delete
      </Button>
    </div>
  );
}
