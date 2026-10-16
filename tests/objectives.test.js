import test from "node:test";
import assert from "node:assert/strict";
import { validateObjective, validateCapture, sortedCaptures, currentOwner } from "../js/objectives.js";

const now = 1_700_000_000_000;

test("currentOwner: none, latest ts, tie broken by greater id, malformed ignored", () => {
  assert.equal(currentOwner({ name: "X" }), null);
  assert.equal(currentOwner({ captures: {} }), null);
  const o = { captures: {
    c1: { faction: "REDFOR", squad: "A", ts: 100 },
    c2: { faction: "BLUFOR", squad: "B", ts: 200 },
    c0: { faction: "NEUTRALE", squad: "C", ts: 50 },
    bad: { faction: "BLUFOR", ts: NaN },
    bad2: null
  } };
  assert.equal(currentOwner(o).faction, "BLUFOR");
  assert.equal(currentOwner(o).id, "c2");
  const tie = { captures: { c1: { faction: "REDFOR", squad: "A", ts: 100 }, c9: { faction: "BLUFOR", squad: "B", ts: 100 } } };
  assert.equal(currentOwner(tie).id, "c9");
});

test("sortedCaptures newest first", () => {
  const list = sortedCaptures({ a: { faction: "REDFOR", ts: 1 }, b: { faction: "BLUFOR", ts: 3 }, c: { faction: "REDFOR", ts: 2 } });
  assert.deepEqual(list.map((c) => c.id), ["b", "c", "a"]);
});

test("validateObjective", () => {
  assert.equal(validateObjective({ name: "Ponte", lat: 40.6, lon: 17.3 }).ok, true);
  assert.equal(validateObjective({ name: " ", lat: 40.6, lon: 17.3 }).ok, false);
  assert.equal(validateObjective({ name: "P", lat: 91, lon: 17.3 }).ok, false);
  assert.equal(validateObjective({ name: "P", lat: NaN, lon: 17.3 }).ok, false);
  assert.equal(validateObjective({ name: "P" }).ok, false);
  assert.equal(validateObjective({ name: "P", lat: 1, lon: 1 }).value.name, "P");
});

test("validateCapture", () => {
  const r = validateCapture({ faction: "BLUFOR", squad: " Alfa ", ts: now }, now);
  assert.deepEqual(r, { ok: true, value: { faction: "BLUFOR", squad: "Alfa", ts: now } });
  assert.equal(validateCapture({ faction: "X", squad: "", ts: now }, now).ok, false);
  assert.equal(validateCapture({ faction: "BLUFOR", squad: "", ts: now + 25 * 3600e3 }, now).ok, false);
  assert.equal(validateCapture({ faction: "BLUFOR", squad: "", ts: NaN }, now).ok, false);
});
