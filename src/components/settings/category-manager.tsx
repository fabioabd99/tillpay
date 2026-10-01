"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { CategoryIcon } from "@/components/category-icon";
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatCents } from "@/lib/money";
import { sendJson } from "@/lib/send-json";
import { cn } from "@/lib/utils";
import { CATEGORY_COLORS, CATEGORY_KINDS } from "@/lib/validators/category";
import type { CategoryListRow } from "@/server/queries/categories";

const formSchema = z.object({
  name: z.string().trim().min(1, "Give the category a name").max(60),
  kind: z.enum(CATEGORY_KINDS),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

type FormValues = z.infer<typeof formSchema>;

export function CategoryManager({
  categories,
}: {
  categories: CategoryListRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CategoryListRow | null>(null);
  const [adding, setAdding] = useState(false);

  async function toggleHidden(category: CategoryListRow) {
    await sendJson(`/api/v1/categories/${category.id}`, "PUT", { hidden: !category.archivedAt });
    router.refresh();
  }

  const groups = [
    { kind: "expense" as const, label: "Spending" },
    { kind: "income" as const, label: "Income" },
  ];

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Your categories
          </h2>
          <p className="text-sm text-muted-foreground">
            What your money goes on. These are what make the comparisons on the
            home screen possible.
          </p>
        </div>

        <Button className="h-11" onClick={() => setAdding(true)}>
          <Plus data-icon="inline-start" />
          Add category
        </Button>
      </header>

      {groups.map((group) => {
        const rows = categories.filter((row) => row.kind === group.kind);
        if (rows.length === 0) return null;

        return (
          <div key={group.kind} className="flex flex-col gap-2">
            <h3 className="px-1 text-sm font-medium text-muted-foreground">
              {group.label}
            </h3>

            <Surface as="ul" className="overflow-hidden">
              {rows.map((category) => (
                <li
                  key={category.id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 border-b px-4 py-2.5 last:border-b-0",
                    category.archivedAt && "opacity-60",
                  )}
                >
                  <CategoryIcon
                    category={category.name}
                    color={category.color}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium">
                      <span className="truncate">{category.name}</span>
                      {category.archivedAt ? (
                        <Badge variant="secondary">Hidden</Badge>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {category.transactionCount}{" "}
                      {category.transactionCount === 1
                        ? "transaction"
                        : "transactions"}
                    </p>
                  </div>

                  <span className="text-sm tabular-nums text-muted-foreground">
                    {formatCents(Math.abs(category.totalCents), "EUR")}
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      aria-label={`Edit ${category.name}`}
                      onClick={() => setEditing(category)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      aria-label={
                        category.archivedAt
                          ? `Show ${category.name} again`
                          : `Hide ${category.name}`
                      }
                      onClick={() => toggleHidden(category)}
                    >
                      {category.archivedAt ? <Eye /> : <EyeOff />}
                    </Button>
                  </div>
                </li>
              ))}
            </Surface>
          </div>
        );
      })}

      <p className="px-1 text-sm text-muted-foreground">
        Categories are hidden, never deleted. Deleting one would strip it off
        every past transaction and break every comparison against your history.
      </p>

      {adding ? (
        <CategoryDialog
          key="new"
          onDone={() => setAdding(false)}
          onSaved={() => router.refresh()}
        />
      ) : null}

      {editing ? (
        <CategoryDialog
          key={editing.id}
          category={editing}
          onDone={() => setEditing(null)}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </section>
  );
}

function CategoryDialog({
  category,
  onDone,
  onSaved,
}: {
  category?: CategoryListRow;
  onDone: () => void;
  onSaved: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: category
      ? {
          name: category.name,
          kind: category.kind,
          color: category.color ?? CATEGORY_COLORS[0],
        }
      : { name: "", kind: "expense", color: CATEGORY_COLORS[0] },
  });

  const kind = form.watch("kind");
  const color = form.watch("color");

  async function submit(values: FormValues) {
    setFormError(null);

    const response = await sendJson(
      category ? `/api/v1/categories/${category.id}` : "/api/v1/categories",
      category ? "PATCH" : "POST",
      values,
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setFormError(payload?.error?.message ?? "That did not save.");
      return;
    }

    onDone();
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onDone()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {category ? "Edit category" : "Add a category"}
          </DialogTitle>
          <DialogDescription>
            Categories group your transactions so you can see where the money
            goes.
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

            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="category-name">Name</FieldLabel>
              <Input
                id="category-name"
                className="h-11"
                placeholder="Groceries"
                aria-invalid={!!form.formState.errors.name}
                {...form.register("name")}
              />
              {form.formState.errors.name ? (
                <FieldDescription>
                  {form.formState.errors.name.message}
                </FieldDescription>
              ) : null}
            </Field>

            <Field>
              <FieldLabel>Used for</FieldLabel>
              <ToggleGroup
                value={[kind]}
                onValueChange={(value) => {
                  const next = value[0];
                  if (next === "income" || next === "expense") {
                    form.setValue("kind", next);
                  }
                }}
                className="grid grid-cols-2"
              >
                <ToggleGroupItem value="expense" className="h-11">
                  Money out
                </ToggleGroupItem>
                <ToggleGroupItem value="income" className="h-11">
                  Money in
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>

            <Field>
              <FieldLabel>Colour</FieldLabel>
              <div
                role="radiogroup"
                aria-label="Category colour"
                className="flex flex-wrap gap-2"
              >
                {CATEGORY_COLORS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={color === option}
                    aria-label={`Colour ${option}`}
                    onClick={() => form.setValue("color", option)}
                    className={cn(
                      "size-11 cursor-pointer rounded-full border-2 transition-colors",
                      color === option
                        ? "border-foreground"
                        : "border-transparent",
                    )}
                  >
                    <span
                      className="mx-auto block size-6 rounded-full"
                      style={{ backgroundColor: option }}
                    />
                  </button>
                ))}
              </div>
              <FieldDescription>
                Used for the category icon and in charts.
              </FieldDescription>
            </Field>
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
              {category ? "Save changes" : "Add category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
