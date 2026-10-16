import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DOMParser } from "@xmldom/xmldom";
import { parseKml } from "../js/kml.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const mini = () => parseKml(read("./fixtures/mini.kml"), DOMParser);

test("point is returned as [lat, lon] (KML order is lon,lat)", () => {
  const f = mini().find((x) => x.name === "SAFEHOUSE 3");
  assert.equal(f.kind, "point");
  assert.deepEqual(f.coords, [40.6, 17.2]);
});

test("polygon keeps outer ring and hole", () => {
  const f = mini().find((x) => x.name === "SETTORE BOSCO 1");
  assert.equal(f.kind, "polygon");
  assert.equal(f.coords.length, 2);
  assert.deepEqual(f.coords[0][0], [40.0, 17.0]);
});

test("duplicate names get distinct ids", () => {
  const dups = mini().filter((x) => x.name === "Poligono senza titolo");
  assert.equal(dups.length, 2);
  assert.notEqual(dups[0].id, dups[1].id);
});

test("groups are derived from name and geometry", () => {
  const g = Object.fromEntries(mini().map((x) => [x.name, x.group]));
  assert.equal(g["SAFEHOUSE 3"], "safehouse");
  assert.equal(g["SAM 1"], "poi");
  assert.equal(g["SETTORE BOSCO 1"], "settore");
  assert.equal(g["LIMITE CAMPO"], "limite");
  assert.equal(g["BASE ROAD"], "strada");
  assert.equal(g["Poligono senza titolo"], "zona");
});

test("the real KML yields 53 features and every coordinate is finite", () => {
  const all = parseKml(read("../data/trazzonara.kml"), DOMParser);
  assert.equal(all.length, 53);
  const flat = (c) => (typeof c[0] === "number" ? [c] : c.flatMap(flat));
  for (const f of all) for (const [lat, lon] of flat(f.coords)) {
    assert.ok(Number.isFinite(lat) && Number.isFinite(lon), f.name);
    assert.ok(lat > 40 && lat < 41 && lon > 17 && lon < 18, f.name);
  }
});
