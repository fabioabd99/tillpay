"use client";

import {
  ChevronsUpDown,
  LogOut,
  Monitor,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

function initials(name: string, email: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words.at(-1)![0]}`.toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export function UserMenu({
  name,
  email,
  isDemo,
}: {
  name: string;
  email: string;
  isDemo: boolean;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { isMobile } = useSidebar();
  const [isSigningOut, startSignOut] = useTransition();

  async function signOut() {
    await authClient.signOut();
    startSignOut(() => {
      router.push("/sign-in");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            className="h-12 gap-2.5 rounded-lg px-2 hover:bg-sidebar-accent data-popup-open:bg-sidebar-accent"
            aria-label="Account menu"
          />
        }
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials(name, email)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">{name}</span>
            {isDemo ? (
              <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-px text-[0.6875rem] font-semibold text-primary">
                Demo
              </span>
            ) : null}
          </span>
          <span className="truncate text-xs text-muted-foreground">{email}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side={isMobile ? "top" : "right"}
        align="end"
        sideOffset={isMobile ? 8 : 20}
        className="min-w-60 p-1.5"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5">
            <span className="block truncate text-sm font-semibold text-foreground">
              {name}
            </span>
            <span className="block truncate font-normal">{email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2">Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
            {(
              [
                ["light", Sun, "Light"],
                ["dark", Moon, "Dark"],
                ["system", Monitor, "Same as this device"],
              ] as const
            ).map(([value, Icon, label]) => (
              <DropdownMenuRadioItem key={value} value={value} className="h-9 gap-2 px-2 text-sm">
                <Icon />
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="h-9 gap-2 px-2 text-sm"
          disabled={isSigningOut}
          onClick={() => void signOut()}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
