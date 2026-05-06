/**
 * Map / home page entry for index.html.
 *
 * Stack:
 * - Leaflet for map controls and camera state.
 * - OpenStreetMap raster tiles (free tier; no API key). Follow OSM tile usage policy for production.
 *
 * Swapping providers:
 * - Google Maps / Mapbox: load their JS SDK, create the map instance their way, and remove the L.tileLayer block below.
 */

(function () {
    "use strict";

    // -------------------------------------------------------------------------
    // Guard: DOM must exist and Leaflet must have loaded before this script runs.
    // -------------------------------------------------------------------------
    var el = document.getElementById("map");
    if (!el || typeof L === "undefined") {
        return;
    }

    // -------------------------------------------------------------------------
    // Initial view
    // Leaflet uses [latitude, longitude] (WGS84), same order as GeoJSON "coordinates" for points.
    // Center: downtown Vancouver — aligns with ShadeSafe Vancouver branding.
    // -------------------------------------------------------------------------
    var vancouver = [49.2827, -123.1207];
    var initialZoom = 12;

    // -------------------------------------------------------------------------
    // Map instance
    // zoomControl: +/- buttons; scrollWheelZoom: mouse wheel to zoom (disable if you prefer scroll-to-pan only).
    // -------------------------------------------------------------------------
    var map = L.map(el, {
        zoomControl: true,
        scrollWheelZoom: true,
    }).setView(vancouver, initialZoom);

    // -------------------------------------------------------------------------
    // Base map tiles
    // {s} is a subdomain round-robin (a, b, c) to spread load. maxZoom must match what the server supports.
    // attribution is required by the OSM tile policy and is shown in the default attribution control.
    // -------------------------------------------------------------------------
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
    }).addTo(map);

    // -------------------------------------------------------------------------
    // invalidateSize()
    // Leaflet measures the container once at init. Our shell uses flex + fixed footer/header, so the
    // #map height can settle after first paint. Calling invalidateSize() recomputes dimensions and
    // fixes gray tiles or wrong centering.
    // We schedule multiple passes: next frame, and again after a short delay for late layout (fonts, images).
    // -------------------------------------------------------------------------
    function invalidate() {
        map.invalidateSize();
    }

    requestAnimationFrame(invalidate);
    setTimeout(invalidate, 250);

    window.addEventListener("resize", invalidate);
})();
