/**
 * @file mapUtils.js
 * Small, stateless helpers shared across the map page modules.
 *
 * Consumers:
 *   - mapHeat.js       — needs getSpotMockHourly() for the synthetic temperature layer
 *   - mapSpotDetail.js — needs escapeHtmlMap, formatShadeScore, parseMapTimeHour, getSpotApiHourly
 *
 * Load after: js/data/mockMapLocations.js (provides buildMockHourlySeries when spot.mockHourly is absent).
 * @author Jiahao
 */

/**
 * Escape text so it is safe to embed in HTML (e.g. uvLevel in a stats row).
 * Prefer textContent where possible; use this when you must build a small HTML fragment.
 * @param {string} s Raw string from data / API
 * @returns {string} Entity-escaped string
 * @author Jiahao
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
 * @author Jiahao
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
 * @author Jiahao
 */
function parseMapTimeHour() {
    var h = parseInt(document.body.dataset.mapTimeHour, 10);
    if (isNaN(h)) h = 12;
    if (h < 0) h = 0;
    if (h > 23) h = 23;
    return h;
}

/**
 * Return the synthetic 24-hour series used to drive the heat layer.
 * Prefers the precomputed spot.mockHourly (attached by mockMapLocations.js);
 * falls back to building it on the fly if missing.
 *
 * IMPORTANT: this is mock-only. The detail panel must NEVER render this — it
 * uses getSpotApiHourly so users only see real /api/risk numbers.
 *
 * @param {Object} spot Location row from MOCK_MAP_LOCATIONS
 * @returns {Array<Object>} Up to 24 hourly snapshots
 * @author Jiahao
 */
function getSpotMockHourly(spot) {
    if (!spot) return [];
    if (Array.isArray(spot.mockHourly) && spot.mockHourly.length === 24) {
        return spot.mockHourly;
    }
    if (typeof buildMockHourlySeries === "function") {
        return buildMockHourlySeries(spot);
    }
    return [];
}

/**
 * Return the real 24-hour series fetched from /api/risk for this spot, or
 * null if it has not been fetched yet. Detail panel uses this exclusively so
 * the user only ever sees live numbers; while this is null the panel shows
 * its loading state.
 *
 * @param {Object} spot
 * @returns {Array<Object>|null}
 * @author Jiahao
 */
function getSpotApiHourly(spot) {
    if (!spot) return null;
    if (Array.isArray(spot.apiHourly) && spot.apiHourly.length === 24) {
        return spot.apiHourly;
    }
    return null;
}
