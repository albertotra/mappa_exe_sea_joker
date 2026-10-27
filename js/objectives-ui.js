// Tab OBIETTIVI: creazione, conquiste con storico, layer sulla mappa.
import { FACTIONS, FACTION_COLORS } from "./units.js";
import { validateObjective, validateCapture, sortedCaptures, currentOwner } from "./objectives.js";
import { parseCoordinate, gridRef } from "./coords.js";
import { toLocalInput, fromLocalInput, fmtTime } from "./timefmt.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const dot = (f) => `<span class="dot" style="background:${FACTION_COLORS[f] || FACTION_COLORS.LIBERO}"></span>`;

export function initObjectives({ container, db, seeds = [], layer, getUnits, getPoint }) {
  container.innerHTML = `
    <div class="cols">
      <section class="card"><h2>NUOVO OBIETTIVO</h2>
        <input type="text" id="ob-name" placeholder="Nome obiettivo">
        <input type="text" id="ob-pos" placeholder="Posizione: WGS84, UTM, MGRS o quadrante">
        <button id="ob-usepoint">Usa punto selezionato sulla mappa</button>
        <div class="err" id="ob-err"></div><button id="ob-add">Crea obiettivo</button></section>
      <section class="card"><h2>REGISTRA CONQUISTA</h2>
        <select id="cp-obj"></select>
        <div class="two"><select id="cp-faction">${FACTIONS.map((f) => `<option>${f}</option>`).join("")}</select>
        <input type="text" id="cp-squad" list="cp-squads" placeholder="Nome squadra"></div>
        <datalist id="cp-squads"></datalist>
        <label>Orario</label><input type="datetime-local" id="cp-time">
        <div class="err" id="cp-err"></div><button id="cp-add">Registra conquista</button></section>
    </div>
    <section class="card"><h2>OBIETTIVI</h2><div id="ob-list"></div></section>`;
  const $ = (id) => container.querySelector(`#${id}`);
  let dbObjectives = {};
  let objectives = {};
  const seedIds = new Set(seeds.map((s) => s.id));
  // Obiettivi del KML (nome e posizione fissi) + quelli creati a mano; le conquiste vengono sempre dal database.
  const merge = () => {
    const out = {};
    for (const s of seeds) out[s.id] = { name: s.name, lat: s.lat, lon: s.lon, side: s.side, captures: dbObjectives[s.id]?.captures };
    for (const [id, o] of Object.entries(dbObjectives)) if (!seedIds.has(id)) out[id] = o;
    objectives = out;
  };
  const open = new Set();
  $("cp-time").value = toLocalInput(Date.now());

  $("ob-usepoint").addEventListener("click", () => {
    const p = getPoint();
    if (!p) { $("ob-err").textContent = "Nessun punto selezionato: clicca sulla mappa nella tab MAPPA"; return; }
    $("ob-pos").value = `${p.lat.toFixed(6)} ${p.lon.toFixed(6)}`; $("ob-err").textContent = "";
  });
  $("ob-add").addEventListener("click", async () => {
    const pos = parseCoordinate($("ob-pos").value);
    if (!pos.ok) { $("ob-err").textContent = pos.error; return; }
    const r = validateObjective({ name: $("ob-name").value, lat: pos.lat, lon: pos.lon });
    if (!r.ok) { $("ob-err").textContent = r.error; return; }
    await db.setObjective(`o${Date.now().toString(36)}`, { ...r.value, createdTs: Date.now() });
    $("ob-name").value = ""; $("ob-pos").value = ""; $("ob-err").textContent = "";
  });
  $("cp-add").addEventListener("click", async () => {
    const id = $("cp-obj").value;
    if (!id || !objectives[id]) { $("cp-err").textContent = "Crea o scegli un obiettivo"; return; }
    const r = validateCapture({ faction: $("cp-faction").value, squad: $("cp-squad").value, ts: fromLocalInput($("cp-time").value) }, Date.now());
    if (!r.ok) { $("cp-err").textContent = r.error; return; }
    await db.setCapture(id, `c${Date.now().toString(36)}`, r.value);
    $("cp-err").textContent = ""; $("cp-time").value = toLocalInput(Date.now());
  });

  function render() {
    const ids = Object.keys(objectives).filter((id) => objectives[id] && typeof objectives[id] === "object");
    const cur = $("cp-obj").value;
    $("cp-obj").innerHTML = ids.map((id) => `<option value="${id}">${esc(objectives[id].name)}</option>`).join("");
    if (ids.includes(cur)) $("cp-obj").value = cur;
    const squads = new Set(Object.values(getUnits()).map((u) => u?.squad).filter(Boolean));
    $("cp-squads").innerHTML = [...squads].map((s) => `<option value="${esc(s)}">`).join("");

    $("ob-list").innerHTML = ids.length ? "" : '<div class="dim">nessun obiettivo</div>';
    layer.clearLayers();
    for (const id of ids) {
      const o = objectives[id], owner = currentOwner(o), color = owner ? FACTION_COLORS[owner.faction] : FACTION_COLORS.LIBERO;
      const caps = sortedCaptures(o.captures);
      const card = document.createElement("div");
      card.className = "objrow";
      card.innerHTML = `<div class="head"><b>${esc(o.name)}</b> ${o.side ? dot(o.side) : ""}<span class="dim">${gridRef(o) || "fuori griglia"}</span>
        <span class="owner">${owner ? `${dot(owner.faction)}${owner.faction}${owner.squad ? ` · ${esc(owner.squad)}` : ""} · ${fmtTime(owner.ts)}` : '<span class="dim">libero</span>'}</span>
        <span class="acts"><button data-h>Storico (${caps.length})</button><button data-d>${seedIds.has(id) ? "Azzera storico" : "Elimina"}</button></span></div>
        <div class="hist" ${open.has(id) ? "" : "hidden"}>${caps.map((c) => `<div class="logrow">${dot(c.faction)}<b>${c.faction}</b>${c.squad ? ` · ${esc(c.squad)}` : ""} · ${fmtTime(c.ts)} <button data-c="${c.id}">Elimina</button></div>`).join("") || '<div class="dim">nessuna conquista</div>'}</div>`;
      card.querySelector("[data-h]").addEventListener("click", () => { open.has(id) ? open.delete(id) : open.add(id); render(); });
      card.querySelector("[data-d]").addEventListener("click", () => { if (confirm(seedIds.has(id) ? `Azzerare lo storico di "${o.name}"?` : `Eliminare l'obiettivo "${o.name}" e il suo storico?`)) db.removeObjective(id); });
      card.querySelectorAll("[data-c]").forEach((b) => b.addEventListener("click", () => { if (confirm("Eliminare questa conquista?")) db.removeCapture(id, b.dataset.c); }));
      $("ob-list").appendChild(card);

      if (Number.isFinite(o.lat) && Number.isFinite(o.lon)) {
        L.marker([o.lat, o.lon], { icon: L.divIcon({ className: "unit-icon", iconSize: [90, 36], iconAnchor: [45, 12],
          html: `<div style="color:${color};font-size:24px;line-height:24px;text-shadow:0 0 3px #000">⚑</div><div class="cs">${esc(o.name)}${owner ? ` · ${owner.faction}` : ""}</div>` }) })
          .bindTooltip(owner ? `${esc(o.name)}: ${owner.faction}${owner.squad ? ` · ${esc(owner.squad)}` : ""} (${fmtTime(owner.ts)})` : `${esc(o.name)}: libero`, { direction: "top" })
          .addTo(layer);
      }
    }
  }
  merge(); render();
  db.onObjectives((v) => { dbObjectives = v || {}; merge(); render(); });
  return { render, getObjectives: () => objectives };
}
