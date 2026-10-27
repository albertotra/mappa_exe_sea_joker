import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildReport } from "../js/report.js";
import { buildWorkbook } from "../js/export-xlsx.js";

const report = buildReport({
  events: { e1: { safehouse: "SAFEHOUSE 2", faction: "REDFOR", black: 1, yellow: 2, ts: Date.UTC(2026, 9, 17, 10, 30), note: "ok" } },
  objectives: { a: { name: "LAGO", lat: 45.0, lon: 9.0, side: "BLUFOR", captures: { c1: { faction: "BLUFOR", squad: "B2", ts: 200 } } } }
});

test("workbook has the 4 sheets and survives an xlsx round-trip", async () => {
  const buf = await buildWorkbook(ExcelJS, report).xlsx.writeBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  assert.deepEqual(wb.worksheets.map((w) => w.name), ["Riepilogo", "Medevac log", "Medevac per safehouse", "Obiettivi"]);
  const log = wb.getWorksheet("Medevac log");
  assert.equal(log.getRow(2).getCell(2).value, "SAFEHOUSE 2");
  assert.equal(log.getRow(2).getCell(6).value, 3);
  assert.equal(wb.getWorksheet("Obiettivi").getRow(2).getCell(4).value, "B2");
});

test("empty report still builds", async () => {
  const buf = await buildWorkbook(ExcelJS, buildReport({ events: {}, objectives: {} })).xlsx.writeBuffer();
  assert.ok(buf.byteLength > 0);
});
