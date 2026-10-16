// Stato dei layer (visibilita' + opacita'). Puro, senza DOM.
export const DEFAULT_LAYERS = {
  "orto10k": { visible: true, opacity: 0.8 },
  "ctr10k": { visible: false, opacity: 0.8 },
  "kml-poi": { visible: true, opacity: 1 },
  "kml-safehouse": { visible: true, opacity: 1 },
  "kml-strada": { visible: true, opacity: 1 },
  "kml-settore": { visible: true, opacity: 1 },
  "kml-zona": { visible: true, opacity: 1 },
  "kml-limite": { visible: true, opacity: 1 },
  "units": { visible: true, opacity: 1 },
  "markers": { visible: true, opacity: 1 },
  "shapes": { visible: true, opacity: 1 },
  "objectives": { visible: true, opacity: 1 },
  "utm-grid": { visible: false, opacity: 1 },
  "quadrants": { visible: true, opacity: 1 }
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function createLayerState(defaults = DEFAULT_LAYERS) {
  return Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, { ...v }]));
}

export function setVisible(state, id, visible) {
  if (!state[id]) return state;
  return { ...state, [id]: { ...state[id], visible: Boolean(visible) } };
}

export function setOpacity(state, id, opacity) {
  if (!state[id] || typeof opacity !== "number" || Number.isNaN(opacity)) return state;
  return { ...state, [id]: { ...state[id], opacity: clamp01(opacity) } };
}

export function satelliteOnly(state, overlayIds) {
  return overlayIds.reduce((s, id) => setVisible(s, id, false), state);
}

export const serialize = (state) => JSON.stringify(state);

export function deserialize(json, defaults = DEFAULT_LAYERS) {
  const base = createLayerState(defaults);
  let saved;
  try { saved = JSON.parse(json); } catch { return base; }
  if (!saved || typeof saved !== "object") return base;
  for (const id of Object.keys(base)) {
    const v = saved[id];
    if (!v || typeof v !== "object") continue;
    if (typeof v.visible === "boolean") base[id].visible = v.visible;
    if (typeof v.opacity === "number" && !Number.isNaN(v.opacity)) base[id].opacity = clamp01(v.opacity);
  }
  return base;
}
