// Costruisce il workbook Excel del report (ExcelJS da CDN nel browser) e avvia il download.
import { FACTIONS } from "./units.js";

const FILL = { REDFOR: "FFB7F0CA", BLUFOR: "FFB8D8FA", NEUTRALE: "FFDDDDDD", LIBERO: "FFFFFFFF" };
const HEAD = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A27" } };
const DATE_FMT = "dd/mm/yyyy hh:mm";

// ExcelJS scrive le date come UTC: le sposto cosi' che Excel mostri l'ora locale del dispositivo.
const local = (d) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000) : null);

function header(ws, row) {
  const r = ws.getRow(row);
  r.font = { bold: true, color: { argb: "FFFFFFFF" } };
  r.eachCell((c) => { c.fill = HEAD; c.alignment = { vertical: "middle", horizontal: "center", wrapText: true }; });
}
const tint = (cell, faction) => { if (FILL[faction]) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL[faction] } }; };
const widths = (ws, ws_) => ws_.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
const section = (ws, text) => { const r = ws.addRow([text]); r.font = { bold: true, size: 12 }; return r; };

function sheetTable(ws, columns, rows, { sumCols = [], fmts = {}, factionCol } = {}) {
  ws.addRow(columns);
  header(ws, 1);
  for (const r of rows) {
    const row = ws.addRow(r);
    for (const [i, f] of Object.entries(fmts)) row.getCell(+i + 1).numFmt = f;
    if (factionCol !== undefined) tint(row.getCell(factionCol + 1), r[factionCol]);
  }
  const last = rows.length + 1;
  if (rows.length && sumCols.length) {
    const t = ws.addRow(["TOTALE"]);
    for (const c of sumCols) {
      const L = ws.getColumn(c + 1).letter;
      t.getCell(c + 1).value = { formula: `SUBTOTAL(109,${L}2:${L}${last})`, result: rows.reduce((s, r) => s + r[c], 0) };
    }
    t.font = { bold: true };
    t.eachCell({ includeEmpty: true }, (c) => { c.border = { top: { style: "medium" } }; });
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: last, column: columns.length } };
}

export function buildWorkbook(ExcelJS, report, now = new Date()) {
  const wb = new ExcelJS.Workbook();
  wb.created = now;

  const s = wb.addWorksheet("Riepilogo");
  s.addRow(["REPORT SEA JOKER"]).font = { bold: true, size: 16 };
  s.addRow(["Generato il", local(now)]).getCell(2).numFmt = DATE_FMT;
  s.addRow([]);
  section(s, "MEDEVAC - totali per fazione");
  s.addRow(["Fazione", "Black (morti)", "Yellow (feriti)", "Totale"]); header(s, s.rowCount);
  for (const m of report.summary.medevac) { const r = s.addRow([m.faction, m.black, m.yellow, m.total]); tint(r.getCell(1), m.faction); }
  const mt = report.summary.medevacTotal;
  s.addRow(["TOTALE", mt.black, mt.yellow, mt.total]).font = { bold: true };
  s.addRow([]);
  section(s, "OBIETTIVI - situazione attuale");
  s.addRow(["Obiettivo", "Possessore", "Squadra", "Dal", "N. conquiste"]); header(s, s.rowCount);
  for (const o of report.summary.objectives) {
    const r = s.addRow([o.name, o.owner, o.squad, local(o.ts), o.captures]);
    r.getCell(4).numFmt = DATE_FMT; tint(r.getCell(2), o.owner);
  }
  s.addRow([]);
  section(s, "OBIETTIVI - per fazione");
  s.addRow(["Fazione", "Obiettivi tenuti"]); header(s, s.rowCount);
  for (const f of [...FACTIONS, "LIBERO"]) { const r = s.addRow([f, report.summary.holdings[f]]); tint(r.getCell(1), f); }
  widths(s, [26, 16, 18, 18, 14]);

  const log = wb.addWorksheet("Medevac log");
  sheetTable(log, ["Data/ora", "Safehouse", "Fazione", "Black", "Yellow", "Totale", "Nota"],
    report.medevacLog.map((e) => [local(e.ts), e.safehouse, e.faction, e.black, e.yellow, e.total, e.note]),
    { sumCols: [3, 4, 5], fmts: { 0: DATE_FMT }, factionCol: 2 });
  widths(log, [18, 22, 12, 9, 9, 9, 40]);

  const by = wb.addWorksheet("Medevac per safehouse");
  by.addRow(["", ...FACTIONS.flatMap((f) => [f, ""]), "Totale", "", ""]);
  by.mergeCells(1, 2, 1, 3); by.mergeCells(1, 4, 1, 5); by.mergeCells(1, 6, 1, 7); by.mergeCells(1, 8, 1, 10);
  header(by, 1);
  FACTIONS.forEach((f, i) => tint(by.getCell(1, 2 + i * 2), f));
  by.getRow(1).eachCell((c, n) => { if (n > 1 && n < 8) c.font = { bold: true, color: { argb: "FF000000" } }; });
  by.addRow(["Safehouse", ...FACTIONS.flatMap(() => ["Black", "Yellow"]), "Black", "Yellow", "Totale"]); header(by, 2);
  const rows = report.bySafehouse.map((r) => [r.safehouse, ...FACTIONS.flatMap((f) => [r[f].black, r[f].yellow]), r.black, r.yellow, r.total]);
  for (const r of rows) by.addRow(r);
  if (rows.length) {
    const t = by.addRow(["TOTALE"]);
    for (let c = 1; c < 10; c++) {
      const L = by.getColumn(c + 1).letter;
      t.getCell(c + 1).value = { formula: `SUM(${L}3:${L}${rows.length + 2})`, result: rows.reduce((s_, r) => s_ + r[c], 0) };
    }
    t.font = { bold: true };
    t.eachCell({ includeEmpty: true }, (c) => { c.border = { top: { style: "medium" } }; });
  }
  by.views = [{ state: "frozen", ySplit: 2, xSplit: 1 }];
  widths(by, [24, 9, 9, 9, 9, 9, 9, 9, 9, 9]);

  const ob = wb.addWorksheet("Obiettivi");
  sheetTable(ob, ["Obiettivo", "Lato (KML)", "Fazione", "Squadra", "Data/ora conquista", "Quadrante", "MGRS", "Lat", "Lon"],
    report.objectives.map((o) => [o.name, o.side, o.faction, o.squad, local(o.ts), o.grid, o.mgrs, o.lat, o.lon]),
    { fmts: { 4: DATE_FMT, 7: "0.00000", 8: "0.00000" }, factionCol: 2 });
  widths(ob, [22, 12, 12, 20, 18, 11, 18, 11, 11]);

  return wb;
}

export async function downloadReport(ExcelJS, report) {
  const wb = buildWorkbook(ExcelJS, report);
  const buf = await wb.xlsx.writeBuffer();
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  const name = `report-sea-joker-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.xlsx`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
