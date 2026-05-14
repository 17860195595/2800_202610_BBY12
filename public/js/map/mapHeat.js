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

    /** Live weather stations from /api/weather-grid. When set, the heat layer
     *  uses these as its source instead of the mock-synthesized series on
     *  MOCK_MAP_LOCATIONS. Kept in module memory only — no localStorage —
     *  so a hard reload always re-fetches.
     *  @type {Array<{lat:number,lng:number,hourly24:Array<Object>}>|null} */
    var liveHeatStations = null;

    /**
     * Swap in (or out) the live weather stations that drive the heat layer.
     * Pass an array → live data wins on the next refresh. Pass null → revert
     * to the mock-synthesized source.
     *
     * Recomputes the global temperature range so the gradient anchors to the
     * new data span (mock and live can be ±5 °C apart for the same hour).
     *
     * @param {Array<{lat:number,lng:number,hourly24:Array<Object>}>|null} stations
     * @author Jiahao
     */
    function setLiveHeatStations(stations) {
        if (Array.isArray(stations) && stations.length) {
            liveHeatStations = stations;
        } else {
            liveHeatStations = null;
        }
    }

    /** Whether live weather is currently in use (for diagnostics / UI). */
    function isUsingLiveHeatStations() {
        return Array.isArray(liveHeatStations) && liveHeatStations.length > 0;
    }

    /**
     * Collect station lat/lng and the temperature at the chosen hour. Prefers
     * the live /api/weather-grid stations when available; otherwise falls
     * back to the mock-synthesized series so the layer renders something the
     * very first paint, before /api/weather-grid resolves.
     *
     * @param {number} hour 0–23
     * @returns {Array<{ lat: number, lng: number, tempC: number }>}
     * @author Jiahao
     */
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

    /**
     * Single full-spectrum gradient used at every hour. With the absolute
     * temperature scale (see ABS_TEMP_RANGE) the color of each pixel is
     * anchored to the °C value itself, not to "how warm vs the rest of the
     * day" — so a 12 °C cool morning reads as blue/cyan and a 30 °C heat
     * wave reads as orange/red regardless of clock hour.
     *
     * Tuned for Vancouver's typical 0–35 °C envelope:
     *   < ~5 °C  → transparent / dark indigo
     *   ~10 °C   → blue
     *   ~15 °C   → cyan
     *   ~20 °C   → green / yellow
     *   ~25 °C   → yellow / orange
     *   > ~32 °C → red
     */
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
     * Build L.heatLayer options for a given clock hour. With the absolute
     * temperature scale we keep one constant gradient and only let the hour
     * lightly modulate overall brightness (minOpacity) — enough to keep the
     * time slider visually feeling alive without overwriting the
     * temperature-driven color.
     *
     * @param {number} hour 0–23
     * @returns {Object} Leaflet.heat options
     * @author Jiahao
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

    /**
     * Absolute temperature anchor for the gradient. A cool day will render in
     * blues/cyans because 12 °C maps to ~0.34 of the scale; a hot day will
     * render in oranges/reds because 28 °C maps to ~0.8.
     *
     * Tuned for Vancouver's climate envelope (≈ -5..35 °C in extreme years,
     * 0..32 °C in the regular year). Temps below MIN are clamped to "barely
     * visible blue"; temps above MAX saturate to full red.
     */
    var ABS_TEMP_RANGE = { min: 0, max: 35 };

    /**
     * Return the fixed absolute °C range. Kept as a function (instead of
     * inlining ABS_TEMP_RANGE) so the rest of the rendering pipeline doesn't
     * need to know whether the scale is data-driven or constant.
     *
     * @returns {{ min: number, max: number }}
     * @author Jiahao
     */
    function getMockHeatGlobalTempRange() {
        return ABS_TEMP_RANGE;
    }

    /**
     * No-op in absolute-scale mode (the range never changes). Kept for
     * backward compatibility with pages/index.js which calls it after a
     * data swap; safe to leave wired up.
     * @author Jiahao
     */
    function resetMockHeatGlobalTempRangeCache() {
        // Absolute scale → nothing to invalidate.
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
     * Factory: owns the heat layer reference and replaces the layer on each refresh
     * (workaround for Leaflet.heat redraw throttling — see file header).
     *
     * Returns:
     *   refresh(hour)        – rebuild the layer for an hour 0..23
     *   setVisible(boolean)  – temporarily hide/show without losing the layer
     *   isVisible()          – current toggle state (true by default)
     *
     * @param {L.Map} map
     * @returns {{ refresh: function(number): void, setVisible: function(boolean): void, isVisible: function(): boolean }}
     * @author Jiahao
     */
    function createMapHeatController(map) {
        var mockHeatLayer = null;
        var visible = true;

        /**
         * Rebuild the heat layer for the chosen hour. Honors the visible flag
         * so toggling Heat off then scrubbing the time slider does not pop
         * the layer back on.
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
            if (visible && pts.length) {
                mockHeatLayer = L.heatLayer(pts, getMockHeatLayerOptionsForHour(hour)).addTo(map);
            }
        }

        /**
         * @param {boolean} v
         * @author Jiahao
         */
        function setVisible(v) {
            visible = !!v;
            if (!visible && mockHeatLayer) {
                map.removeLayer(mockHeatLayer);
                mockHeatLayer = null;
            } else if (visible && !mockHeatLayer) {
                refresh(typeof parseMapTimeHour === "function" ? parseMapTimeHour() : 12);
            }
        }

        function isVisible() {
            return visible;
        }

        return { refresh: refresh, setVisible: setVisible, isVisible: isVisible };
    }

    global.createMapHeatController = createMapHeatController;
    global.resetMockHeatGlobalTempRangeCache = resetMockHeatGlobalTempRangeCache;
    global.setLiveHeatStations = setLiveHeatStations;
    global.isUsingLiveHeatStations = isUsingLiveHeatStations;
})(window);
