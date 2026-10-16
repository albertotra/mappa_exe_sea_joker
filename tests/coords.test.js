import test from "node:test";
import assert from "node:assert/strict";
import {
  latLonToUtm, utmToLatLon, latLonToMgrs, mgrsToLatLon,
  parseCoordinate, formatAll, gridRef, gridCenter
} from "../js/coords.js";

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("latLonToUtm on central meridian of zone 33", () => {
  const u = latLonToUtm(0, 15);
  assert.equal(u.zone, 33);
  assert.equal(u.hemisphere, "N");
  near(u.easting, 500000, 1);
  near(u.northing, 0, 1);
});

test("utm round trip", () => {
  const u = latLonToUtm(40.6, 17.2);
  assert.equal(u.zone, 33);
  assert.equal(u.band, "T");
  const p = utmToLatLon(u);
  near(p.lat, 40.6, 1e-6);
  near(p.lon, 17.2, 1e-6);
});

test("known point: Masseria Trazzonara is near E 698900 N 4499900 zone 33T", () => {
  const u = latLonToUtm(40.62085281, 17.36311714);
  assert.ok(u.easting > 698000 && u.easting < 702000, u.easting);
  assert.ok(u.northing > 4498000 && u.northing < 4502000, u.northing);
});

test("mgrs round trip at 1 m", () => {
  const s = latLonToMgrs(40.6, 17.2);
  assert.match(s, /^33T[A-Z]{2}\d{10}$/);
  const p = mgrsToLatLon(s);
  near(p.lat, 40.6, 1e-4);
  near(p.lon, 17.2, 1e-4);
});

test("parseCoordinate: decimal, comma decimal and DMS agree", () => {
  const a = parseCoordinate("40.6 17.2");
  const b = parseCoordinate("40,6 17,2");
  const c = parseCoordinate("40°36'00\"N 17°12'00\"E");
  const d = parseCoordinate("40.6, 17.2");
  for (const r of [a, b, c, d]) {
    assert.equal(r.ok, true, JSON.stringify(r));
    near(r.lat, 40.6, 1e-4);
    near(r.lon, 17.2, 1e-4);
  }
  assert.equal(a.format, "decimal");
  assert.equal(c.format, "dms");
});

test("parseCoordinate: UTM and MGRS with irregular spacing/case", () => {
  const u = latLonToUtm(40.6, 17.2);
  const r = parseCoordinate(`33T ${Math.round(u.easting)} ${Math.round(u.northing)}`);
  assert.equal(r.ok, true);
  assert.equal(r.format, "utm");
  near(r.lat, 40.6, 1e-4);
  const m = latLonToMgrs(40.6, 17.2, 3);
  const spaced = `${m.slice(0, 3).toLowerCase()} ${m.slice(3, 5).toLowerCase()} ${m.slice(5, 8)} ${m.slice(8)}`;
  const r2 = parseCoordinate(spaced);
  assert.equal(r2.ok, true, JSON.stringify(r2));
  assert.equal(r2.format, "mgrs");
  near(r2.lat, 40.6, 2e-3);
});

test("parseCoordinate rejects invalid input with a message", () => {
  for (const s of ["91 10", "10 181", "", "   ", "abc", "33 123456 4490000", "33T 12 34"]) {
    const r = parseCoordinate(s);
    assert.equal(r.ok, false, s);
    assert.ok(r.error && r.error.length > 0, s);
  }
});

test("gridRef: battleship quadrants of 250 m (A-M right to left, 1-11 top to bottom)", () => {
  assert.equal(gridRef(utmToLatLon({ zone: 33, hemisphere: "N", easting: 701700, northing: 4501400 })), "A1");
  assert.equal(gridRef(utmToLatLon({ zone: 33, hemisphere: "N", easting: 698600, northing: 4498900 })), "M11");
  assert.equal(gridRef(utmToLatLon({ zone: 33, hemisphere: "N", easting: 700100, northing: 4500200 })), "F5");
  assert.equal(gridRef({ lat: 45, lon: 9 }), null);
});

test("gridCenter and parseCoordinate accept quadrant names", () => {
  const c = gridCenter("A1");
  const u = latLonToUtm(c.lat, c.lon);
  near(u.easting, 701625, 1);
  near(u.northing, 4501375, 1);
  assert.equal(gridCenter("N1"), null);
  assert.equal(gridCenter("A12"), null);
  const r = parseCoordinate("f 5");
  assert.equal(r.ok, true);
  assert.equal(r.format, "grid");
  assert.equal(gridRef({ lat: r.lat, lon: r.lon }), "F5");
});

test("formatAll returns four formats plus quadrant", () => {
  const f = formatAll(40.62085281, 17.36311714);
  assert.match(f.decimal, /40\.62085/);
  assert.match(f.utm, /^33T \d{6} \d{7}$/);
  assert.match(f.mgrs, /^33T [A-Z]{2} \d{5} \d{5}$/);
  assert.ok(f.dms.includes("N"));
  assert.ok(f.grid === null || /^[A-M]\d{1,2}$/.test(f.grid));
});
