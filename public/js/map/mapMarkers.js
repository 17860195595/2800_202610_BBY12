/**
 * @file mapMarkers.js
 * Leaflet markers for the map page.
 *
 *   - addMockLocationMarkers(map)         — captures the map reference for
 *                                            later layer creation. Does not
 *                                            place pins itself; renderSeedSpotPins
 *                                            owns Local mode.
 *   - renderSeedSpotPins(map, locations)  — Local mode: renders one green pin
 *                                            per seed location (the 100
 *                                            curated anchors). Each pin opens
 *                                            the detail panel for its own seed.
 *   - addFountainMarkers(map, fountains)  — small blue teardrops from /api/fountains.
 *
 * Click on any pin opens the spot detail panel; mapSpotDetail.js will
 * lazy-fetch /api/risk for that pin's coordinates so the user only ever
 * triggers a backend call when they actually look at a place.
 *
 * The previous "City" mode (every Vancouver building footprint centroid as a
 * clustered pin) was removed — the dataset is slow to fetch and the 100
 * curated seed locations are enough for the use case. Toggle bar now only
 * exposes Off / Local.
 *
 * @author Jiahao
 */

/**
 * Build a DivIcon with inline SVG (no extra HTTP request). className clears
 * default leaflet-div-icon border.
 * @returns {L.DivIcon}
 * @author Jiahao
 */
function createSpotDivIcon() {
    var w = 36;
    var h = 46;
    var html =
        '<div class="map-spot-marker" aria-hidden="true">' +
        '<svg class="map-spot-marker__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 46" width="' +
        w +
        '" height="' +
        h +
        '">' +
        '<path class="map-spot-marker__pin" d="M18 1.5C9.4 1.5 2.5 8.4 2.5 17c0 10.2 14.2 26.2 15.2 27.8.4.7 1.2.7 1.6 0C20.3 43.2 33.5 27.2 33.5 17 33.5 8.4 26.6 1.5 18 1.5z"/>' +
        '<circle class="map-spot-marker__dot" cx="18" cy="17" r="5.25"/>' +
        "</svg></div>";

    return L.divIcon({
        className: "map-spot-marker-wrap",
        html: html,
        iconSize: [w, h],
        iconAnchor: [w / 2, h],
        popupAnchor: [0, -h],
    });
}

/** Map reference captured during addMockLocationMarkers so the seed / fountain
 *  renderers can attach layers without re-threading the map instance
 *  through every call site. */
var mapMarkersActiveMap = null;
/** Layer for the 100 seed-spot pins (Local mode). */
var seedSpotLayerGroup = null;
/** Singleton layer group for fountain markers. */
var fountainLayerGroup = null;
/** Currently-selected building mode: 'off' | 'local'. */
var currentBuildingMode = "local";

/**
 * Capture the Leaflet map instance for use by the seed / fountain
 * renderers. Kept under the original name so pages/index.js does not have to
 * change call sites.
 *
 * @param {L.Map} map
 * @author Jiahao
 */
function addMockLocationMarkers(map) {
    mapMarkersActiveMap = map;
}

/**
 * Local mode: place one pin on every seed location in MOCK_MAP_LOCATIONS. No
 * /api/risk traffic happens here — clicks on each pin are what trigger the
 * lazy backend fetch (see mapSpotDetail.js → ensureSpotApiData).
 *
 * Idempotent: replaces any prior layer group on every call so a re-render
 * does not pile up duplicate markers.
 *
 * @param {L.Map} [map] Optional; falls back to the captured active map.
 * @param {Array<Object>} locations seed spots from MOCK_MAP_LOCATIONS
 * @author Jiahao
 */
function renderSeedSpotPins(map, locations) {
    var leafletMap = map || mapMarkersActiveMap;
    if (leafletMap && !mapMarkersActiveMap) {
        mapMarkersActiveMap = leafletMap;
    }
    if (!leafletMap) return;

    if (seedSpotLayerGroup) {
        leafletMap.removeLayer(seedSpotLayerGroup);
        seedSpotLayerGroup = null;
    }
    if (!Array.isArray(locations) || !locations.length) return;

    var icon = createSpotDivIcon();
    var group = L.layerGroup();
    var rendered = 0;

    for (var i = 0; i < locations.length; i++) {
        var spot = locations[i];
        if (
            !spot ||
            typeof spot.lat !== "number" ||
            typeof spot.lng !== "number" ||
            isNaN(spot.lat) ||
            isNaN(spot.lng)
        ) {
            continue;
        }
        var marker = L.marker([spot.lat, spot.lng], {
            icon: icon,
            title: spot.name || "Location",
        });
        (function (s) {
            marker.on("click", function () {
                openMapSpotDetail(s);
            });
        })(spot);
        marker.addTo(group);
        rendered++;
    }

    if (rendered > 0 && currentBuildingMode === "local") {
        group.addTo(leafletMap);
    }
    // Always keep the prepared layer around even when the current mode is
    // off — toggling back to Local then re-attaches without rebuilding.
    seedSpotLayerGroup = group;
}

