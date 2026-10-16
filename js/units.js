// Pedine delle unita' (APP-6 via milsymbol) e logica di "dato vecchio".
export function isStale(ts, now, thresholdMs) {
  if (typeof ts !== "number" || Number.isNaN(ts)) return true;
  if (ts > now + 60e3) return true; // orologio del telefono sballato
  return now - ts > thresholdMs;
}

export function formatAge(ts, now) {
  if (typeof ts !== "number" || Number.isNaN(ts)) return "mai";
  const s = Math.max(0, Math.round((now - ts) / 1000));
  return s < 60 ? `${s} s fa` : `${Math.round(s / 60)} min fa`;
}

export const FACTIONS = ["REDFOR", "BLUFOR", "NEUTRALE"];
export const FACTION_COLORS = { REDFOR: "#4dff88", BLUFOR: "#4da6ff", NEUTRALE: "#b0b0b0", LIBERO: "#ffffff" };
const AFFILIATION = { REDFOR: "F", BLUFOR: "H", NEUTRALE: "N" };

// SIDC APP-6/2525C legacy, 15 caratteri, a terra; l'affiliazione segue la fazione.
export function unitSidc(callsign, faction = "REDFOR") {
  const cs = String(callsign).toUpperCase();
  const body = cs === "ECHO" || cs === "VECTOR" ? "GPU-----A----" // posto comando
    : cs.startsWith("PHANTOM") ? "GPUCR----B---"                   // ricognizione
    : "GPUCI----B---";                                             // fanteria (squadra)
  return `S${AFFILIATION[faction] || "F"}${body}`;
}

// Trasforma una posizione GPS in attesa nell'unita' da salvare, conservando stato e nota precedenti.
export function acceptPending(p, prev) {
  return {
    lat: p.lat, lon: p.lon, acc: p.acc ?? null, ts: p.ts, source: "gps",
    status: prev?.status ?? "", note: prev?.note ?? "",
    faction: p.faction || prev?.faction || "REDFOR",
    squad: p.squad ?? prev?.squad ?? ""
  };
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function unitIcon(callsign, stale, status, faction) {
  const sym = new ms.Symbol(unitSidc(callsign, faction), { size: 26, outlineWidth: 2, outlineColor: "#000" });
  const svg = sym.asSVG();
  const [w, h] = [sym.getSize().width, sym.getSize().height];
  const flag = status === "neutralizzato" ? " ✕" : status === "in contatto" ? " !" : "";
  return L.divIcon({
    className: `unit-icon${stale ? " unit-stale" : ""}`,
    html: `${svg}<div class="cs">${esc(callsign)}${flag}</div>`,
    iconSize: [w + 20, h + 16], iconAnchor: [10 + sym.getAnchor().x, sym.getAnchor().y]
  });
}

// Ridisegna tutte le unita' nel LayerGroup; onMove(callsign, lat, lon) al termine di un trascinamento.
export function renderUnits(group, units, now, thresholdMs, onMove, onSelect) {
  group.clearLayers();
  for (const [callsign, u] of Object.entries(units || {})) {
    if (!u || !Number.isFinite(u.lat) || !Number.isFinite(u.lon)) continue;
    const stale = isStale(u.ts, now, thresholdMs);
    const m = L.marker([u.lat, u.lon], { icon: unitIcon(callsign, stale, u.status, u.faction), draggable: Boolean(onMove), zIndexOffset: 500 });
    m.bindTooltip(
      `<b>${esc(callsign)}</b> · ${esc(u.faction || "REDFOR")}${u.squad ? ` · ${esc(u.squad)}` : ""}<br>${esc(u.status || "—")}${u.note ? `<br>${esc(u.note)}` : ""}<br>${formatAge(u.ts, now)} · ${u.source === "gps" ? "GPS" : "radio"}${stale ? " · DATO VECCHIO" : ""}`,
      { direction: "top", offset: [0, -14] });
    if (onSelect) m.on("click", () => onSelect(callsign, u));
    if (onMove) m.on("dragend", () => { const p = m.getLatLng(); onMove(callsign, p.lat, p.lng); });
    m.addTo(group);
  }
  return group;
}
