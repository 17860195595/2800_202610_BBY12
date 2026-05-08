/**
 * @file index.js — Map page bootstrap only.
 *
 * Responsibilities here:
 *   - Create the Leaflet map and OSM tile layer
 *   - Call createMapHeatController(map), addMockLocationMarkers, initMapTimeRail
 *   - Subscribe maptimechange → syncMapSpotDetailPanel (detail text/chart only)
 *   - Subscribe the range input directly → heat.refresh (reliable repaint; see mapHeat.js header)
 *   - Escape closes the report modal first (if open), then the detail sheet
 *   - initMapReport — floating Report button + feedback modal (no API yet)
 *   - initMapOnboarding — first-visit tour (currently every visit; gate on user DB field later)
 *
 * All feature logic: public/js/map/*.js (order in index.html matters).
 *
 * Note: Heat refresh is intentionally not inside the maptimechange handler to avoid double
 * removeLayer/addLayer on the same tick; the slider’s input listener drives the heat layer alone.
 * This split was clarified while stepping through event order with Claude-assisted review of the flow.
 * @author Jiahao
 */

(function () {
    "use strict";

    var MAP_CENTER = [49.2827, -123.1207];
    var INITIAL_ZOOM = 12;
    var ONBOARDING_DELAY_MS = 550;

    /**
     * Build the Leaflet map instance for the map page.
     * @param {HTMLElement} mountEl
     * @returns {L.Map}
     * @author Jiahao
     */
    function createMapInstance(mountEl) {
        return L.map(mountEl, {
            zoomControl: true,
            scrollWheelZoom: true,
        }).setView(MAP_CENTER, INITIAL_ZOOM);
    }

    /**
     * Attach OpenStreetMap base tiles to the given map.
     * @param {L.Map} map
     * @author Jiahao
     */
    function attachBaseTiles(map) {
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(map);
    }

    /**
     * Create a size invalidation callback and bind it to initial/reflow events.
     * @param {L.Map} map
     * @returns {function}
     * @author Jiahao
     */
    function bindMapInvalidation(map) {
        function invalidate() {
            map.invalidateSize();
        }
        requestAnimationFrame(invalidate);
        setTimeout(invalidate, 250);
        window.addEventListener("resize", invalidate);
        return invalidate;
    }

    /**
     * Bind detail panel updates to maptimechange.
     * @author Jiahao
     */
    function bindDetailSyncOnTimeChange() {
        window.addEventListener("maptimechange", function () {
            syncMapSpotDetailPanel();
        });
    }

    /**
     * Build heat controller if the factory is available.
     * @param {L.Map} map
     * @returns {Object|null}
     * @author Jiahao
     */
    function createHeatController(map) {
        return typeof createMapHeatController === "function"
            ? createMapHeatController(map)
            : null;
    }

    /**
     * Read the hour from slider safely; fallback to dataset hour.
     * @param {HTMLInputElement} sliderEl
     * @returns {number}
     * @author Jiahao
     */
    function parseHourFromSlider(sliderEl) {
        var hour = parseInt(sliderEl.value, 10);
        if (isNaN(hour)) {
            hour = parseMapTimeHour();
        }
        return hour;
    }

    /**
     * Keep heat layer in sync with slider events.
     * @param {Object|null} heatController
     * @author Jiahao
     */
    function bindHeatRefreshToSlider(heatController) {
        var sliderEl = document.getElementById("map-time-slider");
        if (!sliderEl || !heatController) {
            return;
        }
        function refreshHeatFromSlider() {
            heatController.refresh(parseHourFromSlider(sliderEl));
        }
        sliderEl.addEventListener("input", refreshHeatFromSlider);
        sliderEl.addEventListener("change", refreshHeatFromSlider);
    }

    /**
     * Initialize optional map-page overlays/widgets.
     * @author Jiahao
     */
    function initOptionalUiModules() {
        if (typeof initMapReport === "function") {
            initMapReport();
        }
        if (typeof initMapOnboarding === "function") {
            initMapOnboarding({ delayMs: ONBOARDING_DELAY_MS });
        }
    }

    /**
     * Global Escape behavior priority:
     * 1) onboarding modal, 2) report modal, 3) spot detail panel.
     * @author Jiahao
     */
    function bindGlobalEscapeHandlers() {
        document.addEventListener("keydown", function (ev) {
            if (ev.key !== "Escape") {
                return;
            }
            if (typeof closeMapOnboardingIfOpen === "function" && closeMapOnboardingIfOpen()) {
                return;
            }
            if (typeof closeMapReportIfOpen === "function" && closeMapReportIfOpen()) {
                return;
            }
            closeMapSpotDetail();
        });
    }

    var mapEl = document.getElementById("map");
    if (!mapEl || typeof L === "undefined") {
        return;
    }

    var map = createMapInstance(mapEl);
    attachBaseTiles(map);
    var invalidate = bindMapInvalidation(map);

    var heat = createHeatController(map);
    addMockLocationMarkers(map);
    initMapTimeRail(invalidate);
    bindDetailSyncOnTimeChange();
    bindHeatRefreshToSlider(heat);
    if (heat) {
        heat.refresh(parseMapTimeHour());
    }

    initOptionalUiModules();
    bindGlobalEscapeHandlers();
})();
