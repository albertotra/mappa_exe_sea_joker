import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DOMParser } from "@xmldom/xmldom";
import { parseKml } from "../js/kml.js";
import { recoveryPoints, objectiveSeeds } from "../js/sources.js";

const load = (p) => parseKml(readFileSync(new URL(p, import.meta.url), "utf8"), DOMParser);
const green = load("../data/trazzonara.kml");
const blue = load("../data/blu.kml");

test("blue KML: LZ T/A are 'lz' group, LZ INDIA (infiltration) is not a recovery point", () => {
  assert.equal(blue.filter((f) => f.group === "lz").length, 22);
  assert.equal(blue.find((f) => f.name === "LZ INDIA").group, "poi");
  assert.equal(blue.find((f) => f.name === "CONFINI AO").group, "limite");
  assert.equal(blue.find((f) => f.name === "settore BLU").group, "settore");
});

test("recovery points: 11 safehouse + 22 LZ, naturally sorted", () => {
  const r = recoveryPoints([...green, ...blue]);
  assert.equal(r.length, 33);
  assert.ok(r.includes("SAFEHOUSE 11") && r.includes("LZ A10") && !r.includes("LZ INDIA"));
  assert.ok(r.indexOf("LZ T2") < r.indexOf("LZ T10"));
});

test("objective seeds: blue = LAGO, CASTELLO, FIUME, COLLINA; red = named points, no FOB", () => {
  const b = objectiveSeeds(blue, "BLUFOR");
  assert.deepEqual(b.map((o) => o.name).sort(), ["CASTELLO", "COLLINA", "FIUME", "LAGO"]);
  assert.ok(b.every((o) => o.side === "BLUFOR" && o.id.startsWith("kml-") && Number.isFinite(o.lat)));
  const r = objectiveSeeds(green, "REDFOR");
  assert.ok(r.some((o) => o.name === "Masseria Trazzonara") && !r.some((o) => /^FOB/.test(o.name)));
  assert.equal(new Set([...r, ...b].map((o) => o.id)).size, r.length + b.length);
});
