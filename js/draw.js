// Disegni tattici (linea, freccia, zona) salvati sul DB e righello locale (distanza/azimut).
import { distanceMeters, bearingDegrees } from "./grid-ruler.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const COLORS = { "Rosso": "#ff4d4d", "Giallo": "#ffd24d", "Blu": "#4da6ff", "Verde": "#4dff88", "Bianco": "#ffffff" };
const TOOLS = { line: "Linea", arrow: "Freccia", zone: "Zona", ruler: "Righello" };
const fmtDist = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);

export function renderShapes(group, shapes, onRemove) {
  group.clearLayers();
  for (const [id, s] of Object.entries(shapes || {})) {
    if (!s || !Array.isArray(s.latlngs) || s.latlngs.length < 2) continue;
    const opt = { color: s.color || "#ff4d4d", weight: 3 };
    let item;
    if (s.type === "zone") item = L.polygon(s.latlngs, { ...opt, fillOpacity: 0.12 });
    else item = L.polyline(s.latlngs, opt);
    item.bindPopup(`<b>${esc(s.label || TOOLS[s.type] || "")}</b><br><button data-rm>Rimuovi</button>`);
    item.on("popupopen", (e) => e.popup.getElement().querySelector("[data-rm]").addEventListener("click", () => onRemove(id)));
    if (s.label) item.bindTooltip(esc(s.label), { permanent: true, direction: "center", className: "kml-label" });
    item.addTo(group);
    if (s.type === "arrow") {
      const [a, b] = s.latlngs.slice(-2);
      L.marker(b, { interactive: false, icon: L.divIcon({ className: "arrow-head", iconSize: [20, 20], iconAnchor: [10, 10],
        html: `<div style="transform:rotate(${bearingDegrees(a, b) - 90}deg);color:${opt.color};font-size:20px;line-height:20px;text-shadow:0 0 3px #000">➤</div>` }) }).addTo(group);
    }
  }
}

export function initDraw({ map, db, container }) {
  container.innerHTML = `
    <h2>DISEGNO</h2>
    <div class="two">${Object.entries(TOOLS).map(([k, v]) => `<button data-tool="${k}">${v}</button>`).join("")}</div>
    <div class="two"><select id="d-color">${Object.entries(COLORS).map(([k, v]) => `<option value="${v}">${k}</option>`).join("")}</select>
    <input type="text" id="d-label" placeholder="Etichetta"></div>
    <div class="two"><button id="d-done">Fine</button><button id="d-cancel">Annulla</button></div>
    <div class="dim" id="d-hint">Scegli uno strumento, clicca i punti, poi "Fine" (o doppio click).</div>`;
  const $ = (s) => container.querySelector(s);
  let tool = null, pts = [], temp = null, tip = null;

  function reset() {
    tool = null; pts = []; map.__tool = null;
    if (temp) { map.removeLayer(temp); temp = null; }
    if (tip) { map.removeLayer(tip); tip = null; }
    map.getContainer().style.cursor = "";
    container.querySelectorAll("[data-tool]").forEach((b) => b.classList.remove("on"));
  }
  function refresh() {
    if (temp) map.removeLayer(temp);
    temp = tool === "zone" && pts.length > 2 ? L.polygon(pts, { color: $("#d-color").value, dashArray: "4 4" }) : L.polyline(pts, { color: $("#d-color").value, dashArray: "4 4" });
    temp.addTo(map);
    if (tool === "ruler" && pts.length > 1) {
      let total = 0; for (let i = 1; i < pts.length; i++) total += distanceMeters(pts[i - 1], pts[i]);
      const last = pts.slice(-2);
      const az = bearingDegrees(last[0], last[1]);
      if (tip) map.removeLayer(tip);
      tip = L.tooltip({ permanent: true, direction: "top", className: "kml-label" }).setLatLng(pts[pts.length - 1])
        .setContent(`${fmtDist(total)} · azimut ${Math.round(az)}° (${Math.round(az * 6400 / 360)} mil)`).addTo(map);
    }
  }
  function finish() {
    const min = tool === "zone" ? 3 : 2;
    if (tool && tool !== "ruler" && pts.length >= min)
      db.setShape(`s${Date.now().toString(36)}`, { type: tool, latlngs: pts, label: $("#d-label").value.trim(), color: $("#d-color").value, ts: Date.now() });
    if (tool === "ruler") return; // il righello resta visibile finche' non si preme Annulla
    reset();
  }
  container.querySelectorAll("[data-tool]").forEach((b) => b.addEventListener("click", () => {
    reset(); tool = b.dataset.tool; map.__tool = tool; b.classList.add("on");
    map.getContainer().style.cursor = "crosshair";
  }));
  map.on("click", (e) => { if (!tool) return; pts.push([e.latlng.lat, e.latlng.lng]); refresh(); });
  map.on("dblclick", (e) => { if (!tool) return; L.DomEvent.stop(e); finish(); });
  map.doubleClickZoom.disable();
  $("#d-done").addEventListener("click", finish);
  $("#d-cancel").addEventListener("click", reset);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") reset(); if (e.key === "Enter" && tool) finish(); });
}
