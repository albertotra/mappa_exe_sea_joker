import test from "node:test";
import assert from "node:assert/strict";
import { isStale, unitSidc, formatAge, acceptPending } from "../js/units.js";
import { pinPath, validatePin } from "../js/db.js";

const now = 1_700_000_000_000;
const min = 60e3;

test("isStale: fresh, old, missing and future timestamps", () => {
  assert.equal(isStale(now - 14 * min, now, 15 * min), false);
  assert.equal(isStale(now - 16 * min, now, 15 * min), true);
  assert.equal(isStale(undefined, now, 15 * min), true);
  assert.equal(isStale(NaN, now, 15 * min), true);
  assert.equal(isStale(now + 60 * min, now, 15 * min), true);
  assert.equal(isStale(now + 20e3, now, 15 * min), false);
});

test("unitSidc: 15 chars, friendly, distinct per role", () => {
  const s = ["ECHO", "VECTOR", "PHANTOM 1", "STRIKER A", "SCONOSCIUTO"].map(unitSidc);
  for (const x of s) { assert.equal(x.length, 15); assert.match(x, /^SFG/); }
  assert.notEqual(unitSidc("PHANTOM 1"), unitSidc("ECHO"));
  assert.notEqual(unitSidc("STRIKER A"), unitSidc("ECHO"));
  assert.equal(unitSidc("PHANTOM 1"), unitSidc("PHANTOM 2"));
});

test("formatAge", () => {
  assert.equal(formatAge(now - 30e3, now), "30 s fa");
  assert.equal(formatAge(now - 5 * min, now), "5 min fa");
  assert.equal(formatAge(undefined, now), "mai");
});

test("validatePin rejects empty and Firebase-illegal characters", () => {
  assert.equal(validatePin("1234567890"), true);
  for (const bad of ["", "  ", "a/b", "a.b", "a#b", "a$b", "a[b", undefined]) assert.equal(validatePin(bad), false, String(bad));
});

test("pinPath never points above /ops/<pin>", () => {
  assert.equal(pinPath("123", "units/ECHO"), "ops/123/units/ECHO");
  assert.throws(() => pinPath("", "units"));
  assert.throws(() => pinPath("123", "../x"));
});

test("unitSidc: affiliation follows faction", () => {
  assert.match(unitSidc("STRIKER A", "BLUFOR"), /^SHG/);
  assert.match(unitSidc("STRIKER A", "NEUTRALE"), /^SNG/);
  assert.match(unitSidc("STRIKER A", "REDFOR"), /^SFG/);
  assert.match(unitSidc("STRIKER A", "boh"), /^SFG/);
});

test("acceptPending keeps status/note, takes position and marks it gps", () => {
  const prev = { lat: 1, lon: 1, ts: 1, status: "in contatto", note: "nota", source: "manual", faction: "REDFOR", squad: "Alfa" };
  const p = { lat: 40.6, lon: 17.3, acc: 8, ts: now, faction: "REDFOR", squad: "Alfa 2" };
  const u = acceptPending(p, prev);
  assert.deepEqual([u.lat, u.lon, u.acc, u.ts, u.source], [40.6, 17.3, 8, now, "gps"]);
  assert.equal(u.status, "in contatto");
  assert.equal(u.note, "nota");
  assert.equal(u.squad, "Alfa 2");
  const fresh = acceptPending({ lat: 1, lon: 2, ts: now }, undefined);
  assert.equal(fresh.status, "");
  assert.equal(fresh.faction, "REDFOR");
});
