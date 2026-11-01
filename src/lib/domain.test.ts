// Weeks run Sunday to Saturday across the app. Run with `pnpm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { monthGrid, weekdayIndex, WEEKDAY_SHORT, weekStart } from "./domain";

describe("weeks", () => {
  it("number Sunday 0 to Saturday 6", () => {
    assert.equal(WEEKDAY_SHORT[weekdayIndex("2026-11-01")], "CN");
    assert.equal(WEEKDAY_SHORT[weekdayIndex("2026-11-02")], "T2");
    assert.equal(WEEKDAY_SHORT[weekdayIndex("2026-11-07")], "T7");
  });

  it("start on the Sunday on or before the day", () => {
    assert.equal(weekStart("2026-11-01"), "2026-11-01"); // Sunday
    assert.equal(weekStart("2026-11-07"), "2026-11-01"); // Saturday, same week
    assert.equal(weekStart("2026-11-08"), "2026-11-08"); // next Sunday starts a new week
    assert.equal(weekStart("2027-01-01"), "2026-12-27"); // across a year
  });

  it("lay out a month in Sunday-to-Saturday rows", () => {
    const weeks = monthGrid("2026-12");
    assert.deepEqual(weeks[0].slice(0, 2), ["2026-11-29", "2026-11-30"]);
    for (const week of weeks) {
      assert.equal(weekdayIndex(week[0]), 0);
      assert.equal(weekdayIndex(week[6]), 6);
    }
    assert.ok(weeks.at(-1)!.includes("2026-12-31"));
  });
});
