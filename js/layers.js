import { serialize, deserialize, setVisible, setOpacity, satelliteOnly, DEFAULT_LAYERS } from "./layer-state.js";

const STORAGE_KEY = "sj-layers-v1";
const GROUP_STYLE = {
  "kml-settore": { color: "#ffd24d", weight: 2, dashArray: "6 4", fillColor: "#ffd24d", fillOpacity: 0.06 },
  "kml-zona": { color: "#8fd3ff", weight: 2, fillOpacity: 0.05 },
  "kml-limite": { color: "#ff4d4d", weight: 3, fillOpacity: 0 },
  "kml-strada": { color: "#ffffff", weight: 3, opacity: 0.85 }
};
const POINT_COLOR = { "kml-safehouse": "#4dff88", "kml-poi": "#ffb84d" };

export function loadState() {
  try { return deserialize(localStorage.getItem(STORAGE_KEY), DEFAULT_LAYERS); }
  catch { return deserialize(null, DEFAULT_LAYERS); }
}
function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, serialize(state)); } catch { /* storage non disponibile */ }
}

export function buildKmlLayers(features) {
  const layers = Object.fromEntries(Object.keys(GROUP_STYLE).concat(Object.keys(POINT_COLOR)).map((k) => [k, L.layerGroup()]));
  for (const f of features) {
    const id = `kml-${f.group}`;
    const g = layers[id];
    if (!g) continue;
    let item;
    if (f.kind === "point") {
      item = L.circleMarker(f.coords, { radius: 6, color: "#000", weight: 1, fillColor: POINT_COLOR[id] || "#ffb84d", fillOpacity: 0.95 })
        .bindTooltip(f.name, { permanent: true, direction: "right", className: "kml-label", offset: [6, 0] });
    } else if (f.kind === "line") {
      item = L.polyline(f.coords, GROUP_STYLE[id] || GROUP_STYLE["kml-strada"]).bindTooltip(f.name, { sticky: true });
    } else {
      item = L.polygon(f.coords, GROUP_STYLE[id] || GROUP_STYLE["kml-zona"]).bindTooltip(f.name, { sticky: true });
    }
    item.addTo(g);
  }
  return layers;
}

export function buildOverlayImages(meta) {
  return Object.fromEntries(Object.entries(meta).map(([key, m]) => [key, L.imageOverlay(m.file, m.bounds, { opacity: 1, interactive: false, pane: "cartine" })]));
}

// sections: [{ title, items: [{ id, label, layer, opacity?: boolean }] }]
export function initLayerPanel({ container, map, baseLayers, sections, state }) {
  let current = state;
  const items = sections.flatMap((s) => s.items);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));

  function apply(id) {
    const it = byId[id], st = current[id];
    if (!it || !st) return;
    if (st.visible && !map.hasLayer(it.layer)) it.layer.addTo(map);
    if (!st.visible && map.hasLayer(it.layer)) map.removeLayer(it.layer);
    if (it.opacity && it.layer.setOpacity) it.layer.setOpacity(st.opacity);
  }
  const set = (next) => { current = next; saveState(current); };

  container.innerHTML = "";
  const baseSec = document.createElement("div");
  baseSec.innerHTML = "<h2>BASE</h2>";
  for (const [name, layer] of Object.entries(baseLayers)) {
    const row = document.createElement("label");
    row.className = "row";
    row.innerHTML = `<input type="radio" name="base"><span>${name}</span>`;
    const input = row.querySelector("input");
    input.checked = map.hasLayer(layer);
    input.addEventListener("change", () => {
      for (const l of Object.values(baseLayers)) if (l !== layer && map.hasLayer(l)) map.removeLayer(l);
      layer.addTo(map); layer.bringToBack();
    });
    baseSec.appendChild(row);
  }
  container.appendChild(baseSec);

  const checkboxes = {};
  for (const sec of sections) {
    const div = document.createElement("div");
    div.innerHTML = `<h2>${sec.title}</h2>`;
    for (const it of sec.items) {
      const row = document.createElement("label");
      row.className = "row";
      row.innerHTML = `<input type="checkbox"><span>${it.label}</span>` + (it.opacity ? `<input type="range" min="0" max="1" step="0.05" title="Opacità">` : "");
      const [cb, slider] = row.querySelectorAll("input");
      cb.checked = current[it.id].visible;
      checkboxes[it.id] = cb;
      cb.addEventListener("change", () => { set(setVisible(current, it.id, cb.checked)); apply(it.id); });
      if (slider && it.opacity) {
        slider.value = current[it.id].opacity;
        slider.addEventListener("input", () => { set(setOpacity(current, it.id, Number(slider.value))); apply(it.id); });
        slider.addEventListener("click", (e) => e.stopPropagation());
      }
      div.appendChild(row);
      apply(it.id);
    }
    container.appendChild(div);
  }

  const overlayIds = (sections.find((s) => s.title === "CARTINE") || { items: [] }).items.map((i) => i.id);
  const btn = document.createElement("button");
  btn.textContent = "Solo satellite";
  btn.style.marginTop = "8px";
  btn.addEventListener("click", () => {
    set(satelliteOnly(current, overlayIds));
    for (const id of overlayIds) { checkboxes[id].checked = false; apply(id); }
  });
  container.appendChild(btn);
}
