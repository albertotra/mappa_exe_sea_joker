// Orari in ora locale del dispositivo; salvati come epoch ms.
const pad = (n) => String(n).padStart(2, "0");

export function toLocalInput(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(str) {
  const m = String(str ?? "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : NaN;
}

export function fmtTime(ts) {
  if (!Number.isFinite(ts)) return "—";
  const d = new Date(ts);
  const same = new Date().toDateString() === d.toDateString();
  return same ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
