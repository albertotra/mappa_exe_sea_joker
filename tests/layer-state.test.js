import test from "node:test";
import assert from "node:assert/strict";
import { createLayerState, setVisible, setOpacity, satelliteOnly, serialize, deserialize, DEFAULT_LAYERS } from "../js/layer-state.js";

const defaults = {
  orto10k: { visible: true, opacity: 0.8 },
  ctr10k: { visible: true, opacity: 0.8 },
  units: { visible: true, opacity: 1 }
};

test("setOpacity clamps to 0..1 and does not mutate", () => {
  const s = createLayerState(defaults);
  const t = setOpacity(s, "orto10k", 2);
  assert.equal(t.orto10k.opacity, 1);
  assert.equal(setOpacity(s, "orto10k", -3).orto10k.opacity, 0);
  assert.equal(s.orto10k.opacity, 0.8);
});

test("setOpacity ignores NaN", () => {
  const s = createLayerState(defaults);
  assert.equal(setOpacity(s, "orto10k", NaN).orto10k.opacity, 0.8);
});

test("satelliteOnly hides only the map overlays", () => {
  const s = satelliteOnly(createLayerState(defaults), ["orto10k", "ctr10k"]);
  assert.equal(s.orto10k.visible, false);
  assert.equal(s.ctr10k.visible, false);
  assert.equal(s.units.visible, true);
});

test("setVisible on unknown id is a no-op", () => {
  const s = createLayerState(defaults);
  assert.deepEqual(setVisible(s, "boh", false), s);
});

test("deserialize falls back to defaults on corrupt JSON", () => {
  assert.deepEqual(deserialize("{non json", defaults), createLayerState(defaults));
  assert.deepEqual(deserialize(null, defaults), createLayerState(defaults));
});

test("deserialize ignores unknown ids and bad values, keeps valid ones", () => {
  const json = JSON.stringify({ orto10k: { visible: false, opacity: 0.3 }, alieno: { visible: true, opacity: 1 }, units: { visible: "si", opacity: "x" } });
  const s = deserialize(json, defaults);
  assert.equal(s.orto10k.visible, false);
  assert.equal(s.orto10k.opacity, 0.3);
  assert.equal(s.alieno, undefined);
  assert.equal(s.units.visible, true);
  assert.equal(s.units.opacity, 1);
});

test("serialize/deserialize round trip and DEFAULT_LAYERS has the required ids", () => {
  const s = setVisible(createLayerState(defaults), "ctr10k", false);
  assert.deepEqual(deserialize(serialize(s), defaults), s);
  for (const id of ["orto10k", "ctr10k", "units", "markers", "shapes", "objectives", "utm-grid", "quadrants"]) assert.ok(DEFAULT_LAYERS[id], id);
});
