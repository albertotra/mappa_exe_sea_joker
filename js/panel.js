// Pannello del Comando: inserimento coordinate, unita', segnalini, elenco unita'.
import { parseCoordinate, formatAll } from "./coords.js";
import { CALLSIGNS, STATUSES } from "./config.js";
import { FACTIONS, isStale, formatAge } from "./units.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const MARKER_TYPES = { POI: ["◆", "#ffb84d"], SQUADRA: ["■", "#4da6ff"], PERICOLO: ["▲", "#ff4d4d"] };

export function markerIcon(m) {
  const [glyph, color] = MARKER_TYPES[m.type] || MARKER_TYPES.POI;
  return L.divIcon({
    className: "unit-icon", iconSize: [80, 34], iconAnchor: [40, 12],
    html: `<div style="color:${color};font-size:22px;line-height:22px;text-shadow:0 0 3px #000">${glyph}</div><div class="cs">${esc(m.label || m.type)}</div>`
  });
}

export function renderMarkers(group, markers, onMove, onRemove) {
  group.clearLayers();
  for (const [id, m] of Object.entries(markers || {})) {
    if (!m || !Number.isFinite(m.lat) || !Number.isFinite(m.lon)) continue;
    const mk = L.marker([m.lat, m.lon], { icon: markerIcon(m), draggable: true });
    mk.bindTooltip(`${esc(m.type)} · ${esc(m.label)} (doppio click per rimuovere)`, { direction: "top" });
    mk.on("dragend", () => { const p = mk.getLatLng(); onMove(id, p.lat, p.lng); });
    mk.on("dblclick", () => { if (confirm(`Rimuovere "${m.label || m.type}"?`)) onRemove(id); });
    mk.addTo(group);
  }
}

export function initPanel({ map, db, container, getUnits, getThresholdMs }) {
  container.innerHTML = `
    <h2>POSIZIONE</h2>
    <input type="text" id="coord-in" placeholder="WGS84, UTM, MGRS o quadrante (es. F5)" autocomplete="off">
    <div class="err" id="coord-err"></div>
    <div class="conv" id="coord-conv"></div>
    <h2>UNITÀ</h2>
    <input type="text" id="u-call" list="callsigns" placeholder="Callsign">
    <datalist id="callsigns">${CALLSIGNS.map((c) => `<option value="${c}">`).join("")}</datalist>
    <div class="two"><select id="u-faction">${FACTIONS.map((f) => `<option>${f}</option>`).join("")}</select>
    <input type="text" id="u-squad" placeholder="Nome squadra"></div>
    <div class="two"><select id="u-status">${STATUSES.map((s) => `<option value="${s}">${s || "stato…"}</option>`).join("")}</select>
    <input type="text" id="u-note" placeholder="Nota"></div>
    <div class="two"><button id="u-place">Posiziona unità</button><button id="u-del">Rimuovi</button></div>
    <h2>SEGNALINO</h2>
    <div class="two"><select id="m-type">${Object.keys(MARKER_TYPES).map((t) => `<option>${t}</option>`).join("")}</select>
    <input type="text" id="m-label" placeholder="Etichetta"></div>
    <button id="m-add">Aggiungi segnalino</button>
    <h2>ELENCO UNITÀ</h2><div id="u-list"></div>`;
  const $ = (id) => container.querySelector(`#${id}`);
  let point = null, crosshair = null;

  function setPoint(lat, lon) {
    point = { lat, lon };
    if (crosshair) crosshair.setLatLng(point);
    else crosshair = L.circleMarker(point, { radius: 9, color: "#fff", weight: 2, fillOpacity: 0, interactive: false }).addTo(map);
    const f = formatAll(lat, lon);
    $("coord-conv").textContent = `DEC  ${f.decimal}\nDMS  ${f.dms}\nUTM  ${f.utm}\nMGRS ${f.mgrs}\nQUAD ${f.grid || "fuori griglia"}`;
  }

  $("coord-in").addEventListener("input", () => {
    const r = parseCoordinate($("coord-in").value);
    if (!$("coord-in").value.trim()) { $("coord-err").textContent = ""; return; }
    if (!r.ok) { $("coord-err").textContent = r.error; return; }
    $("coord-err").textContent = "";
    setPoint(r.lat, r.lon);
    map.panTo(point);
  });
  map.on("click", (e) => { if (map.__tool) return; setPoint(e.latlng.lat, e.latlng.lng); $("coord-in").value = `${e.latlng.lat.toFixed(6)} ${e.latlng.lng.toFixed(6)}`; $("coord-err").textContent = ""; });

  const needPoint = () => { if (!point) { $("coord-err").textContent = "Inserisci una coordinata valida o clicca sulla mappa"; return false; } return true; };

  $("u-place").addEventListener("click", () => {
    const callsign = $("u-call").value.trim();
    if (!callsign) { $("coord-err").textContent = "Inserisci il callsign"; return; }
    if (!needPoint()) return;
    db.setUnit(callsign, {
      lat: point.lat, lon: point.lon, acc: null, ts: Date.now(), source: "manual",
      status: $("u-status").value, note: $("u-note").value.trim(),
      faction: $("u-faction").value, squad: $("u-squad").value.trim()
    });
  });
  $("u-del").addEventListener("click", () => {
    const callsign = $("u-call").value.trim();
    if (callsign && confirm(`Rimuovere ${callsign}?`)) db.removeUnit(callsign);
  });
  $("m-add").addEventListener("click", () => {
    if (!needPoint()) return;
    const id = `m${Date.now().toString(36)}`;
    db.setMarker(id, { lat: point.lat, lon: point.lon, type: $("m-type").value, label: $("m-label").value.trim(), ts: Date.now() });
  });

  function selectUnit(callsign, u) {
    $("u-call").value = callsign; $("u-faction").value = u.faction || "REDFOR"; $("u-squad").value = u.squad || "";
    $("u-status").value = u.status || ""; $("u-note").value = u.note || "";
    setPoint(u.lat, u.lon); $("coord-in").value = `${u.lat.toFixed(6)} ${u.lon.toFixed(6)}`;
  }

  function renderList() {
    const now = Date.now(), thr = getThresholdMs();
    const rows = Object.entries(getUnits()).filter(([, u]) => u && Number.isFinite(u.lat));
    $("u-list").innerHTML = rows.length ? "" : '<div class="dim">nessuna unità</div>';
    for (const [cs, u] of rows) {
      const div = document.createElement("div");
      div.className = `urow${isStale(u.ts, now, thr) ? " stale" : ""}`;
      div.innerHTML = `<b>${esc(cs)}</b> <span class="dim">${esc(u.faction || "REDFOR")}${u.squad ? ` · ${esc(u.squad)}` : ""}</span><br><span class="dim">${formatAge(u.ts, now)}${u.status ? ` · ${esc(u.status)}` : ""}</span>`;
      div.addEventListener("click", () => { selectUnit(cs, u); map.panTo([u.lat, u.lon]); });
      $("u-list").appendChild(div);
    }
  }
  return { renderList, selectUnit, getPoint: () => point };
}
