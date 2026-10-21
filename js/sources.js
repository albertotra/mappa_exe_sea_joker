// Dati derivati dai KML delle due fazioni: punti di recupero MEDEVAC e obiettivi. Logica pura.
export const SOURCES = [
  { file: "data/trazzonara.kml", faction: "REDFOR" },
  { file: "data/blu.kml", faction: "BLUFOR" }
];

const natural = (a, b) => a.localeCompare(b, "it", { numeric: true });
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Obiettivi nominati nel KML BLU (OPORD BLU: LAGO, CASTELLO, FIUME, COLLINA).
const BLUE_OBJECTIVES = new Set(["LAGO", "CASTELLO", "FIUME", "COLLINA"]);

export const recoveryPoints = (features) =>
  features.filter((f) => f.kind === "point" && (f.group === "safehouse" || f.group === "lz")).map((f) => f.name).sort(natural);

// REDFOR: tutti i punti di interesse tranne il FOB; BLUFOR: solo gli obiettivi dell'OPORD.
export function objectiveSeeds(features, side) {
  const pick = side === "BLUFOR"
    ? (f) => BLUE_OBJECTIVES.has(f.name.toUpperCase())
    : (f) => f.group === "poi" && !/^FOB/i.test(f.name);
  const seen = new Map();
  return features.filter((f) => f.kind === "point" && f.group === "poi" && pick(f)).map((f) => {
    const base = `kml-${side.toLowerCase()}-${slug(f.name)}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return { id: n > 1 ? `${base}-${n}` : base, name: f.name, lat: f.coords[0], lon: f.coords[1], side };
  });
}
