# Mappa tattica Ex. Sea Joker 2026 — Design

## Obiettivo
Console web per il Comando (TOC/ROC) di una milsim softair: mappa interattiva con cartine
(ORTO10K, CTR10K) in overlay su satellite reale, punti dal KML, pedine delle unità in
tempo reale (inserimento manuale da coordinate radio o push GPS dal telefono), segnalini
e disegni tattici. Hosting gratuito (GitHub Pages) + Firebase Realtime Database (piano Spark).

## Vincoli e decisioni
- Repo pubblico `albertotra/mappa_exe_sea_joker` con codice, KML e overlay già allineati.
  Non committati: OPORD, PDF originali, `files/progetto_esempio/` (vedi `.gitignore`).
- Stack: HTML + ES modules, nessun build step. Librerie da CDN con versione fissata:
  Leaflet, milsymbol, proj4 (UTM), mgrs, Firebase compat SDK.
- Lingua UI: italiano. Uso principale: desktop/tablet al TOC.
- Un solo PIN condiviso. Il PIN diventa parte del percorso dati (`/ops/<PIN>`); le regole
  Firebase negano ogni lettura/scrittura fuori da `/ops/<PIN>` e il listing di `/ops`.
  Con un solo PIN la pagina telefono non è limitata dalle regole a scrivere solo la propria
  unità: la restrizione è solo lato client. Accettato per questo contesto.
- Il PIN protegge i dati live, non KML e overlay del repo pubblico (leggibili da chiunque).
- OPORD: coordinate ufficiali WGS84. UTM/MGRS sono supportati come input/conversione.

## Componenti
- `index.html` — console Comando con tre **tab** (MAPPA · MEDEVAC · OBIETTIVI), vedi sezione Tab.
  Tab MAPPA: pannello sinistro con layer, unità, punti, coordinate e strumenti.
- `track.html` — pagina telefono: PIN + callsign, push GPS ogni ~10 s, `wakeLock`,
  mostra stato e precisione. Nessuna mappa.
- `js/`: `map` · `layers` · `kml` · `coords` · `units` · `draw` · `grid-ruler` · `db` · `config` ·
  `tabs` · `medevac` · `objectives` (logica pura testabile + UI)
- `data/`: `trazzonara.kml`, `orto10k.webp`, `ctr10k.webp` (+ sidecar JSON con i 4 angoli
  o punti di controllo).
- `tools/`: script di conversione PDF → immagine e georeferenziazione con punti di controllo
  (usa punti del KML riconoscibili sulle cartine). Eseguito una volta, output committato.
- `.github/workflows/static.yml` — deploy Pages come nell'esempio.

## Pannello layer (richiesta esplicita)
Sezione "LAYER" con checkbox e nome, tutte attivabili/disattivabili al volo:
- **Base** (radio): Satellite Esri (default), OpenStreetMap.
- **Cartine** (checkbox + slider opacità ciascuna): `ORTO10K`, `CTR10K`. Si possono
  spegnere entrambe e restare sul solo satellite. Pulsante rapido "Solo satellite".
- **KML** (checkbox per gruppo): punti di interesse, SAFEHOUSE, strade/route, settori,
  limite campo.
- **Operativi** (checkbox): unità, segnalini manuali, disegni, griglia UTM/MGRS.
Stato layer/opacità salvato in `localStorage` (per-dispositivo, con try/catch).

**Posizioni indipendenti dagli overlay.** Segnalini manuali, pedine e disegni sono salvati
come lat/lon WGS84 e non dipendono dalle cartine: spegnere o ricalibrare un overlay non li
sposta mai. Se l'admin sposta un punto, cambia solo il suo lat/lon.

## Funzioni
- **Pedine** APP-6 (milsymbol), amico in blu. Callsign dall'elenco OPORD (VECTOR, ECHO,
  PHANTOM 1-2, STRIKER A-E), stato (in contatto, neutralizzato, ecc.), nota, ora ultimo
  aggiornamento; grigie se il dato supera una soglia configurabile (default 15 min).
- **Inserimento coordinate**: un campo che rileva WGS84 decimale/gradi-primi, UTM, MGRS;
  oppure click sulla mappa. Mostra sempre le conversioni nei tre formati.
- **Segnalini** POI e squadre posizionati a mano; **disegno** di linee, frecce, zone con etichetta.
- **Griglia UTM/MGRS e righello** (distanza e azimut).
- **Import KML** all'avvio da `data/trazzonara.kml` (Point, LineString, Polygon, stili per tipo).

