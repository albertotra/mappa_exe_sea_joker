import test from "node:test";
import assert from "node:assert/strict";
import { parseTab } from "../js/tabs.js";

test("parseTab maps known hashes and falls back to mappa", () => {
  assert.equal(parseTab("#medevac"), "medevac");
  assert.equal(parseTab("#obiettivi"), "obiettivi");
  assert.equal(parseTab("#mappa"), "mappa");
  assert.equal(parseTab(""), "mappa");
  assert.equal(parseTab("#boh"), "mappa");
  assert.equal(parseTab(undefined), "mappa");
});
