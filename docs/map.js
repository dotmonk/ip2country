// Leaflet map that follows the janus green theme.
//
// Leaflet owns the DOM inside `host`. The janus renderer leaves live nodes
// passed as template values untouched, so App puts `${countryMap.host}` in
// its template and the map survives re-renders.
//
// Leaflet itself is loaded as a classic script in index.html (global `L`).

// Keyless OSM tiles; the theme look comes from CSS filters below.
// Usage policy: https://operations.osmfoundation.org/policies/tiles/
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const WORLD_CENTER = [20, 0];
const WORLD_ZOOM = 1;
const COUNTRY_ZOOM = 4;

const mapStylesheet = `
.ip2c-map {
  height: 340px;
  border-radius: var(--janus-radius);
  border: 1px solid var(--janus-border);
  overflow: hidden;
  background: var(--janus-raised);
  font-family: var(--janus-font);
}

.ip2c-map.leaflet-container {
  background: var(--janus-raised);
}

/* Recolour OSM tiles toward the green palette (dark = inverted). */
.ip2c-map[data-theme="dark"] .leaflet-tile-pane {
  filter: grayscale(1) invert(1) contrast(0.78) sepia(0.6) hue-rotate(65deg)
    saturate(1.6);
}
.ip2c-map[data-theme="light"] .leaflet-tile-pane {
  filter: grayscale(1) brightness(1.04) sepia(0.25) hue-rotate(70deg)
    saturate(1.3);
}

.ip2c-map .leaflet-bar {
  border: 1px solid var(--janus-border);
  border-radius: var(--janus-radius);
  box-shadow: var(--janus-shadow);
}
.ip2c-map .leaflet-bar a {
  background: var(--janus-surface);
  color: var(--janus-text);
  border-bottom-color: var(--janus-border);
}
.ip2c-map .leaflet-bar a:hover,
.ip2c-map .leaflet-bar a:focus {
  background: var(--janus-raised);
  color: var(--janus-accent);
}
.ip2c-map .leaflet-bar a.leaflet-disabled {
  background: var(--janus-surface);
  color: var(--janus-text-muted);
  opacity: 0.5;
}

.ip2c-map .leaflet-control-attribution {
  background: color-mix(in oklab, var(--janus-surface) 80%, transparent);
  color: var(--janus-text-muted);
}
.ip2c-map .leaflet-control-attribution a {
  color: var(--janus-accent);
}

.ip2c-map .leaflet-tooltip {
  background: var(--janus-surface);
  color: var(--janus-text);
  border: 1px solid var(--janus-border-strong);
  border-radius: var(--janus-radius);
  box-shadow: var(--janus-shadow);
  font-size: 0.85rem;
}
.ip2c-map .leaflet-tooltip-top::before {
  border-top-color: var(--janus-border-strong);
}

/* SVG paths: CSS beats Leaflet's presentation attributes. */
.ip2c-map .ip2c-marker {
  stroke: var(--janus-accent);
  fill: var(--janus-accent);
  fill-opacity: 0.35;
}
.ip2c-map .ip2c-marker-dot {
  stroke: var(--janus-surface);
  fill: var(--janus-accent);
  fill-opacity: 1;
}
`;

const ensureMapStylesheet = () => {
  if (document.getElementById("ip2c-map-style")) {
    return;
  }
  const style = document.createElement("style");
  style.id = "ip2c-map-style";
  style.textContent = mapStylesheet;
  document.head.appendChild(style);
};

const lightQuery = window.matchMedia("(prefers-color-scheme: light)");
const reducedMotionQuery = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);

// Mirrors theme.js: dark unless forced light, or system mode on a light OS.
const effectiveTheme = () => {
  const forced = document.documentElement.dataset.janusTheme;
  if (forced === "light" || forced === "dark") {
    return forced;
  }
  return lightQuery.matches ? "light" : "dark";
};

export class CountryMap {
  constructor() {
    ensureMapStylesheet();
    this.host = document.createElement("div");
    this.host.className = "ip2c-map";
    this.host.setAttribute("role", "region");
    this.host.setAttribute("aria-label", "Map of the resolved country");
    this.map = null;
    this.markers = null;
    this.pending = null;

    // Leaflet needs a measured container; wait until the host has a size.
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.host.isConnected || this.host.clientWidth === 0) return;
      if (!this.map) {
        this.init();
      } else {
        this.map.invalidateSize();
      }
    });
    this.resizeObserver.observe(this.host);
  }

  init() {
    if (typeof L === "undefined") {
      this.host.textContent = "Map unavailable (Leaflet failed to load)";
      return;
    }
    this.map = L.map(this.host, {
      center: WORLD_CENTER,
      zoom: WORLD_ZOOM,
      minZoom: 1,
      worldCopyJump: true,
      scrollWheelZoom: false,
    });
    L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(
      this.map,
    );
    this.markers = L.layerGroup().addTo(this.map);

    this.applyTheme();
    new MutationObserver(() => this.applyTheme()).observe(
      document.documentElement,
      { attributes: true, attributeFilter: ["data-janus-theme"] },
    );
    lightQuery.addEventListener("change", () => this.applyTheme());

    if (this.pending) {
      this.show(this.pending);
      this.pending = null;
    }
  }

  applyTheme() {
    this.host.dataset.theme = effectiveTheme();
  }

  /** Show a resolveIpDetails() result; anything without coordinates resets to the world view. */
  show(result) {
    if (!this.map) {
      this.pending = result;
      return;
    }
    this.markers.clearLayers();
    const animate = !reducedMotionQuery.matches;

    if (
      !result ||
      typeof result.lat !== "number" ||
      typeof result.lon !== "number"
    ) {
      this.map.setView(WORLD_CENTER, WORLD_ZOOM, { animate });
      return;
    }

    const position = [result.lat, result.lon];
    L.circleMarker(position, {
      radius: 22,
      weight: 2,
      className: "ip2c-marker",
      interactive: false,
    }).addTo(this.markers);
    L.circleMarker(position, {
      radius: 5,
      weight: 2,
      className: "ip2c-marker-dot",
    })
      .bindTooltip(result.description || result.code, {
        direction: "top",
        offset: [0, -6],
        permanent: true,
      })
      .addTo(this.markers);

    if (animate) {
      this.map.flyTo(position, COUNTRY_ZOOM, { duration: 1.2 });
    } else {
      this.map.setView(position, COUNTRY_ZOOM, { animate: false });
    }
  }
}
