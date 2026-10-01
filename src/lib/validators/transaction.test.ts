import { describe, expect, test } from "vitest";

import { parseTransactionFilters } from "./transaction";

const UUID_A = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("parseTransactionFilters", () => {
  test("applies defaults when nothing is given", () => {
    expect(parseTransactionFilters({})).toMatchObject({
      uncategorised: false,
      sort: "occurredOn",
      dir: "desc",
      page: 1,
      pageSize: 25,
    });
  });

  test("one invalid field does not discard the others", () => {
    const filters = parseTransactionFilters({ type: "income", pageSize: "2" });

    expect(filters.type).toBe("income");
    expect(filters.pageSize).toBe(25);
  });

  test("keeps a valid page size", () => {
    expect(parseTransactionFilters({ pageSize: "50" }).pageSize).toBe(50);
  });

  test("reads an account id", () => {
    expect(parseTransactionFilters({ accountId: UUID_A }).accountId).toBe(UUID_A);
  });

  test("drops ids that are not uuids without dropping other filters", () => {
    const filters = parseTransactionFilters({
      accountId: "not-a-uuid",
      type: "expense",
    });

    expect(filters.accountId).toBeUndefined();
    expect(filters.type).toBe("expense");
  });

  test("treats the string 'false' as false", () => {
    expect(parseTransactionFilters({ uncategorised: "false" }).uncategorised).toBe(
      false,
    );
  });

  test("treats the string 'true' as true", () => {
    expect(parseTransactionFilters({ uncategorised: "true" }).uncategorised).toBe(
      true,
    );
  });

  test("rejects an unknown sort field", () => {
    expect(parseTransactionFilters({ sort: "userId" }).sort).toBe("occurredOn");
  });

  test("rejects a page below one", () => {
    expect(parseTransactionFilters({ page: "0" }).page).toBe(1);
  });

  test("ignores a malformed date without losing the other bound", () => {
    const filters = parseTransactionFilters({
      from: "31-12-2026",
      to: "2026-12-31",
    });

    expect(filters.from).toBeUndefined();
    expect(filters.to).toBe("2026-12-31");
  });
});
