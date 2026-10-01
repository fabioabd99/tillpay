import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { SURFACE } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

// Home page card: coloured icon + title, optional note on the right, and the
// whole card is a link when href is set.
export function Tile({
  title,
  icon: Icon,
  tone = "text-primary",
  aside,
  href,
  className,
  children,
}: {
  title: string;
  icon: LucideIcon;
  tone?: string;
  aside?: React.ReactNode;
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const body = (
    <>
      <div className="flex min-h-6 items-center gap-3">
        <h2 className={cn("flex items-center gap-2 text-[0.9375rem] font-semibold", tone)}>
          <Icon className="size-[1.125rem]" strokeWidth={2.25} aria-hidden />
          {title}
        </h2>
        <span className="ml-auto flex items-center gap-1 text-sm text-muted-foreground">
          {aside}
          {href ? (
            <ChevronRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
          ) : null}
        </span>
      </div>
      <div className="mt-4 flex flex-1 flex-col">{children}</div>
    </>
  );

  const shell = cn(
    SURFACE,
    "group flex flex-col p-6 transition-colors duration-200",
    href && "cursor-pointer hover:bg-muted/40 dark:hover:bg-white/[0.07]",
    className,
  );

  return href ? (
    <Link href={href} className={shell}>
      {body}
    </Link>
  ) : (
    <section className={shell}>{body}</section>
  );
}

export function TileHeadline({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-3xl font-semibold leading-tight tracking-tight tabular-nums",
        className,
      )}
    >
      {children}
    </p>
  );
}
