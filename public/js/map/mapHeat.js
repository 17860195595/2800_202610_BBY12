/**
 * @file mapHeat.js
 * Temperature heatmap via Leaflet.heat (canvas blur). First paint uses mock hourly
 * data on MOCK_MAP_LOCATIONS; after fetchWeatherGrid → setLiveHeatStations, the layer
 * swaps to live station temps.
 *
 * Script order: Leaflet → leaflet.heat → mockMapLocations → mapUtils → modules (pages/index.js).
 *
 * Public: createMapHeatController(map), setLiveHeatStations(stations|null).
 *
 * Implementation note: each refresh removes and re-adds L.heatLayer because leaflet-heat’s
 * redraw can skip updates when rAF is already queued or the map is animating — replacing
 * the layer guarantees a fresh canvas. Intensity uses a fixed °C band (ABS_TEMP_RANGE)
 * so colours read as absolute temperature, not “hottest hour of the day”.
 * @author Jiahao
 */

import { MOCK_MAP_LOCATIONS } from "../data/mockMapLocations.js";
import { getSpotMockHourly, parseMapTimeHour } from "./mapUtils.js";

var liveHeatStations = null;

function setLiveHeatStations(stations) {
    if (Array.isArray(stations) && stations.length) {
        liveHeatStations = stations;
    } else {
        liveHeatStations = null;
    }
}

function getMockHeatStationsAtHour(hour) {
    if (hour < 0) hour = 0;
    if (hour > 23) hour = 23;

    if (liveHeatStations) {
        var liveOut = [];
        for (var li = 0; li < liveHeatStations.length; li++) {
            var st = liveHeatStations[li];
            if (
                !st ||
                typeof st.lat !== "number" ||
                typeof st.lng !== "number" ||
                !Array.isArray(st.hourly24)
            ) {
                continue;
            }
            var ls = st.hourly24[hour];
            if (!ls || typeof ls.tempC !== "number" || isNaN(ls.tempC)) continue;
            liveOut.push({ lat: st.lat, lng: st.lng, tempC: ls.tempC });
        }
        if (liveOut.length) return liveOut;
    }

    var rows =
        typeof MOCK_MAP_LOCATIONS !== "undefined" && Array.isArray(MOCK_MAP_LOCATIONS)
            ? MOCK_MAP_LOCATIONS
            : [];
    var out = [];
    for (var i = 0; i < rows.length; i++) {
        var spot = rows[i];
        if (
            typeof spot.lat !== "number" ||
            typeof spot.lng !== "number" ||
            isNaN(spot.lat) ||
            isNaN(spot.lng)
        ) {
            continue;
        }
        var hourly = getSpotMockHourly(spot);
        var snap = hourly[hour];
        var t =
            snap && typeof snap.tempC === "number" && !isNaN(snap.tempC) ? snap.tempC : null;
        if (t == null) {
            continue;
        }
        out.push({ lat: spot.lat, lng: spot.lng, tempC: t });
    }
    return out;
}

/** Heat gradient keys: normalized temp in [0,1] vs ABS_TEMP_RANGE. */
var ABS_HEAT_GRADIENT = {
    0.0: "rgba(55, 48, 163, 0)",
    0.15: "rgba(59, 130, 246, 0.5)",
    0.35: "rgba(34, 211, 238, 0.6)",
    0.5: "rgba(52, 211, 153, 0.68)",
    0.65: "rgba(250, 204, 21, 0.78)",
    0.85: "rgba(249, 115, 22, 0.86)",
    1.0: "rgba(220, 38, 38, 0.92)",
};

/**
 * @param {number} hour 0–23
 * @returns {Object} Leaflet.heat options
 */
function getMockHeatLayerOptionsForHour(hour) {
    if (hour < 0) hour = 0;
    if (hour > 23) hour = 23;
    var dayness = Math.max(0, Math.min(1, Math.sin(((hour - 4) / 15) * Math.PI)));
    return {
        radius: 46,
        blur: 30,
        maxZoom: 18,
        minOpacity: 0.12 + dayness * 0.08,
        max: 1.0,
        gradient: ABS_HEAT_GRADIENT,
    };
}

var ABS_TEMP_RANGE = { min: 0, max: 35 };

/**
 * Inverse-distance interpolation: temperature at an arbitrary point from known stations.
 * w_i = 1 / (d_i^2 + eps); return sum(w_i * T_i) / sum(w_i).
 * @param {number} lat
 * @param {number} lng
 * @param {Array<{ lat: number, lng: number, tempC: number }>} stations
 * @returns {number} Interpolated °C
 * @author Jiahao
 */
function idwTempAt(lat, lng, stations) {
    if (!stations.length) {
        return NaN;
    }
    var eps = 1e-7;
    var num = 0;
    var den = 0;
    for (var i = 0; i < stations.length; i++) {
        var s = stations[i];
        var d2 =
            (lat - s.lat) * (lat - s.lat) + (lng - s.lng) * (lng - s.lng);
        var w = 1 / (d2 + eps);
        num += w * s.tempC;
        den += w;
    }
    return den > 0 ? num / den : stations[0].tempC;
}

/**
 * Soft hour-of-day scalar applied on top of the temperature-driven
 * intensity. With absolute-scale colors we want the °C value to dominate
 * the look, so the night-time dimming stays gentle ([0.55, 1.0]) instead
 * of crushing warm summer evenings down to nothing.
 *
 * @param {number} hour 0–23
 * @returns {number} Multiplier in [0.55, 1.0]
 * @author Jiahao
 */
