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
 */

(function () {
    "use strict";

    var el = document.getElementById("map");
    if (!el || typeof L === "undefined") {
        return;
    }

    var vancouver = [49.2827, -123.1207];
    var initialZoom = 12;

    var map = L.map(el, {
        zoomControl: true,
        scrollWheelZoom: true,
    }).setView(vancouver, initialZoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
    }).addTo(map);

    function invalidate() {
        map.invalidateSize();
    }

    requestAnimationFrame(invalidate);
    setTimeout(invalidate, 250);
    window.addEventListener("resize", invalidate);

    var heat =
        typeof createMapHeatController === "function"
            ? createMapHeatController(map)
            : null;

    addMockLocationMarkers(map);

    initMapTimeRail(invalidate);

    window.addEventListener("maptimechange", function () {
        syncMapSpotDetailPanel();
    });

    var timeSliderEl = document.getElementById("map-time-slider");
    if (timeSliderEl && heat) {
        function refreshHeatFromSlider() {
            var hv = parseInt(timeSliderEl.value, 10);
            if (isNaN(hv)) {
                hv = parseMapTimeHour();
            }
            heat.refresh(hv);
        }
        timeSliderEl.addEventListener("input", refreshHeatFromSlider);
        timeSliderEl.addEventListener("change", refreshHeatFromSlider);
    }

    if (heat) {
        heat.refresh(parseMapTimeHour());
    }

    if (typeof initMapReport === "function") {
        initMapReport();
    }

    if (typeof initMapOnboarding === "function") {
        initMapOnboarding({ delayMs: 550 });
    }

    document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") {
            if (typeof closeMapOnboardingIfOpen === "function" && closeMapOnboardingIfOpen()) {
                return;
            }
            if (typeof closeMapReportIfOpen === "function" && closeMapReportIfOpen()) {
                return;
            }
            closeMapSpotDetail();
        }
    });
})();
