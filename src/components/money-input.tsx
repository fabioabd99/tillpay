import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Amount field with a € in front.
export function MoneyInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      >
        €
      </span>
      <Input
        inputMode="decimal"
        autoComplete="off"
        className={cn("h-11 pl-7 tabular-nums", className)}
        {...props}
      />
    </div>
  );
}
