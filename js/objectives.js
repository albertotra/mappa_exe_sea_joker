// Obiettivi conquistabili con storico delle conquiste. Logica pura.
import { FACTIONS } from "./units.js";

const MAX_FUTURE_MS = 24 * 3600e3;
const fail = (error) => ({ ok: false, error });

export function validateObjective(input) {
  const name = String(input?.name ?? "").trim();
  if (!name) return fail("Indica il nome dell'obiettivo");
  const { lat, lon } = input || {};
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return fail("Posizione non valida");
  return { ok: true, value: { name: name.slice(0, 60), lat, lon } };
}

export function validateCapture(input, now) {
  if (!FACTIONS.includes(input?.faction)) return fail("Fazione non valida");
  if (!Number.isFinite(input.ts)) return fail("Orario non valido");
  if (input.ts > now + MAX_FUTURE_MS) return fail("Orario troppo nel futuro");
  return { ok: true, value: { faction: input.faction, squad: String(input.squad ?? "").trim().slice(0, 40), ts: input.ts } };
}

export function sortedCaptures(captures) {
  return Object.entries(captures || {})
    .filter(([, c]) => c && typeof c === "object" && FACTIONS.includes(c.faction) && Number.isFinite(c.ts))
    .map(([id, c]) => ({ id, faction: c.faction, squad: c.squad || "", ts: c.ts }))
    .sort((a, b) => b.ts - a.ts || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}

export function currentOwner(objective) {
  return sortedCaptures(objective?.captures)[0] || null;
}
