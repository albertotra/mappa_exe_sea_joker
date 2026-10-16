export const TABS = ["mappa", "medevac", "obiettivi"];

export function parseTab(hash, tabs = TABS) {
  const name = String(hash ?? "").replace(/^#/, "");
  return tabs.includes(name) ? name : "mappa";
}

// Mostra #tab-<nome> e nasconde le altre; onShow(nome) dopo ogni cambio (anche all'avvio).
export function initTabs({ onShow }) {
  const apply = () => {
    const tab = parseTab(location.hash);
    for (const t of TABS) {
      document.getElementById(`tab-${t}`).hidden = t !== tab;
      document.querySelector(`[data-tab="${t}"]`).classList.toggle("on", t === tab);
    }
    onShow?.(tab);
  };
  window.addEventListener("hashchange", apply);
  apply();
}
