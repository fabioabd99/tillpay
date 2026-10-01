import { describe, expect, it } from "vitest";

import { spendingSegments } from "./spending-segments";

// largest first with a running total, as getCategoryPace returns them
const rows = (...pairs: [string, number][]) => {
  let running = 0;
  return pairs.map(([id, cents]) => ({
    id,
    name: id,
    color: "#000000",
    thisMonthCents: cents,
    runningCents: (running += cents),
  }));
};

describe("spendingSegments", () => {
  it("keeps the first categories in the order given", () => {
    const segments = spendingSegments(rows(["a", 300], ["c", 200], ["b", 100]), 600, 2);

    expect(segments.map((s) => s.id)).toEqual(["a", "c", "other"]);
  });

  it("puts everything else, uncategorised included, into Other", () => {
    const segments = spendingSegments(rows(["a", 300], ["b", 200]), 700, 1);

    expect(segments.at(-1)).toEqual({ id: "other", name: "Other", color: null, cents: 400 });
  });

  it("has no Other segment when nothing is left over", () => {
    const segments = spendingSegments(rows(["a", 300], ["b", 200]), 500, 4);

    expect(segments.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("never returns a negative Other", () => {
    const segments = spendingSegments(rows(["a", 300]), 250, 4);

    expect(segments.map((s) => s.id)).toEqual(["a"]);
  });

  it("is all Other when there are no categories", () => {
    const segments = spendingSegments([], 100, 4);

    expect(segments.map((s) => s.id)).toEqual(["other"]);
  });
});
