// Accesso a Firebase Realtime Database (SDK compat caricato da CDN) sotto /ops/<PIN>.
import { FIREBASE_CONFIG } from "./config.js";

export function validatePin(pin) {
  return typeof pin === "string" && pin.trim().length > 0 && !/[.$#[\]/\s]/.test(pin);
}

export function pinPath(pin, sub = "") {
  if (!validatePin(pin)) throw new Error("PIN non valido");
  if (sub.split("/").some((p) => p === ".." || p === ".")) throw new Error("Percorso non valido");
  return `ops/${pin}${sub ? `/${sub}` : ""}`;
}

export function connect(pin) {
  if (!validatePin(pin)) throw new Error("PIN non valido");
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
  const db = firebase.database(app);
  const ref = (sub) => db.ref(pinPath(pin, sub));
  const listen = (sub, cb) => ref(sub).on("value", (s) => cb(s.val() || {}), (e) => console.error(sub, e));
  return {
    onUnits: (cb) => listen("units", cb),
    setUnit: (callsign, unit) => ref(`units/${callsign}`).set(unit),
    removeUnit: (callsign) => ref(`units/${callsign}`).remove(),
    onPending: (cb) => listen("pending", cb),
    setPending: (callsign, p) => ref(`pending/${callsign}`).set(p),
    removePending: (callsign) => ref(`pending/${callsign}`).remove(),
    onMarkers: (cb) => listen("markers", cb),
    setMarker: (id, m) => ref(`markers/${id}`).set(m),
    removeMarker: (id) => ref(`markers/${id}`).remove(),
    onShapes: (cb) => listen("shapes", cb),
    setShape: (id, s) => ref(`shapes/${id}`).set(s),
    removeShape: (id) => ref(`shapes/${id}`).remove(),
    onMeta: (cb) => listen("meta", cb),
    onConnection: (cb) => db.ref(".info/connected").on("value", (s) => cb(s.val() === true))
  };
}
