/**
 * @file mapMarkers.js
 * Leaflet: seed pins (Local / Off), fountain markers. Clicks open mapSpotDetailPanel (lazy /api/risk).
 * @author Jiahao
 */

import { openMapSpotDetail } from "./mapSpotDetailPanel.js";
import { escapeHtmlMap } from "./mapUtils.js";

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

/** @type {L.Map|null} */
var mapMarkersActiveMap = null;
/** Layer for seed pins (Local). */
var seedSpotLayerGroup = null;
/** Fountain markers. */
var fountainLayerGroup = null;
/** @type {'off'|'local'} */
var currentBuildingMode = "local";

function addMockLocationMarkers(map) {
    mapMarkersActiveMap = map;
}

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
                escapeHtmlMap(label) +
                "</p>" +
                "</div>",
            { closeButton: true, autoPan: false }
        );
        marker.addTo(fountainLayerGroup);
    }
}

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

export {
    addMockLocationMarkers,
    renderSeedSpotPins,
    setBuildingsMode,
    addFountainMarkers,
    setFountainsVisible,
};
