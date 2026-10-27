// Log medevac: black = morti, yellow = feriti. Logica pura.
import { FACTIONS } from "./units.js";

const MAX_FUTURE_MS = 24 * 3600e3;
const fail = (error) => ({ ok: false, error });

function parseCount(v, label) {
  if (v === "" || v === null || v === undefined) return { n: 0 };
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isInteger(n)) return { error: `${label}: inserisci un numero intero` };
  if (n < 0 || n > 99) return { error: `${label}: valore tra 0 e 99` };
  return { n };
}

export function validateMedevac(input, now) {
  const safehouse = String(input?.safehouse ?? "").trim();
  if (!safehouse) return fail("Indica la safehouse");
  if (!FACTIONS.includes(input.faction)) return fail("Fazione non valida");
  const b = parseCount(input.black, "Black"), y = parseCount(input.yellow, "Yellow");
  if (b.error) return fail(b.error);
  if (y.error) return fail(y.error);
  if (b.n + y.n < 1) return fail("Inserisci almeno un black o uno yellow");
  if (!Number.isFinite(input.ts)) return fail("Orario non valido");
  if (input.ts > now + MAX_FUTURE_MS) return fail("Orario troppo nel futuro");
  return { ok: true, value: { safehouse: safehouse.slice(0, 60), faction: input.faction, black: b.n, yellow: y.n, ts: input.ts, note: String(input.note ?? "").trim().slice(0, 200) } };
}

const entries = (events) => (Array.isArray(events) ? events.map((e, i) => [String(i), e]) : Object.entries(events || {}));
export const isValidEvent =(e) => e && typeof e === "object" && typeof e.safehouse === "string" && e.safehouse.trim() && FACTIONS.includes(e.faction) && Number.isInteger(e.black) && Number.isInteger(e.yellow) && e.black >= 0 && e.yellow >= 0;

export function medevacTotals(events) {
  const t = Object.fromEntries(FACTIONS.map((f) => [f, { black: 0, yellow: 0, total: 0 }]));
  for (const [, e] of entries(events)) {
    if (!isValidEvent(e)) continue;
    t[e.faction].black += e.black; t[e.faction].yellow += e.yellow; t[e.faction].total += e.black + e.yellow;
  }
  return t;
}

export function medevacBySafehouse(events) {
  const rows = new Map();
  for (const [, e] of entries(events)) {
    if (!isValidEvent(e)) continue;
    if (!rows.has(e.safehouse)) rows.set(e.safehouse, { safehouse: e.safehouse, black: 0, yellow: 0, byFaction: Object.fromEntries(FACTIONS.map((f) => [f, { black: 0, yellow: 0 }])) });
    const r = rows.get(e.safehouse);
    r.black += e.black; r.yellow += e.yellow;
    r.byFaction[e.faction].black += e.black; r.byFaction[e.faction].yellow += e.yellow;
  }
  return [...rows.values()].sort((a, b) => a.safehouse.localeCompare(b.safehouse, "it", { numeric: true }));
}

export function sortedEvents(events) {
  return entries(events).filter(([, e]) => e && typeof e === "object")
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
}
