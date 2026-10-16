// Pagina telefono: invia la posizione GPS come "pending" in attesa di approvazione del Comando.
import { connect, validatePin } from "./db.js";
import { CALLSIGNS } from "./config.js";
import { FACTIONS } from "./units.js";

export function buildPending(pos, now, { faction, squad } = {}) {
  return {
    lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy, ts: now,
    faction: FACTIONS.includes(faction) ? faction : "REDFOR",
    squad: String(squad ?? "").trim()
  };
}

export function describeGeoError(code) {
  return ({ 1: "Permesso di posizione negato: abilitalo nelle impostazioni del browser.",
    2: "Posizione non disponibile: controlla GPS e copertura.",
    3: "Timeout nel rilevare la posizione." })[code] || "Errore di posizione sconosciuto.";
}

export function shouldSend(lastSentTs, now, intervalMs) {
  return lastSentTs === undefined || now < lastSentTs || now - lastSentTs >= intervalMs;
}

const INTERVAL_MS = 10000;
const store = {
  get: (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignora */ } }
};

function init() {
  const $ = (id) => document.getElementById(id);
  $("callsigns").innerHTML = CALLSIGNS.map((c) => `<option value="${c}">`).join("");
  $("faction").innerHTML = FACTIONS.map((f) => `<option>${f}</option>`).join("");
  for (const id of ["pin", "callsign", "faction", "squad"]) { const v = store.get(`sj-track-${id}`); if (v) $(id).value = v; }
  const urlPin = new URLSearchParams(location.search).get("pin");
  if (urlPin) { $("pin").value = urlPin; history.replaceState(null, "", location.pathname); }
  let watchId = null, wake = null, last, latest = null, db = null, timer = null;
  const say = (t, bad = false) => { $("status").textContent = t; $("status").className = bad ? "err" : "ok"; };

  async function send() {
    if (!latest) return;
    const callsign = $("callsign").value.trim();
    try {
      await db.setPending(callsign, buildPending(latest, Date.now(), { faction: $("faction").value, squad: $("squad").value }));
      last = Date.now();
      say(`Inviata ${new Date(last).toLocaleTimeString()} · precisione ±${Math.round(latest.coords.accuracy)} m · in attesa del Comando`);
    } catch (e) { say("Invio non riuscito: " + e.message, true); }
  }

  async function start() {
    const pin = $("pin").value.trim(), callsign = $("callsign").value.trim();
    if (!validatePin(pin)) return say("PIN non valido", true);
    if (!callsign) return say("Inserisci il callsign", true);
    if (!navigator.geolocation) return say("Questo browser non supporta la geolocalizzazione", true);
    for (const id of ["pin", "callsign", "faction", "squad"]) store.set(`sj-track-${id}`, $(id).value);
    try { db = connect(pin); } catch (e) { return say(e.message, true); }
    try { wake = await navigator.wakeLock?.request("screen"); } catch { /* facoltativo */ }
    watchId = navigator.geolocation.watchPosition((pos) => {
      latest = pos;
      if (shouldSend(last, Date.now(), INTERVAL_MS)) send();
    }, (err) => say(describeGeoError(err.code), true), { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    timer = setInterval(() => { if (latest && shouldSend(last, Date.now(), INTERVAL_MS)) send(); }, INTERVAL_MS);
    $("go").textContent = "Ferma"; say("Rilevo la posizione…");
  }
  function stop() {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    clearInterval(timer); wake?.release?.(); watchId = null; latest = null; last = undefined;
    $("go").textContent = "Avvia"; say("Fermo");
  }
  $("go").addEventListener("click", () => (watchId === null ? start() : stop()));
}

if (typeof document !== "undefined" && document.getElementById("go")) init();
