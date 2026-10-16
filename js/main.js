import { createMap } from "./map.js";

const { map, baseLayers } = createMap("map");
window.__app = { map, baseLayers };
