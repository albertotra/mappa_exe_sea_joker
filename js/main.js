import { createMap } from "./map.js";
import { parseKml } from "./kml.js";
import { loadState, buildKmlLayers, buildOverlayImages, initLayerPanel } from "./layers.js";
import { fillQuadrantLayer, fillUtmGridLayer } from "./grid-ruler.js";
import { connect, validatePin } from "./db.js";
import { renderUnits } from "./units.js";
import { initPanel, renderMarkers } from "./panel.js";
import { initPending } from "./pending.js";
import { initDraw, renderShapes } from "./draw.js";
import { DEFAULT_STALE_MINUTES } from "./config.js";
import { initTabs } from "./tabs.js";
import { initMedevac } from "./medevac-ui.js";
import { SOURCES, recoveryPoints, objectiveSeeds } from "./sources.js";
import { initObjectives } from "./objectives-ui.js";
import { buildReport } from "./report.js";
import { downloadReport } from "./export-xlsx.js";

const EXCELJS_URL = "https://unpkg.com/exceljs@4.4.0/dist/exceljs.min.js";
// ExcelJS pesa ~1 MB: lo carico solo alla prima esportazione.
const loadExcelJs = () => window.ExcelJS ? Promise.resolve(window.ExcelJS) : new Promise((ok, ko) => {
  const s = document.createElement("script");
  s.src = EXCELJS_URL; s.onload = () => ok(window.ExcelJS); s.onerror = () => ko(new Error("ExcelJS non caricato"));
  document.head.appendChild(s);
});

const { map, baseLayers } = createMap("map");
initTabs({ onShow: (tab) => { if (tab === "mappa") setTimeout(() => map.invalidateSize(), 0); } });

const [kmlTexts, overlayMeta] = await Promise.all([
  Promise.all(SOURCES.map((s) => fetch(s.file).then((r) => r.text()))),
  fetch("data/overlays.json").then((r) => r.json())
]);
const featuresBySide = SOURCES.map((s, i) => ({ side: s.faction, features: parseKml(kmlTexts[i]).map((f) => ({ ...f, id: `${s.faction}-${f.id}` })) }));
const kmlFeatures = featuresBySide.flatMap((x) => x.features);
const objectiveSeedList = featuresBySide.flatMap((x) => objectiveSeeds(x.features, x.side));
const kml = buildKmlLayers(kmlFeatures);
const images = buildOverlayImages(overlayMeta);

const operative = { units: L.layerGroup(), markers: L.layerGroup(), shapes: L.layerGroup(), objectives: L.layerGroup(), "utm-grid": L.layerGroup(), quadrants: L.layerGroup() };

initLayerPanel({
  container: document.getElementById("panel-layers"),
  map, baseLayers, state: loadState(),
  sections: [
    { title: "CARTINE", items: [
      { id: "orto10k", label: overlayMeta.orto10k.label, layer: images.orto10k, opacity: true },
      { id: "ctr10k", label: overlayMeta.ctr10k.label, layer: images.ctr10k, opacity: true } ] },
    { title: "KML", items: [
      { id: "kml-poi", label: "Punti di interesse", layer: kml["kml-poi"] },
      { id: "kml-safehouse", label: "SAFEHOUSE (verdi)", layer: kml["kml-safehouse"] },
      { id: "kml-lz", label: "LZ blu (recupero)", layer: kml["kml-lz"] },
      { id: "kml-strada", label: "Strade / route", layer: kml["kml-strada"] },
      { id: "kml-settore", label: "Settori", layer: kml["kml-settore"] },
      { id: "kml-zona", label: "Zone", layer: kml["kml-zona"] },
      { id: "kml-limite", label: "Limite campo", layer: kml["kml-limite"] } ] },
    { title: "OPERATIVI", items: [
      { id: "units", label: "Unità", layer: operative.units },
      { id: "markers", label: "Segnalini", layer: operative.markers },
      { id: "shapes", label: "Disegni", layer: operative.shapes },
      { id: "objectives", label: "Obiettivi", layer: operative.objectives },
      { id: "quadrants", label: "Quadranti A-M / 1-11", layer: operative.quadrants },
      { id: "utm-grid", label: "Griglia UTM 1 km", layer: operative["utm-grid"] } ] }
  ]
});