## Dati Firebase (`/ops/<PIN>/`)
`units/<callsign>` {lat, lon, acc, ts, status, note, source: manual|gps, faction, squad} ·
`pending/<callsign>` {lat, lon, acc, ts, faction, squad} (posizioni GPS in attesa) ·
`markers/<id>` · `shapes/<id>` · `medevac/<id>` · `objectives/<id>` · `meta` (soglia dato vecchio, ecc.).
**Il telefono scrive solo in `pending/`.** La console mostra ogni nuova posizione come notifica con
Accetta / Rifiuta (con anteprima fantasma sulla mappa): Accetta la copia in `units/` e svuota il pending,
Rifiuta lo cancella. Un nuovo push dello stesso callsign sostituisce quello in attesa.
`faction` e `squad` sono campi di input compilati da chi usa il telefono (e modificabili dalla console):
faction a scelta tra REDFOR, BLUFOR, NEUTRALE, squad nome libero. La faction decide l'affiliazione APP-6.

## Tab (dopo l'inserimento del PIN)
Barra di tab sempre visibile: **MAPPA · MEDEVAC · OBIETTIVI**, selezione salvata nell'URL (`#mappa`,
`#medevac`, `#obiettivi`). Tutte le tab restano collegate al database anche quando non sono visibili.
Le notifiche di posizione GPS (accetta/rifiuta) sono globali: compaiono in ogni tab, e la tab MAPPA mostra
un contatore delle notifiche in attesa. Tornando su MAPPA si chiama `invalidateSize()` di Leaflet.
Fazioni (invariate): **REDFOR**, **BLUFOR**, **NEUTRALE**. Colori: REDFOR verde `#4dff88`, BLUFOR blu `#4da6ff`,
NEUTRALE grigio `#b0b0b0`, nessuno/libero bianco.

### Tab MEDEVAC — log dei passaggi
Un evento per passaggio dalla safehouse: `medevac/<id>` = `{ safehouse, faction, black, yellow, ts, note }`.
**black** = morti, **yellow** = feriti. Form: safehouse (le 11 SAFEHOUSE del KML + "Altra…" a testo libero),
fazione, black e yellow (interi 0-99, almeno uno ≥ 1), orario (default adesso, modificabile), nota.
Mostra: (1) totali per fazione (black, yellow, totale); (2) tabella safehouse × fazione con black/yellow;
(3) elenco cronologico degli eventi con modifica e cancellazione (con conferma).
Valori non interi, negativi o NaN vengono rifiutati con messaggio; orario futuro oltre 24 h rifiutato.

### Tab OBIETTIVI — conquiste
Solo obiettivi creati a mano: `objectives/<id>` = `{ name, lat, lon, createdTs, captures: { <cid>: { faction, squad, ts } } }`.
Creazione: nome + posizione (stesso campo coordinate WGS84/UTM/MGRS/quadrante, oppure "usa punto selezionato
sulla mappa"). Una **conquista** registra fazione, nome squadra (testo libero, suggerimenti dalle squadre
delle unità) e orario (default adesso, modificabile). **Storico completo**: ogni conquista resta; il possessore
attuale è quella con `ts` più recente (a parità di `ts` vince l'ultima inserita); senza conquiste l'obiettivo è "libero".
Elenco con obiettivo, possessore (colore fazione), squadra, orario, quadrante; riga espandibile con lo storico;
si può correggere/cancellare una conquista o l'obiettivo. Sulla tab MAPPA c'è il layer "Obiettivi" (checkbox)
con un segnalino colorato per possessore ed etichetta con nome.

## Setup Firebase (da fare dall'utente)
1. https://console.firebase.google.com → **Aggiungi progetto** (es. `sea-joker-26`), Analytics disattivato.
2. **Build → Realtime Database → Crea database**, regione `europe-west1`, modalità **bloccata**.
3. Scheda **Regole**, incolla e pubblica:
   ```json
   { "rules": { ".read": false, ".write": false,
       "ops": { "$pin": { ".read": true, ".write": true } } } }
   ```
   (`/ops` non è leggibile in elenco; serve conoscere il PIN. Scegli un PIN lungo e non banale.)
4. **Impostazioni progetto → Le tue app → Web (`</>`)** → registra l'app (senza Hosting) e copia
   `firebaseConfig`, incluso `databaseURL`. Le chiavi web non sono segrete: protegge il PIN.
5. Incolla la config in `js/config.js` (lo faccio io quando me la passi).

## Errori e test
- Medevac e obiettivi: funzioni pure (`medevacTotals`, `medevacBySafehouse`, `validateMedevac`, `currentOwner`, `sortedCaptures`) con test Node, inclusi conteggi non validi, nessuna conquista e `ts` uguali.
- Firebase non raggiungibile: banner "OFFLINE", ultime posizioni note restano a schermo.
- Coordinate non valide: messaggio inline, nessun inserimento.
- Test unitari (Node) per `coords` (WGS84↔UTM↔MGRS, parsing formati) e parser KML;
  verifica manuale dei layer e del push GPS su telefono prima dell'esercitazione.

## Aperto
- Punti di controllo per georeferenziare le cartine (il KML ha i punti, serve identificarli
  sulle cartine) — da definire in fase di implementazione.
- Dimensioni finali delle immagini overlay (target ~2-3 MB ciascuna).
