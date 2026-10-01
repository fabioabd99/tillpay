import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Labelled input with its error, or a hint while there is none.
export function TextField({
  id,
  label,
  error,
  hint,
  className,
  ...props
}: React.ComponentProps<typeof Input> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}) {
  const message = error ?? hint;

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} className={cn("h-11", className)} aria-invalid={!!error} {...props} />
      {message ? <FieldDescription>{message}</FieldDescription> : null}
    </Field>
  );
}
