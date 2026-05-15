/**
 * @file mapApi.js
 * Map page API client.
 *
 * Wraps the backend endpoints already exposed in server.js:
 *   GET /api/risk?lat=&lng=&past_days=  → [trees, buildings, ...dayEntries]
 *     where each dayEntries[d] is an array of hourly_3 samples for that day,
 *     each sample:
 *       { time, shade, risk, temperature_C, direct_radiation_Wm2,
 *         uv_index, humidity_percent, isday, windspeed_KM }
 *   GET /api/fountains → Vancouver Open Data:
 *     { results: [{ geo_point_2d: { lon, lat }, location }, ...] }
 *
 * The frontend never pre-loads weather: /api/risk fires only when the user
 * clicks a pin (see ensureSpotApiData below). The 100 seed spots themselves
 * are static identity rows; their heat-layer numbers are mock-synthesized in
 * mockMapLocations.js so we keep spatial variation without any API traffic.
 *
 * ES module exports (map page imports from services/mapApi.js).
 *
 * @author Jiahao
 */

/**
 * Map a numeric UV index to a coarse label. Mirrors mockMapLocations.js so
 * the detail panel keeps the same vocabulary regardless of data source.
 * @param {number} uv
 * @returns {string}
 * @author Jiahao
 */
function uvLevelFromIndex(uv) {
        if (typeof uv !== "number" || isNaN(uv)) return "—";
        if (uv <= 0) return "None";
        if (uv < 3) return "Low";
        if (uv < 6) return "Moderate";
        if (uv < 8) return "High";
        if (uv < 11) return "Very high";
        return "Extreme";
    }

    /**
     * Read the "hour of day" from a server entry. Backend `time` is whatever
     * open-meteo returns (string or Date) — we coerce to Date then read getHours.
     * @param {any} timeVal
     * @returns {number} hour 0–23, NaN if unparseable
     * @author Jiahao
     */
    function entryHour(timeVal) {
        if (!timeVal) return NaN;
        var d = timeVal instanceof Date ? timeVal : new Date(timeVal);
        if (isNaN(d.getTime())) return NaN;
        return d.getHours();
    }

    /**
     * Pick the most recent day-bucket from the risk result.
     * server.js stores: result[0]=trees, result[1]=buildings, result[2..]=days.
     * With past_days=0 we expect a single day; we still defensively pick the last day.
     * @param {Array<any>} riskResult
     * @returns {Array<Object>} hourly entries for the chosen day (3h-spaced)
     * @author Jiahao
     */
    function pickLatestDayEntries(riskResult) {
        if (!Array.isArray(riskResult) || riskResult.length < 3) return [];
        for (var i = riskResult.length - 1; i >= 2; i--) {
            if (Array.isArray(riskResult[i]) && riskResult[i].length) {
                return riskResult[i];
            }
        }
        return [];
    }

    /**
     * Pull a flat [{lat, lng}] list out of one of the Vancouver Open Data wrappers
     * that the backend forwards as result[0] (trees) and result[1] (buildings).
     * Shape from the dataset: { results: [{ geo_point_2d: { lon, lat } }, ...] }.
     * Returns [] if the wrapper is missing or malformed so callers can store a
     * known-good default on the spot without extra null checks.
     * @param {any} wrapper
     * @returns {Array<{ lat: number, lng: number }>}
     * @author Jiahao
     */
    function extractGeoPoints(wrapper) {
        if (!wrapper || !Array.isArray(wrapper.results)) return [];
        var out = [];
        for (var i = 0; i < wrapper.results.length; i++) {
            var p = wrapper.results[i] && wrapper.results[i].geo_point_2d;
            if (!p) continue;
            var lat = typeof p.lat === "number" ? p.lat : parseFloat(p.lat);
            var lng = typeof p.lon === "number" ? p.lon : parseFloat(p.lon);
            if (isNaN(lat) || isNaN(lng)) continue;
            out.push({ lat: lat, lng: lng });
        }
        return out;
    }

    /**
     * Convert one backend hourly entry into our internal "spot snapshot" shape
     * used by mapHeat.js / mapSpotDetail*.js. Keeps fields that already exist
     * in the mock so all downstream code keeps working.
     * @param {Object} entry
     * @param {number} hour 0–23
     * @returns {Object}
     * @author Jiahao
     */
    function mapEntryToSnap(entry, hour) {
        var tempC = typeof entry.temperature_C === "number" ? entry.temperature_C : null;
        var uvIndex = typeof entry.uv_index === "number" ? entry.uv_index : null;
        var humidity = typeof entry.humidity_percent === "number" ? entry.humidity_percent : null;
        var wind = typeof entry.windspeed_KM === "number" ? entry.windspeed_KM : null;
        var shade = typeof entry.shade === "number" ? entry.shade : null;
        var risk = typeof entry.risk === "number" ? entry.risk : null;
        return {
            hour: hour,
            tempC: tempC != null ? Math.round(tempC * 10) / 10 : null,
            uvIndex: uvIndex != null ? Math.max(0, Math.round(uvIndex)) : 0,
            uvLevel: uvLevelFromIndex(uvIndex),
            humidityPct: humidity != null ? Math.round(humidity) : null,
            windKmh: wind != null ? Math.round(wind) : null,
            shadeScore: shade != null ? Math.max(0, Math.min(1, shade)) : null,
            riskScore: risk != null ? Math.max(0, Math.min(1, risk)) : null,
            isDay: entry.isday === 1 || entry.isday === true,
        };
    }

    /**
     * Linear interpolation between two snapshots for the missing hours.
     * Numeric fields blend; categorical labels (uvLevel) are recomputed from uvIndex.
     * @param {Object} a snapshot at hour ha
     * @param {Object} b snapshot at hour hb (> ha)
     * @param {number} h target hour, ha < h < hb
     * @returns {Object}
     * @author Jiahao
     */
    function blendSnaps(a, b, h) {
        var t = (h - a.hour) / (b.hour - a.hour);

        function num(av, bv) {
            if (typeof av !== "number" || isNaN(av)) return bv;
            if (typeof bv !== "number" || isNaN(bv)) return av;
            return av + (bv - av) * t;
        }

        var uvI = num(a.uvIndex, b.uvIndex);
        uvI = uvI != null ? Math.max(0, Math.round(uvI)) : 0;
        var tempC = num(a.tempC, b.tempC);
        return {
            hour: h,
            tempC: tempC != null ? Math.round(tempC * 10) / 10 : null,
            uvIndex: uvI,
            uvLevel: uvLevelFromIndex(uvI),
            humidityPct:
                num(a.humidityPct, b.humidityPct) != null
                    ? Math.round(num(a.humidityPct, b.humidityPct))
                    : null,
            windKmh:
                num(a.windKmh, b.windKmh) != null ? Math.round(num(a.windKmh, b.windKmh)) : null,
            shadeScore: num(a.shadeScore, b.shadeScore),
            riskScore: num(a.riskScore, b.riskScore),
            isDay: t < 0.5 ? a.isDay : b.isDay,
        };
    }

    /**
     * Expand a sparse (typically 8-point, 3h-spaced) hourly array into a dense 24-entry
     * array indexed by clock-hour. Missing endpoints are clamped to the nearest known value.
     * @param {Array<Object>} entries Sorted-by-hour 3h-spaced backend entries
     * @returns {Array<Object>} 24-length array, index = hour of day
     * @author Jiahao
     */
    function densifyTo24(entries) {
        var snaps = [];
        for (var i = 0; i < entries.length; i++) {
            var h = entryHour(entries[i].time);
            if (isNaN(h)) continue;
            snaps.push(mapEntryToSnap(entries[i], h));
        }
        snaps.sort(function (x, y) {
            return x.hour - y.hour;
        });

        var out = new Array(24);
        if (!snaps.length) {
            return out;
        }

        for (var hr = 0; hr < 24; hr++) {
            var before = null;
            var after = null;
            for (var k = 0; k < snaps.length; k++) {
                if (snaps[k].hour === hr) {
                    before = snaps[k];
                    after = snaps[k];
                    break;
                }
                if (snaps[k].hour < hr) {
                    before = snaps[k];
                } else if (snaps[k].hour > hr && after == null) {
                    after = snaps[k];
                }
            }
            if (before && after && before.hour === after.hour) {
                out[hr] = Object.assign({}, before, { hour: hr });
            } else if (before && after) {
                out[hr] = blendSnaps(before, after, hr);
            } else if (before) {
                out[hr] = Object.assign({}, before, { hour: hr });
            } else if (after) {
                out[hr] = Object.assign({}, after, { hour: hr });
            }
        }

        for (var hh = 0; hh < 24; hh++) {
            if (!out[hh]) {
                out[hh] = {
                    hour: hh,
                    tempC: null,
                    uvIndex: 0,
                    uvLevel: "—",
                    humidityPct: null,
                    windKmh: null,
                    shadeScore: null,
                    riskScore: null,
                    isDay: hh >= 6 && hh <= 20,
                };
            }
        }
        return out;
    }

    /**
     * Fetch risk + weather + nearby trees/buildings for a single (lat, lng).
     * Backend layout of the JSON array (see server.js /api/risk):
     *   [0] trees wrapper, [1] buildings wrapper, [2..N] day buckets of hourly_3 entries
     * @param {{ lat: number, lng: number }} spot
     * @returns {Promise<{
     *   hourly24: Array<Object>,
     *   trees: Array<{lat:number,lng:number}>,
     *   buildings: Array<{lat:number,lng:number}>,
     *   raw: Array<any>
     * }>}
     * @author Jiahao
     */
    function fetchSpotRiskData(spot) {
        var url =
            "/api/risk?lat=" + encodeURIComponent(spot.lat) +
            "&lng=" + encodeURIComponent(spot.lng) +
            "&past_days=0";
        return fetch(url, { headers: { Accept: "application/json" } })
            .then(function (res) {
                if (!res.ok) {
                    throw new Error("Risk API responded " + res.status);
                }
                return res.json();
            })
            .then(function (json) {
                var entries = pickLatestDayEntries(json);
                var trees = Array.isArray(json) && json.length > 0 ? extractGeoPoints(json[0]) : [];
                var buildings =
                    Array.isArray(json) && json.length > 1 ? extractGeoPoints(json[1]) : [];
                return {
                    hourly24: densifyTo24(entries),
                    trees: trees,
                    buildings: buildings,
                    raw: json,
                };
            });
    }

    /**
     * One-shot cleanup of the city-wide building cache. The "Buildings: City"
     * mode (and the matching Vancouver Open Data exports fetch) was removed —
     * the 100 curated key locations are enough for the use case — so we
     * proactively reclaim the ~1–2 MB blob from any user's localStorage on
     * the very next visit instead of leaving it to expire.
     * @author Jiahao
     */
    (function cleanupRetiredCityBuildingsCache() {
        try {
            window.localStorage.removeItem("shadeSafe.cityBuildings.v1");
        } catch (e) {
            // private mode / storage blocked — nothing we need to do
        }
    })();

    /**
     * Fetch every drinking fountain in Vancouver. Normalizes the Vancouver Open
     * Data shape into plain { lat, lng, location } rows for the frontend.
     * @returns {Promise<Array<{ lat: number, lng: number, location: string|null }>>}
     * @author Jiahao
     */
    function fetchAllFountains() {
        return fetch("/api/fountains", { headers: { Accept: "application/json" } })
            .then(function (res) {
                if (!res.ok) {
                    throw new Error("Fountains API responded " + res.status);
                }
                return res.json();
            })
            .then(function (json) {
                var rows = (json && Array.isArray(json.results)) ? json.results : [];
                var out = [];
                for (var i = 0; i < rows.length; i++) {
                    var p = rows[i] && rows[i].geo_point_2d;
                    if (!p) continue;
                    var lat = typeof p.lat === "number" ? p.lat : parseFloat(p.lat);
                    var lng = typeof p.lon === "number" ? p.lon : parseFloat(p.lon);
                    if (isNaN(lat) || isNaN(lng)) continue;
                    out.push({
                        lat: lat,
                        lng: lng,
                        location:
                            rows[i].location && typeof rows[i].location === "string"
                                ? rows[i].location
                                : null,
                    });
                }
                return out;
            });
    }

    /**
     * Pick the hour closest to noon as the "current/baseline" representative
     * value used for the spot's top-level summary fields (legacy mock shape).
     * @param {Array<Object>} hourly24
     * @returns {Object|null}
     * @author Jiahao
     */
    function pickBaselineSnap(hourly24) {
        if (!Array.isArray(hourly24) || !hourly24.length) return null;
        var target = hourly24[12] || null;
        if (target && target.tempC != null) return target;
        var best = null;
        var bestDist = Infinity;
        for (var i = 0; i < hourly24.length; i++) {
            var s = hourly24[i];
            if (!s || s.tempC == null) continue;
            var d = Math.abs(i - 12);
            if (d < bestDist) {
                bestDist = d;
                best = s;
            }
        }
        return best;
    }

    /**
     * Per-spot cache of in-flight or settled /api/risk fetches, keyed by
     * spot.id (falling back to a coord-based key if id is absent). Prevents
     * duplicate calls when the user reopens the same pin and lets the detail
     * panel await an outstanding fetch instead of starting a parallel one.
     */
    var spotApiPromiseCache = Object.create(null);

    /**
     * Build a stable cache key for a spot. Seeds always have an id; building
     * pins derived in mapMarkers.js carry a synthetic "<parent>-bld-<i>" id.
     * Coords-based fallback handles ad-hoc spots without ids.
     * @param {Object} spot
     * @returns {string}
     * @author Jiahao
     */
    function spotCacheKey(spot) {
        if (spot && typeof spot.id === "string" && spot.id) return spot.id;
        if (spot && typeof spot.lat === "number" && typeof spot.lng === "number") {
            return "ll:" + spot.lat.toFixed(5) + "," + spot.lng.toFixed(5);
        }
        return "anon:" + Math.random().toString(36).slice(2);
    }

    /**
     * Lazy-load the real /api/risk readings for a single spot and patch the
     * result onto the spot object in place. Idempotent + cached: repeat
     * callers receive the same Promise so the backend sees one request per
     * unique pin.
     *
     * After resolution the spot will have:
     *   - spot.apiHourly       — 24-entry densified hourly array
     *   - spot.buildings/trees — flat lat/lng arrays from /api/risk
     *   - spot.dataSource      — "api" on success, "no-data" if backend
     *                            returned an empty bucket, "error" on failure
     *
     * The detail panel reads spot.apiHourly directly. The heat layer keeps
     * using the synthetic spot.mockHourly and is unaffected by this call.
     *
     * @param {Object} spot must carry numeric lat/lng
     * @returns {Promise<Object>} resolves to the same spot object (patched)
     * @author Jiahao
     */
    function ensureSpotApiData(spot) {
        if (!spot || typeof spot.lat !== "number" || typeof spot.lng !== "number") {
            return Promise.reject(new Error("ensureSpotApiData: spot missing lat/lng"));
        }
        if (Array.isArray(spot.apiHourly) && spot.apiHourly.length === 24) {
            return Promise.resolve(spot);
        }
        var key = spotCacheKey(spot);
        if (spotApiPromiseCache[key]) {
            return spotApiPromiseCache[key];
        }

        var p = fetchSpotRiskData(spot)
            .then(function (result) {
                var hasUsableData = false;
                if (Array.isArray(result.hourly24)) {
                    for (var hh = 0; hh < result.hourly24.length; hh++) {
                        if (result.hourly24[hh] && result.hourly24[hh].tempC != null) {
                            hasUsableData = true;
                            break;
                        }
                    }
                }
                spot.buildings = result.buildings || [];
                spot.trees = result.trees || [];
                spot.buildingCount = spot.buildings.length;
                spot.treeCount = spot.trees.length;

                if (!hasUsableData) {
                    spot.dataSource = "no-data";
                    return spot;
                }
                spot.apiHourly = result.hourly24;
                var baseline = pickBaselineSnap(result.hourly24);
                if (baseline) {
                    spot.apiBaseline = baseline;
                }
                spot.dataSource = "api";
                return spot;
            })
            .catch(function (err) {
                console.warn(
                    "[mapApi] risk fetch failed for",
                    spot.name || spot.id || key,
                    err
                );
                spot.dataSource = "error";
                spot.apiError = err && err.message ? err.message : String(err);
                // Drop the cache entry so a later retry can re-fetch instead of
                // resurfacing the same error.
                delete spotApiPromiseCache[key];
                throw err;
            });

        spotApiPromiseCache[key] = p;
        return p;
    }

    /**
     * Fetch the city-wide weather grid (~30 stations covering Vancouver) used
     * to drive the heat layer with live data. Returns a flat station array
     * with each station already densified to a 24-entry hourly snapshot —
     * mapHeat.js can plug them straight into its existing per-hour pipeline.
     *
     * The backend (services/weatherGridService.js) batches all stations into
     * a single open-meteo call, so this is a single HTTP request regardless
     * of grid size. Caller is responsible for caching in memory.
     *
     * @returns {Promise<Array<{lat:number,lng:number,hourly24:Array<Object>}>>}
     * @author Jiahao
     */
    function fetchWeatherGrid() {
        return fetch("/api/weather-grid", { headers: { Accept: "application/json" } })
            .then(function (res) {
                if (!res.ok) {
                    throw new Error("Weather grid API responded " + res.status);
                }
                return res.json();
            })
            .then(function (json) {
                if (!json || !Array.isArray(json.stations)) return [];
                var out = [];
                for (var i = 0; i < json.stations.length; i++) {
                    var s = json.stations[i];
                    if (
                        !s ||
                        typeof s.lat !== "number" ||
                        typeof s.lng !== "number" ||
                        !Array.isArray(s.hourly24) ||
                        s.hourly24.length !== 24
                    ) {
                        continue;
                    }
                    out.push({ lat: s.lat, lng: s.lng, hourly24: s.hourly24 });
                }
                return out;
            });
    }

export { fetchSpotRiskData, fetchAllFountains, ensureSpotApiData, fetchWeatherGrid };
