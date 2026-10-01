import { NextResponse } from "next/server";
import type { z, ZodError } from "zod";

import { getSession } from "@/server/auth-context";
import { checkRateLimit } from "@/server/rate-limit";

// Error shape: { error: { code, message, fields? } }
export type ApiErrorCode =
  | "unauthorized"
  | "not_found"
  | "validation_failed"
  | "conflict"
  | "rate_limited";

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  not_found: 404,
  validation_failed: 400,
  conflict: 409,
  rate_limited: 429,
};

export function apiError(
  code: ApiErrorCode,
  message: string,
  fields?: Record<string, string[]>,
) {
  return NextResponse.json(
    { error: { code, message, ...(fields ? { fields } : {}) } },
    { status: STATUS[code] },
  );
}

export function validationError(error: ZodError) {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (fields[key] ??= []).push(issue.message);
  }

  return apiError("validation_failed", "Check the highlighted fields.", fields);
}

// JSON body checked against a schema: the data, or the 400 to send back.
export async function parseBody<S extends z.ZodType>(request: Request, schema: S) {
  const parsed = schema.safeParse(await request.json().catch(() => null));

  return parsed.success
    ? { body: parsed.data as z.output<S>, invalid: null }
    : { body: null, invalid: validationError(parsed.error) };
}

// 401 instead of a redirect for API routes. Returns the user or the response.
export async function requireApiUser() {
  const session = await getSession();

  if (!session) {
    return { user: null, response: apiError("unauthorized", "Sign in first.") };
  }

  return { user: session.user, response: null };
}

// requireApiUser + write rate limit.
export async function requireApiUserForWrite() {
  const result = await requireApiUser();
  if (!result.user) return result;

  const limit = await checkRateLimit(`write:${result.user.id}`);

  if (!limit.allowed) {
    const response = apiError(
      "rate_limited",
      "That is a lot of changes at once. Try again in a moment.",
    );
    response.headers.set("Retry-After", String(limit.retryAfterSeconds));

    return { user: null, response };
  }

  return result;
}

// 404 for both "missing" and "not yours", so ids can't be probed.
export function notFound() {
  return apiError("not_found", "Not found.");
}
