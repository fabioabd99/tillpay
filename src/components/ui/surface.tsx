import { cn } from "@/lib/utils";

// Card surface used across the app: soft shadow in light mode, 1px ring in dark.
export function Surface({
  as: Component = "div",
  className,
  children,
  ...props
}: {
  as?: "div" | "section" | "article" | "li" | "ul" | "p";
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Component
      className={cn(
        "rounded-3xl bg-card",
        "shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.10)]",
        "dark:bg-white/[0.04] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-base text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}
