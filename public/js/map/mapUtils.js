/**
 * @file mapUtils.js
 * Small, stateless helpers shared across the map page modules.
 *
 * Consumers:
 *   - mapHeat.js      — needs getSpotHourly() for temperature-driven layers
 *   - mapSpotDetail.js — needs escapeHtmlMap, formatShadeScore, parseMapTimeHour, getSpotHourly
 *
 * Load after: js/data/mockMapLocations.js (provides buildMockHourlySeries when spot.hourly is absent).
 */

/**
 * Escape text so it is safe to embed in HTML (e.g. uvLevel in a stats row).
 * Prefer textContent where possible; use this when you must build a small HTML fragment.
 * @param {string} s Raw string from data / API
 * @returns {string} Entity-escaped string
 */
function escapeHtmlMap(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Format a shade score in [0, 1] as a percentage label for the UI.
 * @param {number} v Shade score
 * @returns {string} e.g. "62%" or em dash if invalid
 */
function formatShadeScore(v) {
    if (typeof v !== "number" || isNaN(v)) return "—";
    return Math.round(Math.min(1, Math.max(0, v)) * 100) + "%";
}

/**
 * Read the time-rail hour from document.body.dataset.
 * mapTimeRail.js writes mapTimeHour and mapTimeHm whenever the slider moves; other modules
 * read this instead of querying the input directly, so behavior stays consistent if the DOM id changes.
 * @returns {number} Hour in [0, 23], default 12 if unset
 */
function parseMapTimeHour() {
    var h = parseInt(document.body.dataset.mapTimeHour, 10);
    if (isNaN(h)) h = 12;
    if (h < 0) h = 0;
    if (h > 23) h = 23;
    return h;
}

/**
 * Return the 24 hourly records for one spot.
 * Prefer spot.hourly (attached by mockMapLocations.js); otherwise synthesize via buildMockHourlySeries.
 * @param {Object} spot Location row from MOCK_MAP_LOCATIONS
 * @returns {Array<Object>} Up to 24 hourly snapshots
 */
function getSpotHourly(spot) {
    if (spot.hourly && spot.hourly.length === 24) {
        return spot.hourly;
    }
    if (typeof buildMockHourlySeries === "function") {
        return buildMockHourlySeries(spot);
    }
    return [];
}
