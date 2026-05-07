/**
 * @file mapHeat.js
 * Mock temperature heatmap using Leaflet.heat (L.heatLayer): canvas blur, not vector grid cells.
 *
 * Dependencies (script order in index.html):
 *   Leaflet → leaflet.heat → mockMapLocations.js → mapUtils.js → this file
 *
 * Public API:
 *   createMapHeatController(map) → { refresh(hour) }
 *   Keeps the heat layer instance in a closure so we do not rely on globals for layer state.
 *
 * ----------------------------------------------------------------------------
 * Hard parts & how we verified behavior (including review with Claude AI)
 * ----------------------------------------------------------------------------
 * 1) Stale canvas after setLatLngs()
 *    Leaflet.heat’s redraw() defers work with requestAnimationFrame and skips if a frame is
 *    already queued or if map._animating — so calling setLatLngs() + redraw() often left the
 *    old image on screen. Fix: remove the layer and instantiate a fresh L.heatLayer each refresh.
 *    We confirmed this by reading the unminified leaflet-heat.js source (mourner/simpleheat pipeline).
 *
 * 2) “No visible change” when scrubbing the time slider
 *    Per-hour min/max normalization made every hour fill the same color range. Fix: scale
 *    intensities with a single global min/max across all hours (getMockHeatGlobalTempRange).
 *    Separately, hour-driven gradient/max/minOpacity (getMockHeatLayerOptionsForHour) makes
 *    night vs day obviously different even when blur hides small numeric deltas.
 *
 * 3) IDW for filler samples
 *    Inverse-distance weighting (power 2, epsilon against divide-by-zero) is standard for
 *    scattered stations; weights are in degree space, which is acceptable at city scale for mock UI.
 * @author Jiahao
 */

