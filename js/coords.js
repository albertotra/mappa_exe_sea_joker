// Conversioni WGS84 / UTM / MGRS / quadranti di gioco. Nessuna dipendenza.
const A = 6378137;
const F = 1 / 298.257223563;
const K0 = 0.9996;
const E2 = F * (2 - F);
const E = Math.sqrt(E2);
const N_ = F / (2 - F);
const AA = (A / (1 + N_)) * (1 + N_ ** 2 / 4 + N_ ** 4 / 64);
const ALPHA = [N_ / 2 - (2 * N_ ** 2) / 3 + (5 * N_ ** 3) / 16, (13 * N_ ** 2) / 48 - (3 * N_ ** 3) / 5, (61 * N_ ** 3) / 240];
const BETA = [N_ / 2 - (2 * N_ ** 2) / 3 + (37 * N_ ** 3) / 96, N_ ** 2 / 48 + N_ ** 3 / 15, (17 * N_ ** 3) / 480];
const DELTA = [2 * N_ - (2 * N_ ** 2) / 3 - 2 * N_ ** 3, (7 * N_ ** 2) / 3 - (8 * N_ ** 3) / 5, (56 * N_ ** 3) / 15];
const RAD = Math.PI / 180;
const BANDS = "CDEFGHJKLMNPQRSTUVWX";

const zoneOf = (lon) => Math.min(60, Math.max(1, Math.floor((lon + 180) / 6) + 1));
const bandOf = (lat) => BANDS[Math.min(19, Math.max(0, Math.floor((lat + 80) / 8)))];

