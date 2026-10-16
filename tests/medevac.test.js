import test from "node:test";
import assert from "node:assert/strict";
import { validateMedevac, medevacTotals, medevacBySafehouse, sortedEvents } from "../js/medevac.js";

const now = 1_700_000_000_000;
const ok = { safehouse: "SAFEHOUSE 3", faction: "REDFOR", black: 1, yellow: 2, ts: now, note: " x " };

test("validateMedevac accepts a valid event and normalises it", () => {
  const r = validateMedevac(ok, now);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { safehouse: "SAFEHOUSE 3", faction: "REDFOR", black: 1, yellow: 2, ts: now, note: "x" });
});

test("validateMedevac: numeric strings and empty string as zero", () => {
  const r = validateMedevac({ ...ok, black: "", yellow: "3" }, now);
  assert.equal(r.ok, true);
  assert.equal(r.value.black, 0);
  assert.equal(r.value.yellow, 3);
});

test("validateMedevac rejects bad counts", () => {
  for (const bad of ["-1", "2.5", "abc", 100, -1, NaN, 1.5]) {
    const r = validateMedevac({ ...ok, black: bad, yellow: 1 }, now);
    assert.equal(r.ok, false, String(bad));
    assert.ok(r.error.length > 0);
  }
  assert.equal(validateMedevac({ ...ok, black: 0, yellow: 0 }, now).ok, false);
  assert.equal(validateMedevac({ ...ok, black: "", yellow: "" }, now).ok, false);
});

test("validateMedevac rejects bad faction, empty safehouse and far-future time", () => {
  assert.equal(validateMedevac({ ...ok, faction: "ROSSI" }, now).ok, false);
  assert.equal(validateMedevac({ ...ok, safehouse: "  " }, now).ok, false);
  assert.equal(validateMedevac({ ...ok, ts: now + 25 * 3600e3 }, now).ok, false);
  assert.equal(validateMedevac({ ...ok, ts: NaN }, now).ok, false);
  assert.equal(validateMedevac({ ...ok, ts: now + 3600e3 }, now).ok, true);
});

const events = {
  a: { safehouse: "SAFEHOUSE 1", faction: "REDFOR", black: 1, yellow: 2, ts: 10 },
  b: { safehouse: "SAFEHOUSE 1", faction: "BLUFOR", black: 0, yellow: 3, ts: 30 },
  c: { safehouse: "SAFEHOUSE 2", faction: "REDFOR", black: 2, yellow: 0, ts: 20 },
  broken1: { safehouse: "SAFEHOUSE 2", faction: "REDFOR", black: "x", yellow: 1, ts: 5 },
  broken2: null,
  broken3: { faction: "BLUFOR", black: 1, yellow: 1, ts: 1 }
};

test("medevacTotals per faction, malformed events ignored, all factions present", () => {
  const t = medevacTotals(events);
  assert.deepEqual(t.REDFOR, { black: 3, yellow: 2, total: 5 });
  assert.deepEqual(t.BLUFOR, { black: 0, yellow: 3, total: 3 });
  assert.deepEqual(t.NEUTRALE, { black: 0, yellow: 0, total: 0 });
  assert.deepEqual(medevacTotals(undefined).REDFOR, { black: 0, yellow: 0, total: 0 });
});

test("medevacBySafehouse groups and sorts by name", () => {
  const rows = medevacBySafehouse(events);
  assert.deepEqual(rows.map((r) => r.safehouse), ["SAFEHOUSE 1", "SAFEHOUSE 2"]);
  assert.deepEqual(rows[0].byFaction.REDFOR, { black: 1, yellow: 2 });
  assert.deepEqual(rows[0].byFaction.BLUFOR, { black: 0, yellow: 3 });
  assert.equal(rows[0].black, 1);
  assert.equal(rows[0].yellow, 5);
});

test("sortedEvents: newest first, with ids, skipping non-objects", () => {
  assert.deepEqual(sortedEvents(events).slice(0, 3).map((e) => e.id), ["b", "c", "a"]);
});
