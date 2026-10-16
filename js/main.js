import { createMap } from "./map.js";
import { parseKml } from "./kml.js";
import { loadState, buildKmlLayers, buildOverlayImages, initLayerPanel } from "./layers.js";

const { map, baseLayers } = createMap("map");

const [kmlText, overlayMeta] = await Promise.all([
  fetch("data/trazzonara.kml").then((r) => r.text()),
  fetch("data/overlays.json").then((r) => r.json())
]);
const kml = buildKmlLayers(parseKml(kmlText));
const images = buildOverlayImages(overlayMeta);

const operative = { units: L.layerGroup(), markers: L.layerGroup(), shapes: L.layerGroup(), "utm-grid": L.layerGroup(), quadrants: L.layerGroup() };

initLayerPanel({
  container: document.getElementById("panel-layers"),
  map, baseLayers, state: loadState(),
  sections: [
    { title: "CARTINE", items: [
      { id: "orto10k", label: overlayMeta.orto10k.label, layer: images.orto10k, opacity: true },
      { id: "ctr10k", label: overlayMeta.ctr10k.label, layer: images.ctr10k, opacity: true } ] },
    { title: "KML", items: [
      { id: "kml-poi", label: "Punti di interesse", layer: kml["kml-poi"] },
      { id: "kml-safehouse", label: "SAFEHOUSE", layer: kml["kml-safehouse"] },
      { id: "kml-strada", label: "Strade / route", layer: kml["kml-strada"] },
      { id: "kml-settore", label: "Settori", layer: kml["kml-settore"] },
      { id: "kml-zona", label: "Zone", layer: kml["kml-zona"] },
      { id: "kml-limite", label: "Limite campo", layer: kml["kml-limite"] } ] },
    { title: "OPERATIVI", items: [
      { id: "units", label: "Unità", layer: operative.units },
      { id: "markers", label: "Segnalini", layer: operative.markers },
      { id: "shapes", label: "Disegni", layer: operative.shapes },
      { id: "quadrants", label: "Quadranti A-M / 1-11", layer: operative.quadrants },
      { id: "utm-grid", label: "Griglia UTM 1 km", layer: operative["utm-grid"] } ] }
  ]
});

window.__app = { map, baseLayers, operative };
