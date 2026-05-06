/**
 * Map / home page entry for index.html.
 *
 * Stack:
 * - Leaflet for map controls and camera state.
 * - OpenStreetMap raster tiles (free tier; no API key). Follow OSM tile usage policy for production.
 * - Time-of-day control: Bootstrap .form-range in markup; hourly steps only.
 *
 * Swapping providers:
 * - Google Maps / Mapbox: load their JS SDK, create the map instance their way, and remove the L.tileLayer block below.
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

    initMapTimeRail(invalidate);
})();

/**
 * Hourly slider (0–23). Future heatmap: listen for "maptimechange" or read body.dataset.mapTimeHour.
 * @param {function} [onLayout]
 */
function initMapTimeRail(onLayout) {
    var slider = document.getElementById("map-time-slider");
    var display = document.getElementById("map-time-rail-display");
    if (!slider || !display) return;

    function pad2(n) {
        return n < 10 ? "0" + n : String(n);
    }

    function apply() {
        var h = parseInt(slider.value, 10);
        if (isNaN(h)) h = 0;
        var label = pad2(h) + ":00";
        display.value = label;
        slider.setAttribute("aria-valuenow", String(h));
        slider.setAttribute("aria-valuetext", label);
        document.body.dataset.mapTimeHour = String(h);
        document.body.dataset.mapTimeHm = label;
        window.dispatchEvent(
            new CustomEvent("maptimechange", {
                detail: { hour: h, label: label, minutesFromMidnight: h * 60 },
            })
        );
        if (typeof onLayout === "function") requestAnimationFrame(onLayout);
    }

    slider.addEventListener("input", apply);
    slider.addEventListener("change", apply);
    apply();
}
