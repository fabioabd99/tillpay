import { authBaseUrl } from "@/lib/env";

export const SITE_NAME = "Tillpay";

export const SITE_TITLE = "Tillpay: know what you can spend until payday";

export const SITE_DESCRIPTION =
  "A personal finance app that tells you how much you can safely spend until your next payday. Track accounts, spending by category, budgets and repeating bills, or try the demo without signing up.";

// --primary as hex
export const BRAND_COLOR = "#2653c1";

// NEXT_PUBLIC_SITE_URL, then the auth URL (or Vercel's production URL), then localhost.
export function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || authBaseUrl() || "http://localhost:3000";
}
