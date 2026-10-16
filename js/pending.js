// Notifiche delle posizioni GPS inviate dai telefoni: il Comando accetta o rifiuta.
import { acceptPending, unitSidc, formatAge } from "./units.js";
import { gridRef } from "./coords.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.05;
    o.start(); o.stop(ctx.currentTime + 0.12);
  } catch { /* audio non disponibile finche' l'utente non interagisce */ }
}

export function initPending({ map, db, container, ghostLayer, getUnit }) {
  const seen = new Map(); // callsign -> ts gia' notificato (per il suono)

  function render(pending) {
    const now = Date.now();
    container.innerHTML = "";
    ghostLayer.clearLayers();
    const entries = Object.entries(pending || {}).filter(([, p]) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon));
    let fresh = false;
    for (const [callsign, p] of entries) {
      if (seen.get(callsign) !== p.ts) { seen.set(callsign, p.ts); fresh = true; }
      const card = document.createElement("div");
      card.className = "notif";
      card.innerHTML = `<div><b>${esc(callsign)}</b> · ${esc(p.faction || "REDFOR")}${p.squad ? ` · ${esc(p.squad)}` : ""}</div>
        <div class="dim">${gridRef(p) || "fuori griglia"} · ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}${p.acc ? ` · ±${Math.round(p.acc)} m` : ""} · ${formatAge(p.ts, now)}</div>
        <div class="btns"><button class="ok">Accetta</button><button class="no">Rifiuta</button></div>`;
      card.querySelector(".ok").addEventListener("click", async () => {
        await db.setUnit(callsign, acceptPending(p, getUnit(callsign)));
        await db.removePending(callsign);
      });
      card.querySelector(".no").addEventListener("click", () => db.removePending(callsign));
      card.addEventListener("mouseenter", () => map.panTo([p.lat, p.lon]));
      container.appendChild(card);

      const sym = new ms.Symbol(unitSidc(callsign, p.faction), { size: 24, outlineWidth: 2 });
      L.marker([p.lat, p.lon], {
        interactive: false, opacity: 0.6,
        icon: L.divIcon({ className: "unit-icon ghost", html: `${sym.asSVG()}<div class="cs">${esc(callsign)}?</div>`, iconSize: [60, 44], iconAnchor: [30, 16] })
      }).addTo(ghostLayer);
    }
    document.title = (entries.length ? `(${entries.length}) ` : "") + "Mappa Sea Joker";
    if (fresh) beep();
  }
  db.onPending(render);
}
