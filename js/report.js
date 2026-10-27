// Dati del report Excel (medevac + obiettivi) come righe pure, senza dipendenze dal browser.
import { FACTIONS } from "./units.js";
import { isValidEvent, medevacTotals, medevacBySafehouse, sortedEvents } from "./medevac.js";
import { sortedCaptures, currentOwner } from "./objectives.js";
import { gridRef, latLonToMgrs } from "./coords.js";

const natural = (a, b) => a.localeCompare(b, "it", { numeric: true });

function position(o) {
  if (!Number.isFinite(o.lat) || !Number.isFinite(o.lon)) return { lat: null, lon: null, grid: "", mgrs: "" };
  return { lat: o.lat, lon: o.lon, grid: gridRef(o) || "", mgrs: latLonToMgrs(o.lat, o.lon) };
}

export function buildReport({ events, objectives }) {
  const totals = medevacTotals(events);
  const medevacTotal = { black: 0, yellow: 0, total: 0 };
  for (const f of FACTIONS) for (const k of Object.keys(medevacTotal)) medevacTotal[k] += totals[f][k];

  const medevacLog = sortedEvents(events).filter(isValidEvent).map((e) => ({
    ts: Number.isFinite(e.ts) ? new Date(e.ts) : null, safehouse: e.safehouse, faction: e.faction,
    black: e.black, yellow: e.yellow, total: e.black + e.yellow, note: e.note || ""
  }));

  const bySafehouse = medevacBySafehouse(events).map((r) => ({
    safehouse: r.safehouse, ...r.byFaction, black: r.black, yellow: r.yellow, total: r.black + r.yellow
  }));

  const objs = Object.values(objectives || {}).filter((o) => o && typeof o === "object").sort((a, b) => natural(String(a.name), String(b.name)));
  const holdings = { ...Object.fromEntries(FACTIONS.map((f) => [f, 0])), LIBERO: 0 };
  const summaryObjectives = [], objectiveRows = [];
  for (const o of objs) {
    const caps = sortedCaptures(o.captures), owner = currentOwner(o), pos = position(o);
    const base = { name: o.name, ...pos, side: o.side || "" };
    holdings[owner ? owner.faction : "LIBERO"]++;
    summaryObjectives.push({ name: o.name, owner: owner ? owner.faction : "LIBERO", squad: owner?.squad || "", ts: owner ? new Date(owner.ts) : null, captures: caps.length });
    if (!caps.length) objectiveRows.push({ ...base, faction: "LIBERO", squad: "", ts: null });
    for (const c of caps) objectiveRows.push({ ...base, faction: c.faction, squad: c.squad, ts: new Date(c.ts) });
  }

  return {
    summary: { medevac: FACTIONS.map((f) => ({ faction: f, ...totals[f] })), medevacTotal, objectives: summaryObjectives, holdings },
    medevacLog, bySafehouse, objectives: objectiveRows
  };
}