fillQuadrantLayer(operative.quadrants, map);
fillUtmGridLayer(operative["utm-grid"], map);
const ghosts = L.layerGroup().addTo(map);

// ---- PIN e collegamento al database ----
const pinBox = document.getElementById("panel-pin");
const readPin = () => { try { return localStorage.getItem("sj-pin") || ""; } catch { return ""; } };
const writePin = (v) => { try { v ? localStorage.setItem("sj-pin", v) : localStorage.removeItem("sj-pin"); } catch { /* ignora */ } };

function showPinForm(msg = "") {
  pinBox.innerHTML = `<h2>ACCESSO</h2><input type="text" id="pin-in" placeholder="PIN operazione" autocomplete="off"><div class="err">${msg}</div><button id="pin-go">Connetti</button>`;
  pinBox.querySelector("#pin-go").addEventListener("click", () => {
    const v = pinBox.querySelector("#pin-in").value.trim();
    if (!validatePin(v)) return showPinForm("PIN non valido (niente spazi né . $ # [ ] /)");
    writePin(v); location.reload();
  });
}

// ?pin=XXXX salva il PIN e lo toglie dall'URL (comodo per aprire il link su un altro dispositivo)
const urlPin = new URLSearchParams(location.search).get("pin");
if (urlPin && validatePin(urlPin)) { writePin(urlPin); history.replaceState(null, "", location.pathname); }
const pin = readPin();
if (!validatePin(pin)) {
  showPinForm();
} else {
  pinBox.innerHTML = `<div class="dim">PIN •••${pin.slice(-3)} <button id="pin-chg">Cambia</button></div>`;
  pinBox.querySelector("#pin-chg").addEventListener("click", () => { writePin(""); location.reload(); });
  start(pin);
}

function start(pin) {
  const db = connect(pin);
  let units = {}, markers = {}, shapes = {}, meta = {};
  const thresholdMs = () => (Number(meta.staleMinutes) > 0 ? Number(meta.staleMinutes) : DEFAULT_STALE_MINUTES) * 60e3;
  const panel = initPanel({ map, db, container: document.getElementById("panel-coords"), getUnits: () => units, getThresholdMs: thresholdMs });
  initDraw({ map, db, container: document.getElementById("panel-draw") });
  initPending({ map, db, container: document.getElementById("notifs"), ghostLayer: ghosts, getUnit: (cs) => units[cs] });

  const safehouses = recoveryPoints(kmlFeatures);
  const medevac = initMedevac({ container: document.getElementById("medevac-root"), db, getSafehouses: () => safehouses });
  const objectivesUi = initObjectives({ container: document.getElementById("objectives-root"), db, seeds: objectiveSeedList, layer: operative.objectives, getUnits: () => units, getPoint: () => panel.getPoint() });

  const exportBtn = document.getElementById("export-xlsx");
  exportBtn.disabled = false;
  exportBtn.addEventListener("click", async () => {
    exportBtn.disabled = true;
    try {
      const ExcelJS = await loadExcelJs();
      await downloadReport(ExcelJS, buildReport({ events: medevac.getEvents(), objectives: objectivesUi.getObjectives() }));
    } catch (e) { console.error(e); alert("Export non riuscito (serve la connessione per caricare la libreria Excel)."); }
    exportBtn.disabled = false;
  });

  const moveUnit = (cs, lat, lon) => db.setUnit(cs, { ...units[cs], lat, lon, ts: Date.now(), source: "manual" });
  const drawUnits = () => { renderUnits(operative.units, units, Date.now(), thresholdMs(), moveUnit, panel.selectUnit); panel.renderList(); };
  const drawMarkers = () => renderMarkers(operative.markers, markers, (id, lat, lon) => db.setMarker(id, { ...markers[id], lat, lon }), (id) => db.removeMarker(id));
  const drawShapes = () => renderShapes(operative.shapes, shapes, (id) => db.removeShape(id));
  db.onUnits((v) => { units = v; drawUnits(); });
  db.onMarkers((v) => { markers = v; drawMarkers(); });
  db.onShapes((v) => { shapes = v; drawShapes(); });
  db.onMeta((v) => { meta = v; drawUnits(); });
  db.onConnection((online) => { document.getElementById("banner").style.display = online ? "none" : "block"; });
  setInterval(drawUnits, 15000); // aggiorna "dato vecchio" ed eta'
  window.__app = { map, baseLayers, operative, db };
}
