"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { TextField } from "@/components/text-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { signUpSchema, type SignUpValues } from "@/lib/validators/auth";

export function SignUpForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isRedirecting, startRedirect] = useTransition();

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function submit(values: SignUpValues) {
    setFormError(null);

    const { error } = await authClient.signUp.email(values);

    if (error) {
      setFormError(error.message ?? "Something went wrong. Please try again.");
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
            <AlertTitle>Could not create the account</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <TextField
          id="name"
          label="Name"
          autoComplete="name"
          error={form.formState.errors.name?.message}
          {...form.register("name")}
        />

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
          autoComplete="new-password"
          hint="At least 10 characters. A short phrase works well."
          error={form.formState.errors.password?.message}
          {...form.register("password")}
        />

        <Button type="submit" className="h-11" disabled={isBusy}>
          {isBusy ? <Spinner data-icon="inline-start" /> : null}
          Create account
        </Button>
      </FieldGroup>
    </form>
  );
}
