# Mappa tattica Ex. Sea Joker 2026

Console web per il Comando (TOC/ROC): cartine ORTO10K e CTR10K sovrapposte al satellite, punti del KML,
pedine delle unità in tempo reale, segnalini, disegni, griglia UTM e quadranti A-M / 1-11.
Sito statico (GitHub Pages) + Firebase Realtime Database.

## Uso

- **Console:** `index.html`. Alla prima apertura chiede il PIN (resta solo nel browser). Si può aprire anche
  con `index.html?pin=XXXX`: il PIN viene salvato e tolto dall'URL.
- **Telefono:** `track.html`. PIN, callsign, fazione e nome squadra, poi *Avvia*. Ogni posizione arriva sulla
  console come **notifica da accettare o rifiutare**; solo se accettata la pedina si sposta.
- **Posizione a mano:** campo "Posizione" con WGS84 (decimale o gradi/primi), UTM (`33T 700500 4500500`),
  MGRS o quadrante (`F5`), oppure click sulla mappa. Poi "Posiziona unità" o "Aggiungi segnalino".
- **Layer:** pannello a sinistra, ogni cartina ha checkbox e opacità; "Solo satellite" le spegne tutte.
  Unità, segnalini e disegni sono salvati in lat/lon e non dipendono dalle cartine.
- **Quadranti:** celle da 250 m, colonne A (est) - M (ovest), righe 1 (nord) - 11. Visibili con il layer
  "Quadranti"; a zoom alto compaiono i nomi delle celle.

## Tab

Dopo il PIN la console ha tre tab (l'URL ricorda quella aperta: `#mappa`, `#medevac`, `#obiettivi`).

- **MAPPA:** tutto quanto sopra. Le notifiche di posizione GPS compaiono in ogni tab e un contatore sulla tab MAPPA le segnala.
- **MEDEVAC:** log dei passaggi dai punti di recupero (11 SAFEHOUSE verdi + 22 LZ blu T1–T12 / A1–A10, letti dai KML). Ogni evento ha safehouse, fazione, **black** (morti), **yellow** (feriti),
  orario modificabile e nota. Mostra totali per fazione, tabella safehouse × fazione ed elenco con modifica/elimina.
- **EXPORT EXCEL:** il bottone nell'header scarica `report-sea-joker-AAAAMMGG-HHMM.xlsx` con 4 fogli: Riepilogo, Medevac log,
  Medevac per safehouse, Obiettivi (storico conquiste con quadrante e MGRS). ExcelJS viene caricato da CDN al primo click.
- **OBIETTIVI:** obiettivi creati a mano (nome + posizione). Ogni conquista registra fazione, squadra e orario; lo storico
  resta completo e il possessore attuale è l'ultima conquista. Sulla mappa il layer "Obiettivi" mostra una bandierina
  col colore del possessore.

Fazioni: REDFOR (verde), BLUFOR (blu), NEUTRALE (grigio).

## Sviluppo locale

```bash
npm install          # solo per i test
npm test             # node --test
python3 -m http.server 8000   # poi http://localhost:8000
```

## Cartine

`tools/georef.py` converte i PDF in WebP georeferenziati usando la griglia UTM 33N stampata
(`python3 tools/georef.py files/ORTO10K_JOKER_A3custom.pdf orto10k --transparent-white`). Richiede
`pdftoppm`, GDAL, Pillow, numpy, scipy. L'output sta in `data/`.

## Firebase

Realtime Database, regole:

```json
{ "rules": { ".read": false, ".write": false, "ops": { "$pin": { ".read": true, ".write": true } } } }
```

Dati sotto `/ops/<PIN>/`: `units`, `pending` (posizioni GPS in attesa), `markers`, `shapes`, `meta`
(`staleMinutes`: soglia dato vecchio, default 15), `medevac` e `objectives` (con `captures`).

## Cosa è pubblico

Il repo è pubblico: KML e cartine sono leggibili da chiunque abbia l'URL. L'OPORD, i PDF originali e il PIN
**non** sono nel repo. Il PIN protegge solo i dati live; con un solo PIN condiviso chiunque lo conosca può
scrivere su `units`, `markers` e `shapes`.

## KML delle due fazioni
`data/trazzonara.kml` (REDFOR) e `data/blu.kml` (BLUFOR, estratto dal KMZ) sono caricati insieme (`js/sources.js`). Per aggiornarli sostituisci i file.
Gli **obiettivi** sono creati in automatico: BLU = LAGO, CASTELLO, FIUME, COLLINA; REDFOR = punti di interesse del KML (FOB escluso). Restano aggiungibili a mano.