(function (global) {
    "use strict";

    /**
     * Collect station lat/lng and the temperature at the chosen hour (from mock hourly arrays).
     * @param {number} hour 0–23
     * @returns {Array<{ lat: number, lng: number, tempC: number }>}
     * @author Jiahao
     */
    function getMockHeatStationsAtHour(hour) {
        if (hour < 0) hour = 0;
        if (hour > 23) hour = 23;
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
            var hourly = getSpotHourly(spot);
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

    /**
     * Build L.heatLayer options for a given clock hour.
     * dayness ≈ sin-shaped curve peaking mid-day: drives gradient palette, max, and minOpacity.
     * Night: cool-only stops + lower max → faint blue/teal field. Day: full spectral + higher max.
     * @param {number} hour 0–23
     * @returns {Object} Leaflet.heat options (radius, blur, gradient, max, minOpacity, maxZoom)
     * @author Jiahao
     */
    function getMockHeatLayerOptionsForHour(hour) {
        if (hour < 0) hour = 0;
        if (hour > 23) hour = 23;
        var dayness = Math.max(0, Math.min(1, Math.sin(((hour - 4) / 15) * Math.PI)));
        var opts = {
            radius: 46,
            blur: 30,
            maxZoom: 18,
            minOpacity: 0.05 + dayness * 0.14,
            max: 0.38 + dayness * 0.58,
        };
        if (dayness < 0.38) {
            opts.gradient = {
                0.0: "rgba(30, 27, 75, 0)",
                0.3: "rgba(67, 56, 202, 0.42)",
                0.55: "rgba(37, 99, 235, 0.52)",
                0.78: "rgba(14, 165, 233, 0.58)",
                1.0: "rgba(45, 212, 191, 0.62)",
            };
        } else if (dayness < 0.68) {
            opts.gradient = {
                0.0: "rgba(55, 48, 163, 0)",
                0.22: "rgba(59, 130, 246, 0.48)",
                0.42: "rgba(34, 211, 238, 0.58)",
                0.58: "rgba(52, 211, 153, 0.68)",
                0.72: "rgba(250, 204, 21, 0.78)",
                0.88: "rgba(249, 115, 22, 0.86)",
                1.0: "rgba(220, 38, 38, 0.92)",
            };
        } else {
            opts.gradient = {
                0.0: "rgba(88, 28, 135, 0)",
                0.12: "rgba(99, 102, 241, 0.35)",
                0.28: "rgba(59, 130, 246, 0.55)",
                0.42: "rgba(6, 182, 212, 0.65)",
                0.55: "rgba(52, 211, 153, 0.72)",
                0.68: "rgba(250, 204, 21, 0.82)",
                0.82: "rgba(249, 115, 22, 0.88)",
                1.0: "rgba(185, 28, 28, 0.95)",
            };
        }
        return opts;
    }

    /** Lazily computed once: global °C bounds over every spot × every hour in mock data. */
    var mockHeatGlobalTempRangeCache = null;

    /**
     * Min/max temperature across all mock hourly samples, with small padding.
     * Using one scale for all hours avoids “every hour looks the same” after normalization.
     * @returns {{ min: number, max: number }}
     * @author Jiahao
     */
    function getMockHeatGlobalTempRange() {
        if (mockHeatGlobalTempRangeCache) {
            return mockHeatGlobalTempRangeCache;
        }
        var minV = Infinity;
        var maxV = -Infinity;
        var rows =
            typeof MOCK_MAP_LOCATIONS !== "undefined" && Array.isArray(MOCK_MAP_LOCATIONS)
                ? MOCK_MAP_LOCATIONS
                : [];
        var i;
        var h;
        for (i = 0; i < rows.length; i++) {
            var hourly = getSpotHourly(rows[i]);
            for (h = 0; h < hourly.length; h++) {
                var tc = hourly[h] && hourly[h].tempC;
                if (typeof tc === "number" && !isNaN(tc)) {
                    minV = Math.min(minV, tc);
                    maxV = Math.max(maxV, tc);
                }
            }
        }
        if (!isFinite(minV) || !isFinite(maxV)) {
            mockHeatGlobalTempRangeCache = { min: 12, max: 28 };
        } else {
            var pad = (maxV - minV) * 0.06 || 0.4;
            mockHeatGlobalTempRangeCache = { min: minV - pad, max: maxV + pad };
        }
        return mockHeatGlobalTempRangeCache;
    }

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
     * Extra scalar applied to all heat intensities by hour (dawn low, afternoon high).
     * Complements temperature data so the layer “dims” at night even when blur is heavy.
     * @param {number} hour 0–23
     * @returns {number} Multiplier in roughly [0.08, 1]
     * @author Jiahao
     */
    function mockHeatDiurnalIntensityWeight(hour) {
        var sun = Math.max(0, Math.min(1, Math.sin(((hour - 4) / 15) * Math.PI)));
        return 0.08 + 0.92 * sun;
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

        var range = getMockHeatGlobalTempRange();
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

        var rows =
            typeof MOCK_MAP_LOCATIONS !== "undefined" && Array.isArray(MOCK_MAP_LOCATIONS)
                ? MOCK_MAP_LOCATIONS
                : [];
        var minLat = Infinity;
        var maxLat = -Infinity;
        var minLng = Infinity;
        var maxLng = -Infinity;
        for (i = 0; i < rows.length; i++) {
            var sp = rows[i];
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
     * Factory: owns the heat layer reference and replaces the layer on each refresh
     * (workaround for Leaflet.heat redraw throttling — see file header).
     * @param {L.Map} map
     * @returns {{ refresh: function(number): void }}
     * @author Jiahao
     */
    function createMapHeatController(map) {
        var mockHeatLayer = null;

        /**
         * Rebuild the heat layer for the chosen hour.
         * @param {number} hour
         * @author Jiahao
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
            if (pts.length) {
                mockHeatLayer = L.heatLayer(pts, getMockHeatLayerOptionsForHour(hour)).addTo(map);
            }
        }

        return { refresh: refresh };
    }

    global.createMapHeatController = createMapHeatController;
})(window);
