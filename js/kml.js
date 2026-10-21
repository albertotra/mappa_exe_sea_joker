// Parser KML minimale: Point, LineString, Polygon (con buchi). Coordinate restituite come [lat, lon].
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function parseCoords(text) {
  return text.trim().split(/\s+/).filter(Boolean).map((t) => {
    const [lon, lat] = t.split(",").map(Number);
    return [lat, lon];
  }).filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
}

const firstText = (el, tag) => {
  const n = el.getElementsByTagName(tag)[0];
  return n ? n.textContent : "";
};

function groupOf(name, kind) {
  const n = name.toUpperCase();
  if (n.startsWith("SAFEHOUSE")) return "safehouse";
  if (n.startsWith("SETTORE")) return "settore";
  if (n.startsWith("LIMITE") || n.startsWith("CONFINI")) return "limite";
  if (kind === "point" && /^LZ [TA]\d+$/.test(n)) return "lz"; // punti di recupero blu (LZ INDIA e' di infiltrazione)
  if (n.startsWith("AREA ")) return "zona";
  if (kind === "line") return "strada";
  if (kind === "polygon") return "zona";
  return "poi";
}

export function parseKml(xml, DOMParserCtor = globalThis.DOMParser) {
  const doc = new DOMParserCtor().parseFromString(xml, "text/xml");
  const marks = doc.getElementsByTagName("Placemark");
  const out = [];
  for (let i = 0; i < marks.length; i++) {
    const pm = marks[i];
    const name = firstText(pm, "name").trim() || `Elemento ${i + 1}`;
    let kind, coords;
    if (pm.getElementsByTagName("Polygon").length) {
      kind = "polygon";
      const rings = [];
      const outer = pm.getElementsByTagName("outerBoundaryIs")[0];
      if (outer) rings.push(parseCoords(firstText(outer, "coordinates")));
      const inner = pm.getElementsByTagName("innerBoundaryIs");
      for (let j = 0; j < inner.length; j++) rings.push(parseCoords(firstText(inner[j], "coordinates")));
      coords = rings;
    } else if (pm.getElementsByTagName("LineString").length) {
      kind = "line";
      coords = parseCoords(firstText(pm, "coordinates"));
    } else if (pm.getElementsByTagName("Point").length) {
      kind = "point";
      coords = parseCoords(firstText(pm, "coordinates"))[0];
    } else continue;
    if (!coords || (kind !== "polygon" && !coords.length)) continue;
    out.push({ id: `${i}-${slug(name)}`, name, kind, group: groupOf(name, kind), coords });
  }
  return out;
}
