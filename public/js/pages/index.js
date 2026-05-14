/**
 * @file index.js — Map page bootstrap.
 *
 * Boot order:
 *   1. Create the Leaflet map + OSM tiles.
 *   2. Build the heat layer. First paint uses the mock-synthesized series on
 *      MOCK_MAP_LOCATIONS so the layer appears instantly, then we kick off
 *      /api/weather-grid (single batched open-meteo call) and swap to live
 *      stations as soon as it lands.
 *   3. Render the seed pins (Local mode default). Clicking a pin lazily
 *      fetches /api/risk for that single location via mapSpotDetail.js +
 *      services/mapApi.js → ensureSpotApiData. Nothing else is pre-warmed.
 *   4. Wire the time rail, toggle bar, report, onboarding, and global escape.
 *   5. Kick off the side fetches — fountains (/api/fountains, ~250 rows) and
 *      city buildings (lazy: only when the user actually switches to City
 *      mode, since the dataset is tens of thousands of points).
 *
 * The 100 seeds in MOCK_MAP_LOCATIONS now ship without any weather data;
 * detail-panel numbers come 100% from the live backend, and the heat layer
 * is driven by the live /api/weather-grid after the initial mock paint.
 *
 * @author Jiahao
 */

(function () {
    "use strict";

    var MAP_CENTER = [49.2827, -123.1207];
    var INITIAL_ZOOM = 12;
    var ONBOARDING_DELAY_MS = 550;

    /**
     * @param {HTMLElement} mountEl
     * @returns {L.Map}
     * @author Jiahao
     */
    function createMapInstance(mountEl) {
        return L.map(mountEl, {
            zoomControl: true,
            scrollWheelZoom: true,
        }).setView(MAP_CENTER, INITIAL_ZOOM);
    }

    /**
     * @param {L.Map} map
     * @author Jiahao
     */
    function attachBaseTiles(map) {
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(map);
    }

    /**
     * @param {L.Map} map
     * @returns {function}
     * @author Jiahao
     */
    function bindMapInvalidation(map) {
        function invalidate() {
            map.invalidateSize();
        }
        requestAnimationFrame(invalidate);
        setTimeout(invalidate, 250);
        window.addEventListener("resize", invalidate);
        return invalidate;
    }

    /**
     * @author Jiahao
     */
    function bindDetailSyncOnTimeChange() {
        window.addEventListener("maptimechange", function () {
            syncMapSpotDetailPanel();
        });
    }

    /**
     * @param {L.Map} map
     * @returns {Object|null}
     * @author Jiahao
     */
    function createHeatController(map) {
        return typeof createMapHeatController === "function"
            ? createMapHeatController(map)
            : null;
    }

    /**
     * @param {HTMLInputElement} sliderEl
     * @returns {number}
     * @author Jiahao
     */
    function parseHourFromSlider(sliderEl) {
        var hour = parseInt(sliderEl.value, 10);
        if (isNaN(hour)) {
            hour = parseMapTimeHour();
        }
        return hour;
    }

    /**
     * @param {Object|null} heatController
     * @author Jiahao
     */
    function bindHeatRefreshToSlider(heatController) {
        var sliderEl = document.getElementById("map-time-slider");
        if (!sliderEl || !heatController) {
            return;
        }
        function refreshHeatFromSlider() {
            heatController.refresh(parseHourFromSlider(sliderEl));
        }
        sliderEl.addEventListener("input", refreshHeatFromSlider);
        sliderEl.addEventListener("change", refreshHeatFromSlider);
    }

    /**
     * @author Jiahao
     */
    function initOptionalUiModules() {
        if (typeof initMapReport === "function") {
            initMapReport();
        }
        if (typeof initMapOnboarding === "function") {
            initMapOnboarding({ delayMs: ONBOARDING_DELAY_MS });
        }
    }

    /**
     * @author Jiahao
     */
    function bindGlobalEscapeHandlers() {
        document.addEventListener("keydown", function (ev) {
            if (ev.key !== "Escape") {
                return;
            }
            if (typeof closeMapOnboardingIfOpen === "function" && closeMapOnboardingIfOpen()) {
                return;
            }
            if (typeof closeMapReportIfOpen === "function" && closeMapReportIfOpen()) {
                return;
            }
            closeMapSpotDetail();
        });
    }

    /**
     * Show a transient toast-like status in the corner. Reused for "Loading…"
     * / fountain count / city building count messages.
     * @param {string} text
     * @param {number} hideAfterMs Hide after this many ms (0 = keep)
     * @author Jiahao
     */
    function setMapStatusMessage(text, hideAfterMs) {
        var el = document.getElementById("map-data-status");
        if (!el) {
            el = document.createElement("div");
            el.id = "map-data-status";
            el.className = "map-data-status";
            el.setAttribute("role", "status");
            el.setAttribute("aria-live", "polite");
            document.body.appendChild(el);
        }
        el.textContent = text || "";
        el.hidden = !text;
        if (hideAfterMs && text) {
            window.clearTimeout(setMapStatusMessage._t);
            setMapStatusMessage._t = window.setTimeout(function () {
                el.hidden = true;
            }, hideAfterMs);
        }
    }

    /** Lazy fetch for the city-wide building footprint dataset. Kept on a
     *  module-level promise so multiple toggles into City mode don't kick
     *  off parallel fetches. fetchAllCityBuildings already caches in
     *  localStorage for 7 days, so this is mostly an in-memory dedupe. */
    var cityBuildingsPromise = null;

    /**
     * Trigger (or join) the lazy city-buildings fetch. The result is rendered
     * via renderCityBuildingPins, which itself respects the current toggle
     * mode (only attaches to the map when City is active).
     *
     * @returns {Promise<Array>} resolves with the building list
     * @author Jiahao
     */
    function ensureCityBuildingsLoaded() {
        if (typeof fetchAllCityBuildings !== "function") {
            return Promise.resolve([]);
        }
        if (cityBuildingsPromise) return cityBuildingsPromise;

        setMapStatusMessage("Loading city buildings…", 0);
        cityBuildingsPromise = fetchAllCityBuildings()
            .then(function (buildings) {
                window.VAN_BUILDINGS = buildings;
                if (typeof renderCityBuildingPins === "function") {
                    renderCityBuildingPins(buildings, MOCK_MAP_LOCATIONS);
                }
                setMapStatusMessage(
                    buildings.length.toLocaleString() + " buildings loaded",
                    2400
                );
                return buildings;
            })
            .catch(function (err) {
                console.warn("[index] city building fetch failed", err);
                setMapStatusMessage("Could not load city buildings", 3000);
                cityBuildingsPromise = null;
                return [];
            });
        return cityBuildingsPromise;
    }

    /**
     * Fire-and-forget pull of the city-wide weather grid (one batched
     * open-meteo call covering ~30 stations). The heat layer is already on
     * screen from the mock series; once this resolves we hand the stations
     * to mapHeat.js, invalidate the cached gradient range, and refresh the
     * layer so it smoothly swaps over to real readings.
     *
     * Failure is non-fatal — the mock heat stays as the visible fallback.
     *
     * @param {Object|null} heatController
     * @author Jiahao
     */
    function loadLiveHeatGrid(heatController) {
        if (typeof fetchWeatherGrid !== "function") return;
        setMapStatusMessage("Loading live weather…", 0);
        fetchWeatherGrid()
            .then(function (stations) {
                if (!stations || !stations.length) {
                    setMapStatusMessage("Weather grid empty — using mock heat", 3000);
                    return;
                }
                if (typeof setLiveHeatStations === "function") {
                    setLiveHeatStations(stations);
                }
                if (typeof resetMockHeatGlobalTempRangeCache === "function") {
                    resetMockHeatGlobalTempRangeCache();
                }
                if (heatController && typeof heatController.refresh === "function") {
                    heatController.refresh(parseMapTimeHour());
                }
                setMapStatusMessage(
                    "Live weather · " + stations.length + " stations",
                    2400
                );
            })
            .catch(function (err) {
                console.warn("[index] weather grid fetch failed", err);
                setMapStatusMessage("Live weather unavailable — using mock heat", 3000);
            });
    }

    /**
     * Fire-and-forget fountain fetch. Does not touch /api/risk and does not
     * block the seed pin / heat layer rendering.
     * @param {L.Map} map
     * @author Jiahao
     */
    function loadFountains(map) {
        if (typeof fetchAllFountains !== "function") return;
        fetchAllFountains()
            .then(function (fountains) {
                window.VAN_FOUNTAINS = fountains;
                if (typeof addFountainMarkers === "function") {
                    addFountainMarkers(map, fountains);
                }
                if (typeof setFountainsVisible === "function") {
                    setFountainsVisible(currentTogglePrefs().fountainsOn !== false);
                }
                if (fountains && fountains.length) {
                    setMapStatusMessage(fountains.length + " fountains loaded", 2400);
                }
            })
            .catch(function (err) {
                console.warn("[index] fountain fetch failed", err);
            });
    }

    /** Cache of the latest toggle prefs as advertised by the toggle bar.
     *  Re-read from the bar's events so we never have to re-query the DOM. */
    var lastTogglePrefs = { buildingsMode: "local", fountainsOn: true, heatOn: true };
    function currentTogglePrefs() {
        return lastTogglePrefs;
    }

    /**
     * Wire the floating toggle bar events to the actual map layers. The bar
     * itself is dumb: it only knows preferences and emits events. Layer
     * ownership stays here in the bootstrap.
     *
     * Local mode → seed spot pins (already on the map by default).
     * City mode  → kicks the lazy city-building fetch the first time it is
     *              activated, then attaches the cluster.
     *
     * @param {L.Map} map
     * @param {Object|null} heatController
     * @author Jiahao
     */
    function bindToggleBar(map, heatController) {
        if (typeof initMapToggleBar !== "function") return;

        window.addEventListener("maptoggle:buildings", function (ev) {
            var mode = ev.detail && ev.detail.mode;
            lastTogglePrefs.buildingsMode = mode;
            if (typeof setBuildingsMode !== "function") return;
            setBuildingsMode(mode, MOCK_MAP_LOCATIONS);
            if (mode === "city") {
                ensureCityBuildingsLoaded();
            }
        });

        window.addEventListener("maptoggle:fountains", function (ev) {
            var visible = !!(ev.detail && ev.detail.visible);
            lastTogglePrefs.fountainsOn = visible;
            if (typeof setFountainsVisible === "function") {
                setFountainsVisible(visible);
            }
        });

        window.addEventListener("maptoggle:heat", function (ev) {
            var visible = !!(ev.detail && ev.detail.visible);
            lastTogglePrefs.heatOn = visible;
            if (heatController && typeof heatController.setVisible === "function") {
                heatController.setVisible(visible);
            }
        });

        var initial = initMapToggleBar();
        if (initial) {
            lastTogglePrefs = {
                buildingsMode: initial.buildingsMode || "local",
                fountainsOn: initial.fountainsOn !== false,
                heatOn: initial.heatOn !== false,
            };
        }
    }

    var mapEl = document.getElementById("map");
    if (!mapEl || typeof L === "undefined") {
        return;
    }

    var map = createMapInstance(mapEl);
    attachBaseTiles(map);
    var invalidate = bindMapInvalidation(map);

    var heat = createHeatController(map);
    addMockLocationMarkers(map);
    if (typeof renderSeedSpotPins === "function") {
        renderSeedSpotPins(map, MOCK_MAP_LOCATIONS);
    }
    initMapTimeRail(invalidate);
    bindDetailSyncOnTimeChange();
    bindHeatRefreshToSlider(heat);
    if (heat) {
        heat.refresh(parseMapTimeHour());
    }

    initOptionalUiModules();
    bindGlobalEscapeHandlers();
    bindToggleBar(map, heat);

    loadLiveHeatGrid(heat);
    loadFountains(map);
})();
