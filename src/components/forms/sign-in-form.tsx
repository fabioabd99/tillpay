"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { TextField } from "@/components/text-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldSeparator } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { signInSchema, type SignInValues } from "@/lib/validators/auth";

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<{ title: string; message: string } | null>(
    null,
  );
  const [isRedirecting, startRedirect] = useTransition();

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  async function submit(values: SignInValues) {
    setFormError(null);

    const { error } = await authClient.signIn.email(values);

    if (error) {
      // generic on purpose, don't reveal which field was wrong
      setFormError({
        title: "Could not sign in",
        message: "That email and password combination did not work.",
      });
      return;
    }

    startRedirect(() => {
      router.push(next);
      router.refresh();
    });
  }

  const [isOpeningDemo, setIsOpeningDemo] = useState(false);

  async function openDemo() {
    setFormError(null);
    setIsOpeningDemo(true);

    const response = await fetch("/api/demo", { method: "POST" }).catch(
      () => null,
    );

    if (!response?.ok) {
      setIsOpeningDemo(false);
      const minutes = Math.max(
        1,
        Math.ceil(Number(response?.headers.get("Retry-After") ?? 0) / 60),
      );
      setFormError({
        title: "Demo not available",
        message:
          response?.status === 429
            ? `Too many demos opened from this connection. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`
            : "The demo could not be opened. Try again.",
      });
      return;
    }

    startRedirect(() => {
      router.push("/");
      router.refresh();
    });
  }

  const isBusy = form.formState.isSubmitting || isRedirecting;

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate>
      <FieldGroup>
        {formError ? (
          <Alert variant="destructive">
            <AlertTitle>{formError.title}</AlertTitle>
            <AlertDescription>{formError.message}</AlertDescription>
          </Alert>
        ) : null}

        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          spellCheck={false}
          autoCapitalize="none"
          placeholder="you@example.com"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />

        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          {...form.register("password")}
        />

        <Button type="submit" className="h-11" disabled={isBusy}>
          {isBusy ? <Spinner data-icon="inline-start" /> : null}
          Sign in
        </Button>

        <FieldSeparator>or</FieldSeparator>

        <Field>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={isBusy || isOpeningDemo}
            onClick={() => void openDemo()}
          >
            {isOpeningDemo ? <Spinner data-icon="inline-start" /> : null}
            Open the demo
          </Button>
          <FieldDescription>
            Your own copy of an account with a year of transactions, budgets
            and repeating payments. Change anything. No sign-up; it is removed
            after a day.
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