function forward(lat, lon, zone) {
  const phi = lat * RAD;
  const dl = (lon - ((zone - 1) * 6 - 180 + 3)) * RAD;
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - E * Math.atanh(E * Math.sin(phi)));
  const xi = Math.atan2(t, Math.cos(dl));
  const eta = Math.atanh(Math.sin(dl) / Math.sqrt(1 + t * t));
  let x = eta, y = xi;
  for (let j = 1; j <= 3; j++) {
    x += ALPHA[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
    y += ALPHA[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
  }
  return { easting: 500000 + K0 * AA * x, northing: (lat < 0 ? 1e7 : 0) + K0 * AA * y };
}

export function latLonToUtm(lat, lon) {
  const zone = zoneOf(lon);
  const { easting, northing } = forward(lat, lon, zone);
  return { zone, band: bandOf(lat), hemisphere: lat < 0 ? "S" : "N", easting, northing };
}

export function utmToLatLon(u) {
  const south = u.band ? u.band < "N" : u.hemisphere === "S";
  const xi = (u.northing - (south ? 1e7 : 0)) / (K0 * AA);
  const eta = (u.easting - 500000) / (K0 * AA);
  let xi1 = xi, eta1 = eta;
  for (let j = 1; j <= 3; j++) {
    xi1 -= BETA[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    eta1 -= BETA[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }
  const chi = Math.asin(Math.sin(xi1) / Math.cosh(eta1));
  let phi = chi;
  for (let j = 1; j <= 3; j++) phi += DELTA[j - 1] * Math.sin(2 * j * chi);
  const lon0 = (u.zone - 1) * 6 - 180 + 3;
  return { lat: phi / RAD, lon: lon0 + Math.atan2(Math.sinh(eta1), Math.cos(xi1)) / RAD };
}

// ---- MGRS ----
const COL_SETS = ["STUVWXYZ", "ABCDEFGH", "JKLMNPQR"]; // zone % 3 = 0,1,2
const ROW_LETTERS = "ABCDEFGHJKLMNPQRSTUV";

export function latLonToMgrs(lat, lon, digits = 5) {
  const u = latLonToUtm(lat, lon);
  const col = COL_SETS[u.zone % 3][Math.floor(u.easting / 1e5) - 1];
  const row = ROW_LETTERS[(Math.floor(u.northing / 1e5) + (u.zone % 2 === 0 ? 5 : 0)) % 20];
  const div = 10 ** (5 - digits);
  const e = String(Math.floor((u.easting % 1e5) / div)).padStart(digits, "0");
  const n = String(Math.floor((u.northing % 1e5) / div)).padStart(digits, "0");
  return `${String(u.zone).padStart(2, "0")}${u.band}${col}${row}${e}${n}`;
}

export function mgrsToLatLon(s) {
  const m = s.replace(/\s+/g, "").toUpperCase().match(/^(\d{1,2})([C-HJ-NP-X])([A-HJ-NP-Z])([A-HJ-NP-V])(\d*)$/);
  if (!m || m[5].length % 2) throw new Error("MGRS non valido");
  const zone = Number(m[1]);
  if (zone < 1 || zone > 60) throw new Error("Zona non valida");
  const colIdx = COL_SETS[zone % 3].indexOf(m[3]);
  if (colIdx < 0) throw new Error("Lettera colonna non valida per la zona");
  const half = m[5].length / 2;
  const scale = 10 ** (5 - half);
  const e = colIdx * 1e5 + 1e5 + (half ? Number(m[5].slice(0, half)) * scale : 0);
  const rowN = ((ROW_LETTERS.indexOf(m[4]) - (zone % 2 === 0 ? 5 : 0) + 20) % 20) * 1e5 + (half ? Number(m[5].slice(half)) * scale : 0);
  const bandLat = (BANDS.indexOf(m[2]) * 8) - 80;
  const centralLon = (zone - 1) * 6 - 180 + 3;
  const minN = forward(bandLat, centralLon, zone).northing;
  let n = rowN;
  while (n < minN - 1) n += 2e6;
  return utmToLatLon({ zone, band: m[2], easting: e, northing: n });
}

// ---- Quadranti di gioco: colonne A-M (da destra a sinistra), righe 1-11, celle da 250 m, fuso 33 ----
const GRID = { zone: 33, eastMax: 701750, northTop: 4501500, size: 250, cols: 13, rows: 11 };
const COL_NAMES = "ABCDEFGHIJKLM";

export function gridRef({ lat, lon }) {
  const { easting, northing } = forward(lat, lon, GRID.zone);
  const c = Math.floor((GRID.eastMax - easting) / GRID.size);
  const r = Math.floor((GRID.northTop - northing) / GRID.size);
  if (c < 0 || c >= GRID.cols || r < 0 || r >= GRID.rows) return null;
  return COL_NAMES[c] + (r + 1);
}

export function gridCenter(name) {
  const m = String(name).trim().toUpperCase().match(/^([A-M])\s*0?(\d{1,2})$/);
  if (!m) return null;
  const r = Number(m[2]);
  if (r < 1 || r > GRID.rows) return null;
  const c = COL_NAMES.indexOf(m[1]);
  return utmToLatLon({
    zone: GRID.zone, band: "T",
    easting: GRID.eastMax - (c + 0.5) * GRID.size,
    northing: GRID.northTop - (r - 0.5) * GRID.size
  });
}

export const GRID_INFO = GRID;

// ---- Parsing ----
const fail = (error) => ({ ok: false, error });
const okPoint = (lat, lon, format) =>
  Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    ? { ok: true, lat, lon, format }
    : fail("Coordinate fuori intervallo (lat ±90, lon ±180)");

function parseDms(s) {
  const re = /(\d+(?:[.,]\d+)?)\s*°\s*(?:(\d+(?:[.,]\d+)?)\s*['′]\s*)?(?:(\d+(?:[.,]\d+)?)\s*(?:["″]|'')\s*)?([NSEW])?/gi;
  const parts = [...s.matchAll(re)];
  if (parts.length !== 2) return null;
  const val = (p) => {
    const n = (x) => (x ? Number(x.replace(",", ".")) : 0);
    const v = n(p[1]) + n(p[2]) / 60 + n(p[3]) / 3600;
    return /[SW]/i.test(p[4] || "") ? -v : v;
  };
  const dirs = parts.map((p) => (p[4] || "").toUpperCase());
  const swap = /[EW]/.test(dirs[0]) && /[NS]/.test(dirs[1]);
  const [a, b] = parts.map(val);
  return swap ? { lat: b, lon: a } : { lat: a, lon: b };
}

function parseDecimal(s) {
  let tokens = s.split(/[;\s]+/).map((t) => t.replace(/^,+|,+$/g, "")).filter(Boolean);
  if (tokens.length === 1 && (tokens[0].match(/,/g) || []).length === 1) tokens = tokens[0].split(",");
  if (tokens.length !== 2) return null;
  const nums = tokens.map((t) => (/^-?\d+(?:[.,]\d+)?$/.test(t) ? Number(t.replace(",", ".")) : NaN));
  return nums.some(Number.isNaN) ? null : { lat: nums[0], lon: nums[1] };
}

export function parseCoordinate(input) {
  const s = String(input ?? "").trim().replace(/\s+/g, " ");
  if (!s) return fail("Inserisci una coordinata");

  const q = s.match(/^([A-Ma-m]) ?0?(\d{1,2})$/);
  if (q) {
    const c = gridCenter(q[0]);
    return c ? { ok: true, lat: c.lat, lon: c.lon, format: "grid" } : fail("Quadrante non valido (A-M, 1-11)");
  }

  const mg = s.toUpperCase().match(/^(\d{1,2}) ?([C-HJ-NP-X]) ?([A-HJ-NP-Z]) ?([A-HJ-NP-V]) ?((?:\d+ ?){1,2})$/);
  if (mg) {
    const groups = mg[5].trim().split(" ");
    const digits = groups.length === 2 ? (groups[0].length === groups[1].length ? groups.join("") : null) : groups[0];
    if (digits === null || digits.length % 2 || digits.length > 10) return fail("Cifre MGRS non valide");
    try {
      const p = mgrsToLatLon(`${mg[1]}${mg[2]}${mg[3]}${mg[4]}${digits}`);
      return okPoint(p.lat, p.lon, "mgrs");
    } catch (e) { return fail(e.message); }
  }

  const ut = s.toUpperCase().match(/^(\d{1,2}) ?([C-HJ-NP-X]) (\d{6,7}(?:\.\d+)?) ?M?E? (\d{6,8}(?:\.\d+)?) ?M?N?$/);
  if (ut) {
    const zone = Number(ut[1]);
    if (zone < 1 || zone > 60) return fail("Zona UTM non valida");
    const p = utmToLatLon({ zone, band: ut[2], easting: Number(ut[3]), northing: Number(ut[4]) });
    return okPoint(p.lat, p.lon, "utm");
  }

  if (/[°′″]/.test(s)) {
    const d = parseDms(s);
    return d ? okPoint(d.lat, d.lon, "dms") : fail("Gradi/primi/secondi non validi");
  }

  const d = parseDecimal(s);
  if (d) return okPoint(d.lat, d.lon, "decimal");
  return fail("Formato non riconosciuto (decimale, DMS, UTM, MGRS o quadrante)");
}

// ---- Formattazione ----
function dmsPart(v, pos, neg) {
  const a = Math.abs(v);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const sec = ((a - d) * 60 - m) * 60;
  return `${d}°${String(m).padStart(2, "0")}'${sec.toFixed(1).padStart(4, "0")}"${v < 0 ? neg : pos}`;
}

export function formatAll(lat, lon) {
  const u = latLonToUtm(lat, lon);
  const mg = latLonToMgrs(lat, lon);
  return {
    decimal: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
    dms: `${dmsPart(lat, "N", "S")} ${dmsPart(lon, "E", "W")}`,
    utm: `${u.zone}${u.band} ${String(Math.round(u.easting)).padStart(6, "0")} ${String(Math.round(u.northing)).padStart(7, "0")}`,
    mgrs: `${mg.slice(0, 3)} ${mg.slice(3, 5)} ${mg.slice(5, 10)} ${mg.slice(10)}`,
    grid: gridRef({ lat, lon })
  };
}

// UTM forzato su una zona (per griglie che attraversano il confine di fuso o seguono il fuso di gioco)
export function latLonToUtmInZone(lat, lon, zone) {
  const { easting, northing } = forward(lat, lon, zone);
  return { zone, band: bandOf(lat), hemisphere: lat < 0 ? "S" : "N", easting, northing };
}
