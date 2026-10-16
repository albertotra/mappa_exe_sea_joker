import test from "node:test";
import assert from "node:assert/strict";
import { distanceMeters, bearingDegrees, utmGridLines, quadrantLines } from "../js/grid-ruler.js";
import { utmToLatLon, GRID_INFO } from "../js/coords.js";

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("distanceMeters: 1 degree of latitude is about 111195 m", () => {
  near(distanceMeters([0, 0], [1, 0]), 111195, 200);
  assert.equal(distanceMeters([40, 17], [40, 17]), 0);
});

test("bearingDegrees: cardinal directions and identical points", () => {
  near(bearingDegrees([0, 0], [1, 0]), 0, 0.01);
  near(bearingDegrees([0, 0], [0, 1]), 90, 0.01);
  near(bearingDegrees([0, 0], [-1, 0]), 180, 0.01);
  near(bearingDegrees([0, 0], [0, -1]), 270, 0.01);
  assert.ok(Number.isFinite(bearingDegrees([40, 17], [40, 17])));
});

test("utmGridLines covers the 1 km lines inside a box", () => {
  const sw = utmToLatLon({ zone: 33, band: "T", easting: 698600, northing: 4499100 });
  const ne = utmToLatLon({ zone: 33, band: "T", easting: 701600, northing: 4501400 });
  const { lines, labels } = utmGridLines({ south: sw.lat, west: sw.lon, north: ne.lat, east: ne.lon }, 1000);
  const texts = labels.map((l) => l.text);
  for (const t of ["699000", "700000", "701000", "4500000", "4501000"]) assert.ok(texts.includes(t), t);
  assert.ok(lines.length >= 5);
  for (const l of lines) for (const [lat, lon] of l) assert.ok(Number.isFinite(lat) && Number.isFinite(lon));
});

test("utmGridLines never returns an unbounded number of lines for huge boxes", () => {
  const { lines } = utmGridLines({ south: 38, west: 15, north: 42, east: 19 }, 100);
  assert.ok(lines.length <= 400);
});

test("quadrantLines: 14 vertical and 12 horizontal lines, 13 column and 11 row names", () => {
  const q = quadrantLines();
  assert.equal(q.vertical.length, GRID_INFO.cols + 1);
  assert.equal(q.horizontal.length, GRID_INFO.rows + 1);
  assert.equal(q.columnLabels.length, GRID_INFO.cols);
  assert.equal(q.rowLabels.length, GRID_INFO.rows);
  assert.equal(q.columnLabels[0].text, "A");
  assert.equal(q.columnLabels[12].text, "M");
  assert.equal(q.rowLabels[10].text, "11");
  assert.equal(q.cellLabels.length, 143);
});
