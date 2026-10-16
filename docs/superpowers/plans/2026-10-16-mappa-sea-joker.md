# Mappa tattica Sea Joker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Console web per il Comando con cartine georeferenziate, KML, pedine live (manuali e GPS da telefono), segnalini, disegni, griglia UTM/MGRS e pannello layer.

**Architecture:** Sito statico (HTML + ES modules, nessun bundler) su GitHub Pages; Leaflet per la mappa, Firebase Realtime Database (SDK compat da CDN) per lo stato condiviso sotto `/ops/<PIN>`. La logica pura (coordinate, KML, stato layer, staleness, geometria) sta in moduli senza dipendenze dal DOM, testati con `node --test`; la UI è verificata a mano nel browser.

**Tech Stack:** Leaflet 1.9.4, milsymbol 2.2.0, Firebase JS 9.23.0 (compat, CDN), Node `node:test` + `@xmldom/xmldom@0.8.10` (solo devDependency per i test), Python 3 + Pillow/numpy + `pdftoppm` per lo script offline.

**Spec:** `docs/superpowers/specs/2026-10-16-mappa-sea-joker-design.md`

## Global Constraints

- Repo pubblico `https://github.com/albertotra/mappa_exe_sea_joker.git`, branch `main`. Mai committare: OPORD, PDF originali (`files/`), `files/progetto_esempio/`, il PIN.
- Nessun build step; librerie da CDN con versione fissata (vedi Tech Stack). Lingua UI: italiano.
- Posizioni di pedine, segnalini e disegni salvate come lat/lon WGS84; non dipendono dagli overlay.
- Percorso dati: `/ops/<PIN>/units/<callsign>`, `/ops/<PIN>/markers/<id>`, `/ops/<PIN>/shapes/<id>`, `/ops/<PIN>/meta`. Unità: `{lat, lon, acc, ts, status, note, source: "manual"|"gps"}`; vince l'ultimo `ts`.
- Il PIN non entra nel repo: si digita all'apertura e resta in `localStorage` del browser (con try/catch).
- Callsign: VECTOR, ECHO, PHANTOM 1, PHANTOM 2, STRIKER A, STRIKER B, STRIKER C, STRIKER D, STRIKER E.
- Dato vecchio: soglia di default 15 minuti, configurabile in `meta.staleMinutes`.
- Formato ufficiale WGS84; UTM e MGRS accettati come input e mostrati come conversione.
- Firebase config (non segreta): `projectId sea-joker-26`, `databaseURL https://sea-joker-26-default-rtdb.europe-west1.firebasedatabase.app`, `apiKey AIzaSyAHsiiCAjVOlaf5XvR8pKUMZctRl9J71ag`, `authDomain sea-joker-26.firebaseapp.com`, `storageBucket sea-joker-26.firebasestorage.app`, `messagingSenderId 866026967981`, `appId 1:866026967981:web:75d726ce406a1eda198724`.
- Banner "OFFLINE" se Firebase non è raggiungibile; le ultime posizioni restano a schermo.

## Review Focus

1. Coordinate con virgola decimale ("41,123 16,5") o con spazi/maiuscole irregolari (MGRS "33t xk 123 456"): devono essere parsate o rifiutate con messaggio, mai produrre NaN. → Task 2.
2. Lat/lon fuori range (91, 181), stringa vuota, UTM senza zona o con lettera banda errata: errore inline, nessun inserimento. → Task 2.
3. KML con `lon,lat,alt` (ordine invertito rispetto a Leaflet), nomi duplicati ("Poligono senza titolo"), poligoni con buchi. → Task 3.
4. Timestamp futuro (orologio del telefono sballato) o `ts` mancante: la pedina non deve risultare "fresca" per sempre né rompersi. → Task 6.
5. PIN errato o geolocalizzazione negata sul telefono: console vuota con messaggio chiaro; telefono mostra il motivo e non fa push. → Task 5 e Task 10.

---

### Task 1: Scaffold, mappa base e deploy

