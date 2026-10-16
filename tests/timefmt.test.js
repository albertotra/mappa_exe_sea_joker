import test from "node:test";
import assert from "node:assert/strict";
import { toLocalInput, fromLocalInput, fmtTime } from "../js/timefmt.js";

test("toLocalInput / fromLocalInput round trip to the minute", () => {
  const ts = Date.UTC(2026, 9, 16, 21, 30, 0);
  assert.equal(fromLocalInput(toLocalInput(ts)), ts);
  assert.match(toLocalInput(ts), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});

test("fromLocalInput rejects garbage with NaN", () => {
  assert.ok(Number.isNaN(fromLocalInput("")));
  assert.ok(Number.isNaN(fromLocalInput("boh")));
});

test("fmtTime handles missing values", () => {
  assert.equal(fmtTime(undefined), "—");
  assert.match(fmtTime(Date.now()), /\d{2}:\d{2}/);
});
