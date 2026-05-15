/**
 * @file mapUtils.js
 * Stateless helpers shared by map modules (heat layer, spot detail, markers).
 *
 * Consumers:
 *   - mapHeat.js       — getSpotMockHourly (synthetic temps for heat only)
 *   - mapSpotDetail*.js — escapeHtmlMap, formatShadeScore, parseMapTimeHour, getSpotApiHourly
 *   - mapMarkers.js    — escapeHtmlMap (fountain popup body)
 *
 * ES module: import from ../data/mockMapLocations.js where needed.
 * @author Jiahao
 */

import { buildMockHourlySeries } from "../data/mockMapLocations.js";

/**
 * Escape a string for safe HTML fragments (e.g. uvLevel next to numeric UV).
 * @param {string} s
 * @returns {string}
 */
function escapeHtmlMap(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Shade score in [0, 1] → percentage label.
 * @param {number} v
 * @returns {string}
 */
function formatShadeScore(v) {
    if (typeof v !== "number" || isNaN(v)) return "—";
    return Math.round(Math.min(1, Math.max(0, v)) * 100) + "%";
}

/**
 * Hour from body.dataset (written by mapTimeRail.js). Keeps one source of truth
 * if the slider DOM id ever changes.
 * @returns {number} 0–23, default 12
 */
function parseMapTimeHour() {
    var h = parseInt(document.body.dataset.mapTimeHour, 10);
    if (isNaN(h)) h = 12;
    if (h < 0) h = 0;
    if (h > 23) h = 23;
    return h;
}

/**
 * Mock-only 24h series for the heat layer. Detail panel must use getSpotApiHourly instead.
 * @param {Object} spot
 * @returns {Array<Object>}
 */
function getSpotMockHourly(spot) {
    if (!spot) return [];
    if (Array.isArray(spot.mockHourly) && spot.mockHourly.length === 24) {
        return spot.mockHourly;
    }
    return buildMockHourlySeries(spot);
}

/**
 * Live /api/risk hourly rows attached to the spot after fetch, or null until loaded.
 * @param {Object} spot
 * @returns {Array<Object>|null}
 */
function getSpotApiHourly(spot) {
    if (!spot) return null;
    if (Array.isArray(spot.apiHourly) && spot.apiHourly.length === 24) {
        return spot.apiHourly;
    }
    return null;
}

export { escapeHtmlMap, formatShadeScore, parseMapTimeHour, getSpotMockHourly, getSpotApiHourly };