**Files:**
- Create: `index.html`, `js/config.js`, `js/map.js`, `css/style.css`, `package.json`, `.github/workflows/static.yml`, `README.md`
- Modify: `.gitignore` (aggiungi `node_modules/`)

**Interfaces:**
- Produces: `js/config.js` esporta `FIREBASE_CONFIG` (valori dei Global Constraints) e `CALLSIGNS: string[]`; `js/map.js` esporta `createMap(containerId: string): { map: L.Map, baseLayers: Record<string, L.TileLayer> }` con chiavi `"Satellite"` (Esri World Imagery, default attivo) e `"OpenStreetMap"`.

- [ ] **Step 1:** Crea `package.json` (`"type": "module"`, script `"test": "node --test tests/"`, devDependency `@xmldom/xmldom` 0.8.10) ed esegui `npm install`.
- [ ] **Step 2:** Implementa `createMap` centrando su Masseria Trazzonara (prima coordinata del placemark `Masseria Trazzonara` nel KML, zoom 15) e `index.html` che carica Leaflet 1.9.4 da unpkg e `js/map.js` come module.
- [ ] **Step 3:** Copia `.github/workflows/static.yml` dalla struttura di `files/progetto_esempio/.github/workflows/static.yml` (deploy dell'intero repo su Pages dal branch `main`).
- [ ] **Step 4:** Verifica: `python3 -m http.server 8000` e apri `http://localhost:8000`; Expected: mappa satellitare centrata sulla masseria.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: scaffold, base map and pages workflow"`

### Task 2: Modulo coordinate (WGS84 / UTM / MGRS)

**Files:**
- Create: `js/coords.js`, `tests/coords.test.js`

**Interfaces:**
- Produces:
  - `latLonToUtm(lat: number, lon: number): { zone: number, band: string, hemisphere: "N"|"S", easting: number, northing: number }`
  - `utmToLatLon(utm: { zone, band|hemisphere, easting, northing }): { lat: number, lon: number }`
  - `latLonToMgrs(lat, lon, digits = 5): string` e `mgrsToLatLon(s: string): { lat, lon }`
  - `parseCoordinate(input: string): { ok: true, lat, lon, format: "decimal"|"dms"|"utm"|"mgrs" } | { ok: false, error: string }`
  - `formatAll(lat, lon): { decimal: string, dms: string, utm: string, mgrs: string }`
  - Implementazione propria (formule UTM WGS84, nessuna dipendenza).

- [ ] **Step 1: Test che falliscono** in `tests/coords.test.js`, con asserzioni: `latLonToUtm(0, 15)` → zone 33, easting 500000 (±1), northing 0 (±1); round trip `utmToLatLon(latLonToUtm(40.6, 17.2))` entro 1e-6 gradi; `parseCoordinate("40.6 17.2")`, `parseCoordinate("40,6 17,2")` e `parseCoordinate("40°36'00\"N 17°12'00\"E")` danno lo stesso punto entro 1e-4; `parseCoordinate("33T 123456 4490000")` → `format: "utm"`; `parseCoordinate("33t xk 123 456")` → ok con `format: "mgrs"`; `mgrsToLatLon(latLonToMgrs(40.6, 17.2))` entro 1e-4 (precisione 1 m); `parseCoordinate("91 10")`, `parseCoordinate("")`, `parseCoordinate("33 123456 4490000")` (banda mancante) → `{ ok: false }` con `error` non vuoto.
- [ ] **Step 2:** `node --test tests/coords.test.js`; Expected: FAIL (modulo non definito).
- [ ] **Step 3:** Implementa `js/coords.js`. `parseCoordinate` normalizza (trim, maiuscole, virgola decimale → punto solo se non separa le due coordinate, spazi multipli) e prova in ordine MGRS, UTM, DMS, decimale. Risultati con lat/lon NaN o fuori range sono errori.
- [ ] **Step 4:** `node --test tests/coords.test.js`; Expected: PASS.
- [ ] **Step 5: Commit** `feat: coordinate parsing and conversion`

### Task 3: Parser KML

**Files:**
- Create: `js/kml.js`, `tests/kml.test.js`, `tests/fixtures/mini.kml`, `data/trazzonara.kml` (copia di `files/TRAZZONARA SEA JOKER VERDI.kml`)

**Interfaces:**
- Produces: `parseKml(xml: string, DOMParserCtor = globalThis.DOMParser): Feature[]` con `Feature = { id: string, name: string, kind: "point"|"line"|"polygon", group: "settore"|"safehouse"|"strada"|"poi"|"limite", coords: [lat, lon][] | [lat, lon][][] }` (poligono: lista di anelli, il primo è l'esterno). Coordinate restituite come `[lat, lon]`.

- [ ] **Step 1: Test che falliscono** con `@xmldom/xmldom` come `DOMParserCtor` e `mini.kml` (un Point `<coordinates>17.2,40.6,0</coordinates>`, una LineString, un Polygon con `innerBoundaryIs`, due placemark chiamati "Poligono senza titolo"): il Point → `coords [40.6, 17.2]`; il poligono ha 2 anelli; i due duplicati hanno `id` diversi; `"SAFEHOUSE 3"` → `group "safehouse"`, `"SETTORE BOSCO 1"` → `"settore"`, `"LIMITE CAMPO"` → `"limite"`, `"BASE ROAD"` (LineString) → `"strada"`; il KML reale restituisce 53 feature.
- [ ] **Step 2:** `node --test tests/kml.test.js`; Expected: FAIL.
- [ ] **Step 3:** Implementa `parseKml` (gruppo derivato dal nome e dal tipo di geometria; `id` = indice progressivo + slug del nome).
- [ ] **Step 4:** `node --test`; Expected: PASS.
- [ ] **Step 5: Commit** `feat: KML parser and data`

### Task 4: Georeferenziazione delle cartine (script offline)

**Files:**
- Create: `tools/georef.py`, `tools/README.md`, `data/orto10k.webp`, `data/ctr10k.webp`, `data/overlays.json`

**Interfaces:**
- Produces: `data/overlays.json` = `{ "orto10k": { "file": "data/orto10k.webp", "bounds": [[latSud, lonOvest], [latNord, lonEst]], "label": "ORTO10K" }, "ctr10k": { ... "label": "CTR10K" } }`.

- [ ] **Step 1:** Renderizza anteprime: `pdftoppm -r 100 -png files/ORTO10K_JOKER_A3custom.pdf /tmp/orto` (idem CTR) e mostrale all'utente.
- [ ] **Step 2:** Con l'utente, scegli 4 punti di controllo per cartina (pixel x,y sull'immagine ↔ lat/lon da punti del KML riconoscibili o da coordinate/griglia ai bordi). Se non ci sono punti riconoscibili, chiedi all'utente le coordinate degli angoli.
- [ ] **Step 3:** Implementa `tools/georef.py <pdf> <controlpoints.json> <out.webp> <key>`: render a ~200 dpi, trasformazione affine/proiettiva dai punti di controllo, warp su griglia lat/lon allineata al nord, ritaglio, WebP (target ≤ 3 MB), aggiorna `overlays.json` con i bounds. Stampa l'errore residuo in metri per punto di controllo.
- [ ] **Step 4:** Esegui per entrambe le cartine. Expected: residuo massimo < 15 m e file ≤ 3 MB; altrimenti ripeti Step 2 con punti migliori.
- [ ] **Step 5: Commit** `feat: georeferenced ORTO10K and CTR10K overlays`

### Task 5: Stato layer e pannello layer

**Files:**
- Create: `js/layer-state.js`, `js/layers.js`, `tests/layer-state.test.js`
- Modify: `index.html`, `js/map.js`

**Interfaces:**
- Produces (`layer-state.js`, puro):
  - `createLayerState(defaults: Record<string, { visible: boolean, opacity: number }>): LayerState`
  - `setVisible(state, id, visible): LayerState`, `setOpacity(state, id, opacity): LayerState` (opacità clamp 0..1)
  - `satelliteOnly(state, overlayIds: string[]): LayerState` — spegne tutte le cartine
  - `serialize(state): string`, `deserialize(json: string, defaults): LayerState` (JSON corrotto o ids sconosciuti → defaults)
- Produces (`layers.js`): `initLayerPanel(opts: { map, baseLayers, overlays: Record<id, { label, layer, opacity?: boolean }>, state }): void`. Sezioni: Base (radio), Cartine (checkbox + slider opacità per `orto10k`, `ctr10k`, pulsante "Solo satellite"), KML (un checkbox per gruppo), Operativi (unità, segnalini, disegni, griglia). Persistenza in `localStorage` con try/catch.
- Consumes: `overlays.json` (Task 4), `parseKml` (Task 3).

- [ ] **Step 1: Test che falliscono**: `setOpacity(s, "orto10k", 2)` → 1; `satelliteOnly` mette `visible:false` su `orto10k` e `ctr10k` e non tocca gli altri; `deserialize("{non json", defaults)` restituisce `defaults`; `deserialize` ignora id sconosciuti.
- [ ] **Step 2:** `node --test tests/layer-state.test.js`; Expected: FAIL.
- [ ] **Step 3:** Implementa `layer-state.js`.
- [ ] **Step 4:** `node --test`; Expected: PASS.
- [ ] **Step 5:** Implementa `layers.js`: overlay ORTO/CTR come `L.imageOverlay` con i bounds di `overlays.json`; gruppi KML da `data/trazzonara.kml` con stili per gruppo (settori con riempimento trasparente). Ogni modifica ad un checkbox/slider aggiorna layer e `localStorage`.
- [ ] **Step 6:** Verifica a mano nel browser: spegnere ORTO e CTR lascia il solo satellite; slider cambia opacità; ricaricando la pagina lo stato resta; con `localStorage` bloccato la pagina funziona lo stesso.
- [ ] **Step 7: Commit** `feat: layer panel with per-map toggles and opacity`

### Task 6: Database, pedine e staleness

**Files:**
- Create: `js/db.js`, `js/units.js`, `tests/units.test.js`
- Modify: `index.html`

**Interfaces:**
- Produces (`db.js`): `connect(pin: string): Db` con `Db = { onUnits(cb: (units: Record<string, Unit>) => void): void, setUnit(callsign: string, unit: Unit): Promise<void>, onMarkers(cb), setMarker(id, m), removeMarker(id), onShapes(cb), setShape(id, s), removeShape(id), onConnection(cb: (online: boolean) => void): void }`. `pin` non vuoto, altrimenti lancia. Nessun accesso a `/ops` direttamente.
- Produces (`units.js`): `isStale(ts: number | undefined, now: number, thresholdMs: number): boolean` (ts mancante o NaN → true; ts > now + 60 s → true); `unitSidc(callsign: string): string` (SIDC APP-6 amico: ad esempio fanteria/squadra; HQ per VECTOR ed ECHO; ricognizione per PHANTOM); `renderUnitsLayer(map, units, now, thresholdMs): L.LayerGroup` che disegna ogni unità con milsymbol, etichetta callsign, tooltip con stato/nota/ora e opacità ridotta se `isStale`.

- [ ] **Step 1: Test che falliscono**: `isStale(now - 14*60e3, now, 15*60e3)` false; `isStale(now - 16*60e3, ...)` true; `isStale(undefined, ...)` true; `isStale(now + 3600e3, ...)` true (orologio sballato); `unitSidc("PHANTOM 1")` ≠ `unitSidc("ECHO")`.
- [ ] **Step 2:** `node --test tests/units.test.js`; Expected: FAIL.
- [ ] **Step 3:** Implementa `isStale` e `unitSidc`, poi `renderUnitsLayer` e `db.js` (compat SDK, `firebase.initializeApp(FIREBASE_CONFIG)`, riferimenti sotto `ops/${pin}`).
- [ ] **Step 4:** `node --test`; Expected: PASS.
- [ ] **Step 5:** Nella console: richiesta PIN all'avvio (salvato in `localStorage`, pulsante "Cambia PIN"); banner OFFLINE se `onConnection(false)`. Verifica a mano: scrivere da console browser `db.setUnit("ECHO", {...})` mostra la pedina; PIN errato → mappa senza unità e nessun errore non gestito.
- [ ] **Step 6: Commit** `feat: realtime units with APP-6 symbols and stale detection`

### Task 6b: Notifiche di posizione (accetta / rifiuta)

**Files:** Create `js/pending.js`; Modify `js/units.js`, `js/db.js`, `tests/units.test.js`, `index.html`, `css/style.css`

**Interfaces:**
- Produces (`units.js`): `acceptPending(p: Pending, prev?: Unit): Unit` (copia lat/lon/acc/ts, `source:"gps"`, tiene `status`/`note` di `prev`, `faction`/`squad` da `p` con fallback a `prev`, default `faction:"REDFOR"`); `unitSidc(callsign, faction = "REDFOR")` (REDFOR=amico `SFG`, BLUFOR=ostile `SHG`, NEUTRALE=`SNG`).
- Produces (`db.js`): `onPending(cb)`, `setPending(callsign, p)`, `removePending(callsign)`.
- Produces (`pending.js`): `initPending({ map, db, container, getUnit }): void` — card di notifica per ogni pending (callsign, fazione · squadra, quadrante, precisione, età) con Accetta/Rifiuta e pedina fantasma tratteggiata sulla mappa.

- [ ] Test: `acceptPending` conserva `status`/`note`, imposta `source:"gps"`; `unitSidc("ECHO","BLUFOR")` inizia con `SHG`, `"NEUTRALE"` con `SNG`.
- [ ] Implementa; verifica a mano con due schede browser: il pending compare come notifica, Accetta sposta la pedina, Rifiuta no.
- [ ] Commit `feat: GPS position notifications with accept/reject`

### Task 7: Inserimento coordinate e gestione unità/segnalini

**Files:**
- Create: `js/panel.js`
- Modify: `index.html`, `css/style.css`

**Interfaces:**
- Consumes: `parseCoordinate`, `formatAll` (Task 2), `Db` (Task 6), `CALLSIGNS` (Task 1).
- Produces: `initPanel(opts: { map, db }): void` — barra con campo coordinate (mostra errore inline da `parseCoordinate`, conversioni nei tre formati con `formatAll`), selettore callsign, stato (in contatto, neutralizzato, in movimento, fermo), nota, pulsanti "Posiziona unità" e "Aggiungi segnalino" (tipo: POI, squadra, pericolo; etichetta). Il click sulla mappa è un'alternativa al campo coordinate. Trascinare una pedina o un segnalino cambia solo il suo lat/lon e lo salva (`source: "manual"`, `ts: Date.now()`).

- [ ] **Step 1:** Implementa il pannello; coordinate invalide non scrivono nulla sul DB.
- [ ] **Step 2:** Verifica a mano: incollare `33T ...` (UTM dalla griglia), `40.6 17.2` e un MGRS posiziona la pedina nello stesso modo; "91 10" mostra errore e non crea nulla; spegnere ORTO/CTR non sposta pedine né segnalini.
- [ ] **Step 3: Commit** `feat: manual unit and marker placement from radio coordinates`

### Task 8: Disegni, griglia e righello

**Files:**
- Create: `js/draw.js`, `js/grid-ruler.js`, `tests/grid-ruler.test.js`

**Interfaces:**
- Produces (`grid-ruler.js`): `distanceMeters(a: [lat, lon], b: [lat, lon]): number` (haversine); `bearingDegrees(a, b): number` (0-360, azimut vero); `utmGridLines(bounds: L.LatLngBounds, stepMeters: number): { lines: [lat, lon][][], labels: { pos: [lat, lon], text: string }[] }`; `createGridLayer(map, stepMeters = 1000): L.LayerGroup` che si ridisegna a moveend.
- Produces (`draw.js`): `initDraw(opts: { map, db }): void` con strumenti linea, freccia, zona, righello (distanza + azimut in tooltip, non salvato); forme salvate con `db.setShape(id, { type, latlngs, label, color })`.

- [ ] **Step 1: Test che falliscono**: `distanceMeters([0,0],[0,1])` ≈ 111195 (±200); `bearingDegrees([0,0],[1,0])` ≈ 0, `([0,0],[0,1])` ≈ 90, `([0,0],[-1,0])` ≈ 180; `bearingDegrees(a, a)` è un numero finito (non NaN).
- [ ] **Step 2:** `node --test tests/grid-ruler.test.js`; Expected: FAIL.
- [ ] **Step 3:** Implementa le funzioni pure, poi `utmGridLines` (usa `latLonToUtm`/`utmToLatLon`) e il layer griglia con etichette in km.
- [ ] **Step 4:** `node --test`; Expected: PASS.
- [ ] **Step 5:** Implementa `draw.js` e collega il checkbox "Griglia" e "Disegni" del pannello layer. Verifica a mano: disegno visibile in due browser aperti con lo stesso PIN; righello mostra distanza e azimut.
- [ ] **Step 6: Commit** `feat: drawings, UTM grid and ruler`

### Task 9: Pagina telefono con push GPS

**Files:**
- Create: `track.html`, `js/track.js`, `tests/track.test.js`

**Interfaces:**
- Consumes: `connect` (Task 6), `CALLSIGNS` (Task 1).
- NB: la pagina telefono scrive in `pending/<callsign>` (non in `units/`) e ha come campi di input fazione (REDFOR/BLUFOR/NEUTRALE) e nome squadra (testo libero), salvati in localStorage.
- Produces (`track.js`): `buildUnitUpdate(pos: { coords: { latitude, longitude, accuracy } }, now: number, prev?: Unit): Unit` → `{ lat, lon, acc, ts: now, source: "gps", status: prev?.status ?? "", note: prev?.note ?? "" }`; `describeGeoError(code: 1|2|3): string` (italiano: permesso negato, posizione non disponibile, timeout).

- [ ] **Step 1: Test che falliscono**: `buildUnitUpdate` con coordinate note produce `source "gps"` e conserva `status`/`note` precedenti; `describeGeoError(1)` contiene "permesso".
- [ ] **Step 2:** `node --test tests/track.test.js`; Expected: FAIL.
- [ ] **Step 3:** Implementa `track.js` e `track.html` (campi PIN e callsign da `CALLSIGNS`, pulsante Avvia/Ferma): `navigator.geolocation.watchPosition` con push al massimo ogni ~10 s, `navigator.wakeLock.request("screen")` se disponibile, stato a schermo (ultimo invio, precisione, errori da `describeGeoError`, PIN errato = nessun dato visibile con messaggio).
- [ ] **Step 4:** `node --test`; Expected: PASS.
- [ ] **Step 5:** Verifica a mano da telefono sulla pagina pubblicata (Task 10): la pedina compare e si aggiorna sulla console; negare il permesso mostra il motivo e non invia nulla.
- [ ] **Step 6: Commit** `feat: phone GPS tracker page`

### Task 10: Pubblicazione e documentazione

**Files:**
- Create/Modify: `README.md`

- [ ] **Step 1:** README: scopo, setup Firebase (regole `{ "rules": { ".read": false, ".write": false, "ops": { "$pin": { ".read": true, ".write": true } } } }`), uso console e telefono, nota su cosa è pubblico (KML, overlay) e cosa no (OPORD, PIN).
- [ ] **Step 2:** `node --test`; Expected: tutti i test PASS. `git status` non mostra OPORD, PDF, `progetto_esempio` né PIN (`git grep -n 1234567890` → nessun risultato).
- [ ] **Step 3:** Conferma con l'utente, poi `git push -u origin main`; in GitHub → Settings → Pages → Source: GitHub Actions.
- [ ] **Step 4:** Verifica a mano sul sito pubblicato: console e telefono con lo stesso PIN.
- [ ] **Step 5: Commit** `docs: README and deployment notes`
