// Tab MEDEVAC: form di registrazione, totali per fazione, tabella safehouse x fazione, elenco eventi.
import { FACTIONS, FACTION_COLORS } from "./units.js";
import { validateMedevac, medevacTotals, medevacBySafehouse, sortedEvents } from "./medevac.js";
import { toLocalInput, fromLocalInput, fmtTime } from "./timefmt.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const dot = (f) => `<span class="dot" style="background:${FACTION_COLORS[f]}"></span>`;
const OTHER = "__altra__";

export function initMedevac({ container, db, getSafehouses }) {
  container.innerHTML = `
    <div class="cols">
      <section class="card"><h2 id="mv-title">REGISTRA PASSAGGIO MEDEVAC</h2>
        <label>Safehouse</label><select id="mv-sh"></select>
        <input type="text" id="mv-sh-free" placeholder="Nome safehouse / punto" hidden>
        <label>Fazione</label><select id="mv-faction">${FACTIONS.map((f) => `<option>${f}</option>`).join("")}</select>
        <div class="two"><div><label>Black (morti)</label><input type="number" id="mv-black" min="0" max="99" step="1" placeholder="0"></div>
        <div><label>Yellow (feriti)</label><input type="number" id="mv-yellow" min="0" max="99" step="1" placeholder="0"></div></div>
        <label>Orario</label><input type="datetime-local" id="mv-time">
        <label>Nota</label><input type="text" id="mv-note" placeholder="facoltativa">
        <div class="err" id="mv-err"></div>
        <div class="two"><button id="mv-save">Registra</button><button id="mv-cancel" hidden>Annulla modifica</button></div>
      </section>
      <section class="card"><h2>TOTALI PER FAZIONE</h2><div id="mv-totals"></div>
        <h2>PER SAFEHOUSE</h2><div id="mv-by-sh"></div></section>
    </div>
    <section class="card"><h2>LOG EVENTI</h2><div id="mv-list"></div></section>`;
  const $ = (id) => container.querySelector(`#${id}`);
  let events = {}, editing = null;

  function fillSafehouses() {
    const cur = $("mv-sh").value;
    $("mv-sh").innerHTML = getSafehouses().map((n) => `<option>${esc(n)}</option>`).join("") + `<option value="${OTHER}">Altra…</option>`;
    if (cur) $("mv-sh").value = cur;
    $("mv-sh-free").hidden = $("mv-sh").value !== OTHER;
  }
  const resetForm = () => {
    editing = null; $("mv-black").value = ""; $("mv-yellow").value = ""; $("mv-note").value = "";
    $("mv-time").value = toLocalInput(Date.now()); $("mv-err").textContent = "";
    $("mv-title").textContent = "REGISTRA PASSAGGIO MEDEVAC"; $("mv-save").textContent = "Registra"; $("mv-cancel").hidden = true;
  };
  $("mv-sh").addEventListener("change", () => { $("mv-sh-free").hidden = $("mv-sh").value !== OTHER; });
  $("mv-cancel").addEventListener("click", resetForm);

  $("mv-save").addEventListener("click", async () => {
    const safehouse = $("mv-sh").value === OTHER ? $("mv-sh-free").value : $("mv-sh").value;
    const r = validateMedevac({
      safehouse, faction: $("mv-faction").value, black: $("mv-black").value, yellow: $("mv-yellow").value,
      ts: fromLocalInput($("mv-time").value), note: $("mv-note").value
    }, Date.now());
    if (!r.ok) { $("mv-err").textContent = r.error; return; }
    await db.setMedevac(editing || `e${Date.now().toString(36)}`, r.value);
    resetForm();
  });

  function startEdit(ev) {
    editing = ev.id;
    fillSafehouses();
    const known = [...$("mv-sh").options].some((o) => o.value === ev.safehouse);
    $("mv-sh").value = known ? ev.safehouse : OTHER;
    $("mv-sh-free").hidden = known; $("mv-sh-free").value = known ? "" : ev.safehouse;
    $("mv-faction").value = ev.faction; $("mv-black").value = ev.black; $("mv-yellow").value = ev.yellow;
    $("mv-time").value = toLocalInput(ev.ts); $("mv-note").value = ev.note || ""; $("mv-err").textContent = "";
    $("mv-title").textContent = "MODIFICA EVENTO"; $("mv-save").textContent = "Salva modifica"; $("mv-cancel").hidden = false;
    container.scrollIntoView?.();
  }

  function render() {
    const t = medevacTotals(events);
    $("mv-totals").innerHTML = `<table><tr><th>Fazione</th><th>Black</th><th>Yellow</th><th>Totale</th></tr>` +
      FACTIONS.map((f) => `<tr><td>${dot(f)}${f}</td><td>${t[f].black}</td><td>${t[f].yellow}</td><td>${t[f].total}</td></tr>`).join("") + `</table>`;
    const rows = medevacBySafehouse(events);
    $("mv-by-sh").innerHTML = rows.length
      ? `<table><tr><th>Safehouse</th>${FACTIONS.map((f) => `<th>${dot(f)}${f}</th>`).join("")}<th>Tot. B/Y</th></tr>` +
        rows.map((r) => `<tr><td>${esc(r.safehouse)}</td>${FACTIONS.map((f) => `<td>${r.byFaction[f].black} / ${r.byFaction[f].yellow}</td>`).join("")}<td>${r.black} / ${r.yellow}</td></tr>`).join("") + `</table><div class="dim">formato nero / giallo (black / yellow)</div>`
      : '<div class="dim">nessun passaggio registrato</div>';
    const list = sortedEvents(events);
    $("mv-list").innerHTML = list.length ? "" : '<div class="dim">nessun evento</div>';
    for (const ev of list) {
      const row = document.createElement("div");
      row.className = "logrow";
      row.innerHTML = `<span class="time">${fmtTime(ev.ts)}</span> ${dot(ev.faction)}<b>${esc(ev.faction)}</b> · ${esc(ev.safehouse)} · <span class="blk">${Number(ev.black) || 0} black</span> · <span class="yel">${Number(ev.yellow) || 0} yellow</span>${ev.note ? ` · <span class="dim">${esc(ev.note)}</span>` : ""}
        <span class="acts"><button data-e>Modifica</button><button data-d>Elimina</button></span>`;
      row.querySelector("[data-e]").addEventListener("click", () => startEdit(ev));
      row.querySelector("[data-d]").addEventListener("click", () => { if (confirm("Eliminare questo evento?")) db.removeMedevac(ev.id); });
      $("mv-list").appendChild(row);
    }
  }

  resetForm(); fillSafehouses(); render();
  db.onMedevac((v) => { events = v; render(); });
  return { fillSafehouses };
}
