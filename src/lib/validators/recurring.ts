import { z } from "zod";

export const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;

export const FREQUENCY_LABELS: Record<(typeof FREQUENCIES)[number], string> = {
  daily: "Every day",
  weekly: "Every week",
  monthly: "Every month",
  yearly: "Every year",
};

export const recurringRuleInputSchema = z
  .object({
    accountId: z.uuid("Choose an account"),
    categoryId: z.uuid().nullable().default(null),
    description: z.string().trim().min(1, "Give it a name, like Rent").max(200),
    type: z.enum(["income", "expense"]),
    amountCents: z
      .number()
      .int()
      .refine((value) => value !== 0, { message: "Enter an amount, like 12.50" }),
    frequency: z.enum(FREQUENCIES),
    interval: z.number().int().min(1).max(52).default(1),
    dayOfMonth: z
      .number()
      .int()
      .min(1, "Enter a day from 1 to 31")
      .max(31, "Enter a day from 1 to 31")
      .nullable()
      .default(null),
    weekday: z.number().int().min(0).max(6).nullable().default(null),
    startsOn: z.iso.date(),
    endsOn: z.iso.date().nullable().default(null),
    isSalary: z.boolean().default(false),
  })
  .refine(
    (value) =>
      value.type === "income" ? value.amountCents > 0 : value.amountCents < 0,
    {
      message: "Income must be positive and spending negative",
      path: ["amountCents"],
    },
  )
  .refine((value) => !value.isSalary || value.type === "income", {
    message: "Only money coming in can be a salary",
    path: ["isSalary"],
  })
  .refine((value) => !value.endsOn || value.endsOn >= value.startsOn, {
    message: "The end date cannot be before the start",
    path: ["endsOn"],
  });

export type RecurringRuleInput = z.infer<typeof recurringRuleInputSchema>;
