import { MAP_CENTER } from "./config.js";

export function createMap(containerId) {
  const baseLayers = {
    "Satellite": L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "Esri World Imagery" }),
    "OpenStreetMap": L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      { maxZoom: 19, attribution: "© OpenStreetMap" })
  };
  const map = L.map(containerId, { zoomControl: true, maxZoom: 19 }).setView(MAP_CENTER, 15);
  baseLayers["Satellite"].addTo(map);
  return { map, baseLayers };
}
