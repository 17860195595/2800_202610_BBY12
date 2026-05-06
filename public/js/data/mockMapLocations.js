/**
 * Mock map locations for ShadeSafe (Vancouver area).
 * Replace this file or swap the fetch target when wiring a real API.
 *
 * Expected future API shape (illustrative):
 * { id, name, lat, lng, tempC, uvIndex, uvLevel, humidityPct, windKmh, shadeScore, summary, hourly[] }
 * hourly[h] mirrors the scalar fields for that hour (0–23).
 */

/**
 * Map a numeric UV index to a coarse label (mock / UI only).
 * @param {number} uv
 * @returns {string}
 */
function mockUvLevelFromIndex(uv) {
    if (uv <= 0) return "None";
    if (uv < 3) return "Low";
    if (uv < 6) return "Moderate";
    if (uv < 8) return "High";
    if (uv < 11) return "Very high";
    return "Extreme";
}

/**
 * Synthesize 24 hourly samples from a spot baseline so the map detail chart has data before the API exists.
 * @param {Object} spot
 * @returns {Array<Object>}
 */
function buildMockHourlySeries(spot) {
    var baseT = typeof spot.tempC === "number" && !isNaN(spot.tempC) ? spot.tempC : 18;
    var baseUv = typeof spot.uvIndex === "number" && !isNaN(spot.uvIndex) ? spot.uvIndex : 5;
    var baseHum =
        typeof spot.humidityPct === "number" && !isNaN(spot.humidityPct) ? spot.humidityPct : 60;
    var baseWind =
        typeof spot.windKmh === "number" && !isNaN(spot.windKmh) ? spot.windKmh : 10;
    var baseShade =
        typeof spot.shadeScore === "number" && !isNaN(spot.shadeScore) ? spot.shadeScore : 0.5;

    var out = [];
    // Per-spot hour shift so peaks are not identical; heatmap spatial pattern moves with the time slider.
    var idShift = 0;
    if (spot.id) {
        var sid = String(spot.id);
        for (var ci = 0; ci < sid.length; ci++) {
            idShift = (idShift * 31 + sid.charCodeAt(ci)) | 0;
        }
    }
    var hourPhase = ((idShift % 19) - 9) * 0.11;

    for (var h = 0; h < 24; h++) {
        // Daylight curve peaks mid-day; stronger swing reads clearly on the map heat layer (mock only).
        var phase = (h - 5.5 + hourPhase) / 13;
        var sun = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, phase))));
        var night = h < 6 || h > 21 ? 1 : 0;

        var tempC =
            Math.round(
                (baseT - 5.8 + sun * 10.5 - night * 3.8 + ((h % 5) - 2) * 0.15) * 10
            ) / 10;

        var uvRaw = baseUv * sun + (sun > 0.15 ? 0.3 : 0);
        var uvIndex = Math.max(0, Math.min(11, Math.round(uvRaw)));
        if (sun < 0.06) uvIndex = 0;

        var humidityPct = Math.max(
            30,
            Math.min(
                95,
                Math.round(baseHum + (1 - sun) * 8 - night * 4 + ((h % 7) - 3) * 0.5)
            )
        );

        var windKmh = Math.max(
            0,
            Math.round(baseWind + (sun > 0.5 ? 2 : 0) + ((h % 6) - 2.5))
        );

        var shadeScore = Math.min(
            1,
            Math.max(0, baseShade + (1 - sun) * 0.06 - sun * 0.04 + ((h % 4) - 1.5) * 0.02)
        );

        out.push({
            hour: h,
            tempC: tempC,
            uvIndex: uvIndex,
            uvLevel: mockUvLevelFromIndex(uvIndex),
            humidityPct: humidityPct,
            windKmh: windKmh,
            shadeScore: shadeScore,
        });
    }
    return out;
}

/** @type {Array<Object>} */
var MOCK_MAP_LOCATIONS = [
    {
        id: "mock-stanley-park",
        name: "Stanley Park — Prospect Point",
        lat: 49.313,
        lng: -123.144,
        tempC: 19,
        uvIndex: 6,
        uvLevel: "High",
        humidityPct: 62,
        windKmh: 14,
        shadeScore: 0.78,
        summary: "Dense tree cover on north trails; strong UV on seawall clearings.",
    },
    {
        id: "mock-canada-place",
        name: "Canada Place",
        lat: 49.289,
        lng: -123.112,
        tempC: 21,
        uvIndex: 7,
        uvLevel: "High",
        humidityPct: 58,
        windKmh: 11,
        shadeScore: 0.22,
        summary: "Open waterfront; limited shade except near awnings.",
    },
    {
        id: "mock-science-world",
        name: "Science World Plaza",
        lat: 49.273,
        lng: -123.104,
        tempC: 22,
        uvIndex: 8,
        uvLevel: "Very high",
        humidityPct: 55,
        windKmh: 9,
        shadeScore: 0.18,
        summary: "Mostly exposed plaza; brief shade from nearby structures mid-day.",
    },
    {
        id: "mock-kits-beach",
        name: "Kitsilano Beach",
        lat: 49.275,
        lng: -123.152,
        tempC: 20,
        uvIndex: 6,
        uvLevel: "High",
        humidityPct: 65,
        windKmh: 16,
        shadeScore: 0.35,
        summary: "Beach and grass sunny; tree line along Cornwall gives partial relief.",
    },
    {
        id: "mock-granville-island",
        name: "Granville Island (Public Market)",
        lat: 49.272,
        lng: -123.135,
        tempC: 20,
        uvIndex: 5,
        uvLevel: "Moderate",
        humidityPct: 60,
        windKmh: 10,
        shadeScore: 0.41,
        summary: "Mixed canopy and building shade near market; docks are open.",
    },
    {
        id: "mock-queen-elizabeth-park",
        name: "Queen Elizabeth Park — Bloedel Conservatory",
        lat: 49.241,
        lng: -123.113,
        tempC: 18,
        uvIndex: 5,
        uvLevel: "Moderate",
        humidityPct: 68,
        windKmh: 12,
        shadeScore: 0.62,
        summary: "Gardens and treelines offer good intermittent shade.",
    },
];

(function attachMockHourlyToSpots() {
    if (typeof MOCK_MAP_LOCATIONS === "undefined" || !Array.isArray(MOCK_MAP_LOCATIONS)) {
        return;
    }
    for (var i = 0; i < MOCK_MAP_LOCATIONS.length; i++) {
        MOCK_MAP_LOCATIONS[i].hourly = buildMockHourlySeries(MOCK_MAP_LOCATIONS[i]);
    }
})();
