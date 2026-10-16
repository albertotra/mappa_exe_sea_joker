import test from "node:test";
import assert from "node:assert/strict";
import { buildPending, describeGeoError, shouldSend } from "../js/track.js";

const pos = { coords: { latitude: 40.6, longitude: 17.3, accuracy: 7.4 } };

test("buildPending: position, timestamp, faction and squad from the user's fields", () => {
  const p = buildPending(pos, 1234, { faction: "BLUFOR", squad: " Alfa " });
  assert.deepEqual(p, { lat: 40.6, lon: 17.3, acc: 7.4, ts: 1234, faction: "BLUFOR", squad: "Alfa" });
});

test("buildPending: invalid faction falls back to REDFOR, missing squad is empty", () => {
  const p = buildPending(pos, 1, { faction: "boh" });
  assert.equal(p.faction, "REDFOR");
  assert.equal(p.squad, "");
});

test("describeGeoError: Italian messages for each code", () => {
  assert.match(describeGeoError(1), /permesso/i);
  assert.match(describeGeoError(2), /non disponibile/i);
  assert.match(describeGeoError(3), /timeout/i);
  assert.ok(describeGeoError(99).length > 0);
});

test("shouldSend throttles to the interval and starts from never", () => {
  assert.equal(shouldSend(undefined, 1000, 10000), true);
  assert.equal(shouldSend(1000, 5000, 10000), false);
  assert.equal(shouldSend(1000, 11000, 10000), true);
  assert.equal(shouldSend(5000, 1000, 10000), true); // orologio tornato indietro: non restare bloccati
});
