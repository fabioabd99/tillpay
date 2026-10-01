import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { isoDate } from "@/lib/dates";
import { apiError } from "@/server/api";
import { removeExpiredDemos } from "@/server/demo-accounts";
import {
  generateDueTransactions,
  listUsersWithDueRules,
} from "@/server/queries/recurring";

// Daily cron: generates due recurring transactions and deletes expired demo
// users. Vercel Cron sends GET, POST is for manual runs. Protected by
// CRON_SECRET (constant-time compare). Idempotent.
function authorised(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);

  return header.length === expected.length && timingSafeEqual(header, expected);
}

async function run(request: NextRequest) {
  if (!authorised(request)) return apiError("unauthorized", "Not allowed.");

  const until = isoDate(new Date());
  const userIds = await listUsersWithDueRules(until);

  let created = 0;
  let rulesRun = 0;

  for (const userId of userIds) {
    const result = await generateDueTransactions(userId, until);
    created += result.created;
    rulesRun += result.rulesRun;
  }

  const demosRemoved = await removeExpiredDemos();

  return NextResponse.json({
    data: { users: userIds.length, rulesRun, created, until, demosRemoved },
  });
}

export const GET = run;
export const POST = run;