function mockHeatDiurnalIntensityWeight(hour) {
    var sun = Math.max(0, Math.min(1, Math.sin(((hour - 4) / 15) * Math.PI)));
    return 0.55 + 0.45 * sun;
}

/**
 * Produce flat array of [lat, lng, intensity] for L.heatLayer (third component is weight).
 * Strategy:
 *   - For each station: one core point + rings of offset points (smoother blob per POI).
 *   - Over bounding box of all POIs: grid of IDW samples at lower weight.
 *   - Multiply every intensity by mockHeatDiurnalIntensityWeight(hour).
 * @param {number} hour 0–23
 * @returns {Array<Array<number>>}
 * @author Jiahao
 */
function buildMockHeatLatLngs(hour) {
    if (hour < 0) hour = 0;
    if (hour > 23) hour = 23;

    var stations = getMockHeatStationsAtHour(hour);
    if (!stations.length) {
        return [];
    }

    var range = ABS_TEMP_RANGE;
    var spanG = range.max - range.min;
    if (spanG < 0.15) {
        spanG = 0.15;
    }

    function normIntensity(tempC) {
        var x = (tempC - range.min) / spanG;
        return Math.max(0.06, Math.min(1, x));
    }

    var out = [];
    var i;
    var k;
    var ang;
    var rSmall = 0.0015;
    var rMed = 0.0028;

    for (i = 0; i < stations.length; i++) {
        var s = stations[i];
        var core = normIntensity(s.tempC);
        out.push([s.lat, s.lng, core]);

        for (k = 0; k < 14; k++) {
            ang = (k / 14) * Math.PI * 2;
            out.push([
                s.lat + Math.cos(ang) * rSmall * 0.95,
                s.lng + Math.sin(ang) * rSmall * 1.25,
                core * 0.62,
            ]);
        }
        for (k = 0; k < 10; k++) {
            ang = (k / 10) * Math.PI * 2 + 0.4;
            out.push([
                s.lat + Math.cos(ang) * rMed,
                s.lng + Math.sin(ang) * rMed * 1.25,
                core * 0.38,
            ]);
        }
    }

    // Compute bbox from whichever station source is active so the IDW
    // backfill grid (below) always covers the same area users see in pins.
    var bboxRows = liveHeatStations && liveHeatStations.length
        ? liveHeatStations
        : (typeof MOCK_MAP_LOCATIONS !== "undefined" && Array.isArray(MOCK_MAP_LOCATIONS)
            ? MOCK_MAP_LOCATIONS
            : []);
    var minLat = Infinity;
    var maxLat = -Infinity;
    var minLng = Infinity;
    var maxLng = -Infinity;
    for (i = 0; i < bboxRows.length; i++) {
        var sp = bboxRows[i];
        if (typeof sp.lat !== "number" || typeof sp.lng !== "number") continue;
        minLat = Math.min(minLat, sp.lat);
        maxLat = Math.max(maxLat, sp.lat);
        minLng = Math.min(minLng, sp.lng);
        maxLng = Math.max(maxLng, sp.lng);
    }
    if (isFinite(minLat)) {
        var pad = 0.032;
        minLat -= pad;
        maxLat += pad;
        minLng -= pad;
        maxLng += pad;
        var cols = 10;
        var gridR = 8;
        var dLat = (maxLat - minLat) / gridR;
        var dLng = (maxLng - minLng) / cols;
        for (var gr = 0; gr < gridR; gr++) {
            for (var gc = 0; gc < cols; gc++) {
                var clat = minLat + (gr + 0.5) * dLat;
                var clng = minLng + (gc + 0.5) * dLng;
                var t = idwTempAt(clat, clng, stations);
                var tc = Math.max(range.min, Math.min(range.max, t));
                out.push([clat, clng, normIntensity(tc) * 0.42]);
            }
        }
    }

    var diurnalW = mockHeatDiurnalIntensityWeight(hour);
    for (var pi = 0; pi < out.length; pi++) {
        out[pi][2] *= diurnalW;
    }

    return out;
}

/**
 * Factory: owns heat layer; replaces layer each refresh (leaflet-heat redraw).
 * @param {L.Map} map
 */
function createMapHeatController(map) {
    var mockHeatLayer = null;
    var visible = true;

    /**
     * @param {number} hour
     */
    function refresh(hour) {
        if (typeof L.heatLayer !== "function") {
            return;
        }
        if (hour < 0) hour = 0;
        if (hour > 23) hour = 23;
        var pts = buildMockHeatLatLngs(hour);
        if (mockHeatLayer) {
            map.removeLayer(mockHeatLayer);
            mockHeatLayer = null;
        }
        if (visible && pts.length) {
            mockHeatLayer = L.heatLayer(pts, getMockHeatLayerOptionsForHour(hour)).addTo(map);
        }
    }

    /**
     * @param {boolean} v
     */
    function setVisible(v) {
        visible = !!v;
        if (!visible && mockHeatLayer) {
            map.removeLayer(mockHeatLayer);
            mockHeatLayer = null;
        } else if (visible && !mockHeatLayer) {
            refresh(parseMapTimeHour());
        }
    }

    function isVisible() {
        return visible;
    }

    return { refresh: refresh, setVisible: setVisible, isVisible: isVisible };
}

export { createMapHeatController, setLiveHeatStations };
