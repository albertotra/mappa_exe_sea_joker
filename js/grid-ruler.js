// Geometria (distanza/azimut), griglia UTM e quadranti di gioco A-M / 1-11.
import { utmToLatLon, latLonToUtmInZone, GRID_INFO } from "./coords.js";

const R = 6371008.8;
const RAD = Math.PI / 180;

export function distanceMeters([lat1, lon1], [lat2, lon2]) {
  const dLat = (lat2 - lat1) * RAD, dLon = (lon2 - lon1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function bearingDegrees([lat1, lon1], [lat2, lon2]) {
  const y = Math.sin((lon2 - lon1) * RAD) * Math.cos(lat2 * RAD);
  const x = Math.cos(lat1 * RAD) * Math.sin(lat2 * RAD) - Math.sin(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.cos((lon2 - lon1) * RAD);
  const b = Math.atan2(y, x) / RAD;
  return Number.isFinite(b) ? (b + 360) % 360 : 0;
}

const MAX_LINES = 200;
const toLL = (zone, e, n) => { const p = utmToLatLon({ zone, band: "T", easting: e, northing: n }); return [p.lat, p.lon]; };

// bounds: { south, west, north, east } in gradi. Linee UTM ogni stepMeters (aumenta lo step se sarebbero troppe).
export function utmGridLines(bounds, stepMeters = 1000) {
  const zone = Math.floor(((bounds.west + bounds.east) / 2 + 180) / 6) + 1;
  const corners = [[bounds.south, bounds.west], [bounds.south, bounds.east], [bounds.north, bounds.west], [bounds.north, bounds.east]]
    .map(([lat, lon]) => latLonToUtmInZone(lat, lon, zone));
  const eMin = Math.min(...corners.map((c) => c.easting)), eMax = Math.max(...corners.map((c) => c.easting));
  const nMin = Math.min(...corners.map((c) => c.northing)), nMax = Math.max(...corners.map((c) => c.northing));
  let step = stepMeters;
  while ((eMax - eMin) / step + (nMax - nMin) / step > MAX_LINES) step *= 2;
  const lines = [], labels = [];
  for (let e = Math.ceil(eMin / step) * step; e <= eMax; e += step) {
    lines.push([toLL(zone, e, nMin), toLL(zone, e, nMax)]);
    labels.push({ pos: toLL(zone, e, nMin), text: String(Math.round(e)) });
  }
  for (let n = Math.ceil(nMin / step) * step; n <= nMax; n += step) {
    lines.push([toLL(zone, eMin, n), toLL(zone, eMax, n)]);
    labels.push({ pos: toLL(zone, eMin, n), text: String(Math.round(n)) });
  }
  return { lines, labels };
}

// Quadranti di gioco: colonne A (destra) .. M (sinistra), righe 1 (nord) .. 11.
export function quadrantLines() {
  const { zone, eastMax, northTop, size, cols, rows } = GRID_INFO;
  const eW = eastMax - cols * size, nS = northTop - rows * size;
  const vertical = [], horizontal = [], columnLabels = [], rowLabels = [], cellLabels = [];
  for (let i = 0; i <= cols; i++) { const e = eastMax - i * size; vertical.push([toLL(zone, e, northTop), toLL(zone, e, nS)]); }
  for (let j = 0; j <= rows; j++) { const n = northTop - j * size; horizontal.push([toLL(zone, eW, n), toLL(zone, eastMax, n)]); }
  const names = "ABCDEFGHIJKLM";
  for (let i = 0; i < cols; i++) columnLabels.push({ pos: toLL(zone, eastMax - (i + 0.5) * size, northTop + 40), text: names[i] });
  for (let j = 0; j < rows; j++) rowLabels.push({ pos: toLL(zone, eW - 30, northTop - (j + 0.5) * size), text: String(j + 1) });
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++)
    cellLabels.push({ pos: toLL(zone, eastMax - (i + 0.5) * size, northTop - (j + 0.5) * size), text: names[i] + (j + 1) });
  return { vertical, horizontal, columnLabels, rowLabels, cellLabels };
}

// ---- Layer Leaflet ----
const labelIcon = (text, cls = "") => L.divIcon({ className: `grid-label ${cls}`, html: text, iconSize: [40, 14], iconAnchor: [20, 7] });

export function fillQuadrantLayer(group, map) {
  const q = quadrantLines();
  const style = { color: "#ffffff", weight: 1, opacity: 0.55, interactive: false };
  [...q.vertical, ...q.horizontal].forEach((l) => L.polyline(l, style).addTo(group));
  [...q.columnLabels, ...q.rowLabels].forEach((l) => L.marker(l.pos, { icon: labelIcon(l.text, "edge"), interactive: false }).addTo(group));
  const cells = L.layerGroup();
  q.cellLabels.forEach((l) => L.marker(l.pos, { icon: labelIcon(l.text, "cell"), interactive: false }).addTo(cells));
  const sync = () => { if (map.getZoom() >= 17) group.addLayer(cells); else group.removeLayer(cells); };
  map.on("zoomend", sync); sync();
}

export function fillUtmGridLayer(group, map, stepMeters = 1000) {
  const draw = () => {
    group.clearLayers();
    if (!map.hasLayer(group)) return;
    const b = map.getBounds();
    const { lines, labels } = utmGridLines({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }, stepMeters);
    lines.forEach((l) => L.polyline(l, { color: "#4da6ff", weight: 1, opacity: 0.8, interactive: false }).addTo(group));
    labels.forEach((l) => L.marker(l.pos, { icon: labelIcon(l.text, "utm"), interactive: false }).addTo(group));
  };
  map.on("moveend", draw);
  group.on("add", draw);
}