/**
 * Single source of truth for which pin layer (if any) is on the map. Modes:
 *   'off'   — no pins
 *   'local' — 100 seed spot pins (LayerGroup)
 *
 * The legacy 'city' mode (Vancouver-wide building cluster) was removed; any
 * stale value coming from older persisted prefs is coerced to 'local' so the
 * map is never left blank.
 *
 * Triggered from the floating toggle bar (mapToggleBar.js).
 *
 * @param {'off'|'local'} mode
 * @param {Array<Object>} [locations] seed spots, used when first switching modes
 * @author Jiahao
 */
function setBuildingsMode(mode, locations) {
    if (mode !== "off" && mode !== "local") {
        mode = "local";
    }
    currentBuildingMode = mode;
    if (!mapMarkersActiveMap) return;

    if (seedSpotLayerGroup && mapMarkersActiveMap.hasLayer(seedSpotLayerGroup)) {
        mapMarkersActiveMap.removeLayer(seedSpotLayerGroup);
    }

    if (mode === "local") {
        if (seedSpotLayerGroup) {
            mapMarkersActiveMap.addLayer(seedSpotLayerGroup);
        } else if (Array.isArray(locations) && locations.length) {
            renderSeedSpotPins(mapMarkersActiveMap, locations);
        }
    }
}

/**
 * @returns {'off'|'local'}
 * @author Jiahao
 */
function getBuildingsMode() {
    return currentBuildingMode;
}

/**
 * Compact teardrop icon for fountains. Smaller than the location pin and uses
 * a distinct blue palette so it reads as "water" at a glance.
 * @returns {L.DivIcon}
 * @author Jiahao
 */
function createFountainDivIcon() {
    var w = 22;
    var h = 28;
    var html =
        '<div class="map-fountain-marker" aria-hidden="true">' +
        '<svg class="map-fountain-marker__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 28" width="' +
        w +
        '" height="' +
        h +
        '">' +
        '<path class="map-fountain-marker__drop" d="M11 1.5C6.6 6.5 3 11.4 3 15.6 3 20.3 6.6 24 11 24s8-3.7 8-8.4c0-4.2-3.6-9.1-8-14.1z"/>' +
        '<circle class="map-fountain-marker__dot" cx="11" cy="16" r="2.4"/>' +
        "</svg></div>";

    return L.divIcon({
        className: "map-fountain-marker-wrap",
        html: html,
        iconSize: [w, h],
        iconAnchor: [w / 2, h - 4],
        popupAnchor: [0, -h + 4],
    });
}

/**
 * Render every drinking-fountain returned by /api/fountains as a small blue
 * teardrop marker. Re-callable: clears any prior layer group before adding new
 * markers so a re-fetch does not double the pins.
 *
 * @param {L.Map} map
 * @param {Array<{ lat: number, lng: number, location: string|null }>} fountains
 * @author Jiahao
 */
function addFountainMarkers(map, fountains) {
    if (!Array.isArray(fountains) || !fountains.length) {
        return;
    }
    if (fountainLayerGroup) {
        fountainLayerGroup.clearLayers();
    } else {
        fountainLayerGroup = L.layerGroup().addTo(map);
    }

    var icon = createFountainDivIcon();

    for (var i = 0; i < fountains.length; i++) {
        var f = fountains[i];
        if (
            typeof f.lat !== "number" ||
            typeof f.lng !== "number" ||
            isNaN(f.lat) ||
            isNaN(f.lng)
        ) {
            continue;
        }

        var label = f.location ? f.location : "Drinking fountain";
        var marker = L.marker([f.lat, f.lng], {
            icon: icon,
            title: label,
            keyboard: false,
        });
        marker.bindPopup(
            '<div class="map-fountain-popup">' +
                '<strong class="map-fountain-popup__title">Drinking fountain</strong>' +
                '<p class="map-fountain-popup__body">' +
                escapeFountainText(label) +
                "</p>" +
                "</div>",
            { closeButton: true, autoPan: false }
        );
        marker.addTo(fountainLayerGroup);
    }
}

/**
 * Show / hide the fountain layer in place. Wired from the toggle bar.
 * No-op until addFountainMarkers has built the layer.
 * @param {boolean} visible
 * @author Jiahao
 */
function setFountainsVisible(visible) {
    if (!mapMarkersActiveMap || !fountainLayerGroup) return;
    if (visible) {
        if (!mapMarkersActiveMap.hasLayer(fountainLayerGroup)) {
            mapMarkersActiveMap.addLayer(fountainLayerGroup);
        }
    } else if (mapMarkersActiveMap.hasLayer(fountainLayerGroup)) {
        mapMarkersActiveMap.removeLayer(fountainLayerGroup);
    }
}

/**
 * Tiny escape helper local to the fountain popup.
 * @param {string} s
 * @returns {string}
 * @author Jiahao
 */
function escapeFountainText(s) {
    return String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
