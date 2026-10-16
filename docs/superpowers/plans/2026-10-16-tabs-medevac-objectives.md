# Tab, medevac e obiettivi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Aggiungere tab MAPPA/MEDEVAC/OBIETTIVI con log medevac (black/yellow) e conquiste obiettivi con storico.

**Architecture:** Logica pura in `js/medevac.js`, `js/objectives.js`, `js/tabs.js` (test Node); UI in `js/medevac-ui.js`, `js/objectives-ui.js`; dati in `/ops/<PIN>/medevac` e `/objectives`.

**Tech Stack:** come il piano principale (ES modules, Leaflet, Firebase compat, `node --test`).

**Spec:** `docs/superpowers/specs/2026-10-16-mappa-sea-joker-design.md` (sezione Tab)

## Global Constraints
- Fazioni `REDFOR`, `BLUFOR`, `NEUTRALE` (`FACTIONS` in `js/units.js`); colori verde `#4dff88`, blu `#4da6ff`, grigio `#b0b0b0`, libero bianco `#ffffff`.
- black = morti, yellow = feriti; interi 0-99, black+yellow ≥ 1; orario oltre 24 h nel futuro rifiutato.
- Possessore obiettivo = conquista con `ts` maggiore; a parità vince l'`id` maggiore; nessuna conquista = libero.
- Nessun PIN nel repo; UI in italiano; testo utente sempre escapato.

## Review Focus
1. Conteggi non validi ("", "-1", "2.5", "abc", 100) → errore o 0 solo per "" quando l'altro è ≥1. → Task 1.
2. Eventi/conquiste malformati nel DB (campi mancanti, ts NaN) non rompono totali né elenco. → Task 1, 2.
3. Obiettivo senza conquiste, conquiste con stesso `ts`. → Task 2.
4. Hash URL sconosciuto → tab MAPPA. → Task 3.

### Task 1: Logica medevac (`js/medevac.js`, `tests/medevac.test.js`)
**Produces:** `validateMedevac(input, now): {ok:true,value}|{ok:false,error}`; `medevacTotals(events): Record<faction,{black,yellow,total}>`; `medevacBySafehouse(events): {safehouse,black,yellow,byFaction}[]`; `sortedEvents(events): ({id}&Event)[]` (ts decrescente).
- [ ] Test (RED) con i casi del Review Focus + totali per fazione + raggruppamento per safehouse + eventi malformati ignorati.
- [ ] Implementa; test GREEN; commit `feat: medevac logic`.

### Task 2: Logica obiettivi (`js/objectives.js`, `tests/objectives.test.js`)
**Produces:** `validateObjective({name,lat,lon})`; `validateCapture({faction,squad,ts}, now)`; `sortedCaptures(captures): {id,faction,squad,ts}[]`; `currentOwner(objective): {id,faction,squad,ts}|null`.
- [ ] Test (RED): nessuna conquista → null; due conquiste → la più recente; stesso `ts` → id maggiore; conquista malformata ignorata; validazioni.
- [ ] Implementa; GREEN; commit `feat: objectives logic`.

### Task 3: Tab e struttura pagina (`js/tabs.js`, `tests/tabs.test.js`, `index.html`, `css/style.css`)
**Produces:** `parseTab(hash, tabs?): "mappa"|"medevac"|"obiettivi"`; `initTabs({ onShow(tab) })` che mostra/nasconde `#tab-<nome>` e aggiorna l'hash.
- [ ] Test `parseTab("#medevac")`, `("")`, `("#boh")`; implementa; `index.html` con barra tab, `#tab-mappa` (layout esistente), `#tab-medevac`, `#tab-obiettivi`; `map.invalidateSize()` su `onShow("mappa")`; commit.

### Task 4: DB + UI medevac (`js/db.js`, `js/medevac-ui.js`, `js/main.js`)
**Produces:** `db.onMedevac/setMedevac/removeMedevac`; `initMedevac({container, db, getSafehouses})`.
- [ ] Form, totali, tabella safehouse × fazione, elenco con modifica/cancella; verifica E2E con Chrome headless; commit.

### Task 5: DB + UI obiettivi + layer mappa (`js/db.js`, `js/objectives-ui.js`, `js/layer-state.js`, `js/main.js`)
**Produces:** `db.onObjectives/setObjective/removeObjective/setCapture/removeCapture`; `initObjectives({container, db, map, layer, getUnits, getPoint})`; layer `objectives` in `DEFAULT_LAYERS` e nel pannello OPERATIVI.
- [ ] Creazione, conquista, storico espandibile, cancellazioni, segnalini colorati sulla mappa; test `layer-state` aggiornato; E2E; commit.

### Task 6: Chiusura
- [ ] README aggiornato, `npm test` verde, `git grep` del PIN vuoto, E2E completo, push (con conferma già data dall'utente per questo ciclo).
