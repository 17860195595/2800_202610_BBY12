/**
 * @file weatherGridService.js
 *
 * Returns one snapshot of real weather data over a coarse grid covering
 * Vancouver, in a single batched call to open-meteo.
 *
 * Used by the map page's heat layer (public/js/map/mapHeat.js) so the heat
 * layer can be driven by live readings instead of the mock-synthesized
 * series in mockMapLocations.js. We deliberately do not hit per-seed
 * /api/risk here — that route also pulls trees/buildings + computes shade,
 * which is much more expensive and unnecessary for a city-wide heat map.
 *
 * The frontend fires this exactly once per page load and caches the result
 * in module memory (see public/js/pages/index.js).
 *
 * Added by Jiahao.
 */

const weatherAPI = require("openmeteo");

/**
 * Bounding box used to lay out the grid stations. Slightly inflated past the
 * 100 curated seed locations so the heat blur reaches the map edges instead
 * of fading right at the city limits.
 */
const GRID_BBOX = {
    minLat: 49.200,
    maxLat: 49.320,
    minLng: -123.270,
    maxLng: -123.020,
};

/** Number of rows (lat steps) in the grid. */
const GRID_ROWS = 5;
/** Number of cols (lng steps) in the grid. 5 × 6 = 30 stations → ~3 km
 *  spacing, plenty of fidelity for an L.heatLayer canvas blur. */
const GRID_COLS = 6;

/**
 * Build the flat coordinate arrays expected by open-meteo's multi-location
 * endpoint. Open-meteo accepts parallel latitude / longitude arrays in one
 * request and returns one response object per station.
 *
 * @returns {{ lats: number[], lngs: number[] }}
 * @author Jiahao
 */
function buildGridCoords() {
    const lats = [];
    const lngs = [];
    const dLat = (GRID_BBOX.maxLat - GRID_BBOX.minLat) / (GRID_ROWS - 1);
    const dLng = (GRID_BBOX.maxLng - GRID_BBOX.minLng) / (GRID_COLS - 1);
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            lats.push(+(GRID_BBOX.minLat + r * dLat).toFixed(5));
            lngs.push(+(GRID_BBOX.minLng + c * dLng).toFixed(5));
        }
    }
    return { lats, lngs };
}

/**
 * Linearly interpolate a sparse (typically 3 h-spaced) array of hourly
 * samples into a dense 24-entry-per-day array indexed by hour-of-day.
 * Missing endpoints clamp to the nearest known value.
 *
 * Mirrors the logic in public/js/services/mapApi.js#densifyTo24 so heat-layer
 * input matches the detail-panel input visually.
 *
 * @param {Array<{hour:number, tempC:(number|null), uvIndex:(number|null), isDay:boolean}>} samples
 * @returns {Array<Object>} 24-length array (index = hour of day)
 * @author Jiahao
 */
function densifyTo24(samples) {
    const snaps = samples
        .filter((s) => s && typeof s.hour === "number" && !isNaN(s.hour))
        .slice()
        .sort((a, b) => a.hour - b.hour);
    const out = new Array(24);
    if (!snaps.length) {
        for (let i = 0; i < 24; i++) {
            out[i] = { hour: i, tempC: null, uvIndex: 0, isDay: i >= 6 && i <= 20 };
        }
        return out;
    }

    function blend(a, b, hr) {
        const t = (hr - a.hour) / (b.hour - a.hour);
        const tempC =
            typeof a.tempC === "number" && typeof b.tempC === "number"
                ? a.tempC + (b.tempC - a.tempC) * t
                : a.tempC == null
                  ? b.tempC
                  : a.tempC;
        const uvRaw =
            typeof a.uvIndex === "number" && typeof b.uvIndex === "number"
                ? a.uvIndex + (b.uvIndex - a.uvIndex) * t
                : a.uvIndex == null
                  ? b.uvIndex
                  : a.uvIndex;
        return {
            hour: hr,
            tempC: tempC != null ? Math.round(tempC * 10) / 10 : null,
            uvIndex: uvRaw != null ? Math.max(0, Math.round(uvRaw)) : 0,
            isDay: t < 0.5 ? !!a.isDay : !!b.isDay,
        };
    }

    for (let hr = 0; hr < 24; hr++) {
        let before = null;
        let after = null;
        for (let k = 0; k < snaps.length; k++) {
            if (snaps[k].hour === hr) {
                before = snaps[k];
                after = snaps[k];
                break;
            }
            if (snaps[k].hour < hr) before = snaps[k];
            else if (snaps[k].hour > hr && !after) after = snaps[k];
        }
        if (before && after && before.hour === after.hour) {
            out[hr] = Object.assign({}, before, { hour: hr });
        } else if (before && after) {
            out[hr] = blend(before, after, hr);
        } else if (before) {
            out[hr] = Object.assign({}, before, { hour: hr });
        } else if (after) {
            out[hr] = Object.assign({}, after, { hour: hr });
        }
    }
    return out;
}

