import test from "node:test";
import assert from "node:assert/strict";
import { buildReport } from "../js/report.js";

const events = {
  e1: { safehouse: "SAFEHOUSE 2", faction: "REDFOR", black: 1, yellow: 2, ts: 1000, note: "ok" },
  e2: { safehouse: "SAFEHOUSE 10", faction: "BLUFOR", black: 0, yellow: 3, ts: 3000 },
  e3: { safehouse: "SAFEHOUSE 2", faction: "BLUFOR", black: 2, yellow: 0, ts: 2000 },
  bad: { safehouse: "", faction: "REDFOR", black: 1, yellow: 1, ts: 5 }
};
const objectives = {
  b: { name: "LAGO", lat: 45.0, lon: 9.0, side: "BLUFOR", captures: {
    c1: { faction: "REDFOR", squad: "A1", ts: 100 }, c2: { faction: "BLUFOR", squad: "B2", ts: 200 } } },
  a: { name: "CASTELLO", lat: 45.1, lon: 9.1, side: "REDFOR" },
  bogus: null
};

test("medevac log: valid events only, newest first, with total", () => {
  const r = buildReport({ events, objectives });
  assert.deepEqual(r.medevacLog.map((x) => x.ts.getTime()), [3000, 2000, 1000]);
  assert.deepEqual(r.medevacLog[2], { ts: new Date(1000), safehouse: "SAFEHOUSE 2", faction: "REDFOR", black: 1, yellow: 2, total: 3, note: "ok" });
  assert.equal(r.medevacLog[0].note, "");
});

test("summary totals per faction and grand total", () => {
  const r = buildReport({ events, objectives });
  assert.deepEqual(r.summary.medevac.find((x) => x.faction === "BLUFOR"), { faction: "BLUFOR", black: 2, yellow: 3, total: 5 });
  assert.deepEqual(r.summary.medevacTotal, { black: 3, yellow: 5, total: 8 });
});

test("by safehouse: natural order, per-faction black/yellow", () => {
  const r = buildReport({ events, objectives });
  assert.deepEqual(r.bySafehouse.map((x) => x.safehouse), ["SAFEHOUSE 2", "SAFEHOUSE 10"]);
  assert.deepEqual(r.bySafehouse[0], { safehouse: "SAFEHOUSE 2", REDFOR: { black: 1, yellow: 2 }, BLUFOR: { black: 2, yellow: 0 }, NEUTRALE: { black: 0, yellow: 0 }, black: 3, yellow: 2, total: 5 });
});

test("objectives: capture rows newest first, uncaptured row is LIBERO, sorted by name", () => {
  const r = buildReport({ events, objectives });
  assert.deepEqual(r.objectives.map((x) => [x.name, x.faction, x.squad]), [["CASTELLO", "LIBERO", ""], ["LAGO", "BLUFOR", "B2"], ["LAGO", "REDFOR", "A1"]]);
  const lago = r.objectives[1];
  assert.equal(lago.ts.getTime(), 200);
  assert.equal(lago.side, "BLUFOR");
  assert.match(lago.mgrs, /^\d{2}[C-X][A-Z]{2}\d{10}$/);
  assert.equal(r.objectives[0].ts, null);
});

test("summary objectives: current owner, capture count, holdings", () => {
  const r = buildReport({ events, objectives });
  assert.deepEqual(r.summary.objectives.map((x) => [x.name, x.owner, x.squad, x.captures]), [["CASTELLO", "LIBERO", "", 0], ["LAGO", "BLUFOR", "B2", 2]]);
  assert.deepEqual(r.summary.holdings, { REDFOR: 0, BLUFOR: 1, NEUTRALE: 0, LIBERO: 1 });
});

test("empty input", () => {
  const r = buildReport({ events: {}, objectives: {} });
  assert.deepEqual([r.medevacLog, r.bySafehouse, r.objectives, r.summary.objectives], [[], [], [], []]);
  assert.equal(r.summary.medevacTotal.total, 0);
});
