/**
 * @file mapConfig.js
 * Map page (index) constants and user-facing copy. Change here without touching bootstrap logic.
 * Loaded as part of the map page module graph (pages/index.js).
 * @author Jiahao
 */

export const MAP_PAGE_CENTER = { lat: 49.2827, lng: -123.1207 };

/** Initial Leaflet zoom on first paint. */
export const MAP_PAGE_INITIAL_ZOOM = 12;

/** Delay before auto-opening the onboarding tour (ms). */
export const MAP_PAGE_ONBOARDING_DELAY_MS = 550;

/**
 * Status toasts + auto-locate copy (see pages/index.js setMapStatusMessage / autoLocateOnLoad).
 * @type {Object<string,string|function(...*):string>}
 */
export const MAP_PAGE_MESSAGES = {
    locBlocked:
        "Location blocked — showing Vancouver. Allow location in site settings.",
    geoUnsupported: "Geolocation not supported — showing default map centre.",
    locating: "Locating you…",
    centeredOnYou: "Centered on your location",
    couldntLocate: "Couldn't locate you",
    loadingLiveWeather: "Loading live weather…",
    weatherEmpty: "Weather grid empty — using mock heat",
    liveWeatherUnavailable: "Live weather unavailable — using mock heat",
    /** @param {number} n */
    liveWeatherStations: function (n) {
        return "Live weather · " + n + " stations";
    },
    /** @param {number} n */
    fountainsLoaded: function (n) {
        return n + " fountains loaded";
    },
    /** @param {number} n */
    reportsLoaded: function (n) {
        return n + " reports loaded";
    },
};