/**
 * Decode one open-meteo response object into our station shape. open-meteo
 * exposes typed arrays via response.hourly().variables(i).valuesArray(); we
 * fold them into plain objects indexed by hour-of-day so the heat layer can
 * pluck a snapshot per hour without re-parsing.
 *
 * @param {Object} resp WeatherApiResponse
 * @returns {Array<Object>} sparse samples (one per open-meteo step, typically 3 h)
 * @author Jiahao
 */
function decodeStation(resp) {
    const hourly = resp.hourly();
    const utcOffsetSeconds = resp.utcOffsetSeconds();

    const start = Number(hourly.time());
    const end = Number(hourly.timeEnd());
    const interval = hourly.interval();
    if (!interval || end <= start) return [];

    const count = (end - start) / interval;
    const temps = hourly.variables(0).valuesArray();
    const uvs = hourly.variables(1).valuesArray();
    const isDays = hourly.variables(2).valuesArray();

    const samples = [];
    for (let k = 0; k < count; k++) {
        const tsSec = start + k * interval + utcOffsetSeconds;
        const d = new Date(tsSec * 1000);
        const tempVal = temps && temps[k];
        const uvVal = uvs && uvs[k];
        samples.push({
            hour: d.getUTCHours(),
            tempC:
                typeof tempVal === "number" && !isNaN(tempVal)
                    ? Math.round(tempVal * 10) / 10
                    : null,
            uvIndex:
                typeof uvVal === "number" && !isNaN(uvVal)
                    ? Math.max(0, Math.round(uvVal))
                    : 0,
            isDay: isDays && isDays[k] === 1,
        });
    }
    return samples;
}

/**
 * Public service entry point. Fetches the entire grid in one HTTP call and
 * returns a flat array of stations, each with a densified 24-hour series.
 *
 * Shape:
 *   [
 *     { lat: number, lng: number, hourly24: [{ hour, tempC, uvIndex, isDay }, ...×24] },
 *     ...30
 *   ]
 *
 * Throws on network / decode failure; the route handler turns that into a
 * 500 so the frontend can stay on its mock fallback.
 *
 * @returns {Promise<Array<{lat:number,lng:number,hourly24:Array<Object>}>>}
 * @author Jiahao
 */
async function fetchWeatherGrid() {
    const grid = buildGridCoords();
    const params = {
        latitude: grid.lats,
        longitude: grid.lngs,
        hourly: ["temperature_2m", "uv_index", "is_day"],
        timezone: "auto",
        past_days: 0,
        forecast_days: 1,
        temporal_resolution: "hourly_3",
    };
    const url = "https://api.open-meteo.com/v1/forecast";
    const responses = await weatherAPI.fetchWeatherApi(url, params);

    const stations = [];
    for (let i = 0; i < responses.length; i++) {
        const lat = grid.lats[i];
        const lng = grid.lngs[i];
        const samples = decodeStation(responses[i]);
        if (!samples.length) continue;
        stations.push({
            lat,
            lng,
            hourly24: densifyTo24(samples),
        });
    }
    return stations;
}

module.exports = {
    fetchWeatherGrid,
    GRID_BBOX,
    GRID_ROWS,
    GRID_COLS,
};
