/**
 * @file index.js — Map page bootstrap.
 *
 * Boot order:
 *   1. Create the Leaflet map + OSM tiles. Initial view is Vancouver
 *      centre so the page never starts blank, then we kick off a single
 *      auto-locate that pans / drops the user dot if the browser hands
 *      us a GPS fix. Permission denied / timeout / unsupported all fall
 *      through silently — the user is already looking at the Vancouver
 *      default and the Locate button stays available for retry.
 *   2. Build the heat layer. First paint uses the mock-synthesized series on
 *      MOCK_MAP_LOCATIONS so the layer appears instantly, then we kick off
 *      /api/weather-grid (single batched open-meteo call) and swap to live
 *      stations as soon as it lands.
 *   3. Render the seed pins (Local mode default). Clicking a pin lazily
 *      fetches /api/risk for that single location via mapSpotDetail.js +
 *      services/mapApi.js → ensureSpotApiData. Nothing else is pre-warmed.
 *   4. Wire the time rail, toggle bar, report, onboarding, and global escape.
 *      Mount the Locate control (top-left, below zoom).
 *   5. Kick off the side fetches:
 *        - live weather grid (heat layer swap)
 *        - fountains
 *        - crowd-sourced /api/reports → renderReportMarkers
 *
 * The 100 seeds in MOCK_MAP_LOCATIONS now ship without any weather data;
 * detail-panel numbers come 100% from the live backend, and the heat layer
 * is driven by the live /api/weather-grid after the initial mock paint.
 *
 * A previous "City" mode pre-fetched every Vancouver building footprint
 * (~tens of thousands of points) for a clustered overlay; that path was
 * removed because the Open Data exports endpoint is too slow and the 100
 * curated seed locations cover the actual use case.
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
     * / fountain count / weather-grid messages.
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

    /**
     * Try to grab the user's GPS as soon as the map is on screen. On
     * success we drop the blue "you are here" dot and pan the camera to
     * the fix; on any failure (permission denied, timeout, unsupported)
     * we stay at the Vancouver centre that we already painted and emit
     * a status toast so the user understands why no dot showed up.
     *
     * The Permissions API is consulted first so we don't re-emit a
     * "permission denied" error on every page load for users who have
     * already declined — the browser remembers their answer and we
     * shouldn't pester it (or the console). When that permission is
     * "denied" we surface a toast pointing the user at the Locate
     * button + browser site-settings, because just being silent leaves
     * them wondering why nothing happened.
     *
     * The 60 s in-memory cache in mapUserLocation.js means a follow-up
     * Locate-button click or Report-submit within a minute reuses this
     * fix without re-prompting.
     *
     * @param {L.Map} map
     * @author Jiahao
     */
    function autoLocateOnLoad(map) {
        if (typeof getUserPosition !== "function") return;

        if (!navigator.geolocation) {
            if (typeof showLocationFallbackAtDefault === "function") {
                showLocationFallbackAtDefault(map);
            }
            setMapStatusMessage("Geolocation not supported — showing default map centre.", 4500);
            return;
        }

        var permissionCheck =
            typeof getGeolocationPermissionState === "function"
                ? getGeolocationPermissionState()
                : Promise.resolve("unknown");

        permissionCheck.then(function (state) {
            console.info("[index] auto-locate permission state:", state);

            if (state === "denied") {
                if (typeof showLocationFallbackAtDefault === "function") {
                    showLocationFallbackAtDefault(map);
                }
                setMapStatusMessage(
                    "Location blocked — showing Vancouver. Allow location in site settings.",
                    5200
                );
                return;
            }

            // 'prompt' / 'unknown' / 'granted' all proceed. Show a
            // brief "Locating…" so the user knows something is in
            // flight — the OS permission dialog can take a second or
            // two to appear and a blank map is confusing.
            setMapStatusMessage("Locating you…", 0);

            getUserPosition({ force: true })
                .then(function (pos) {
                    if (typeof showUserLocation === "function") {
                        showUserLocation(pos);
                    }
                    // setView (not flyTo) — the map literally just
                    // appeared, so animating from the Vancouver default
                    // would look like a glitch instead of a deliberate pan.
                    map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 14));
                    setMapStatusMessage("Centered on your location", 1800);
                })
                .catch(function (err) {
                    if (err && err.kind === "denied") {
                        if (typeof showLocationFallbackAtDefault === "function") {
                            showLocationFallbackAtDefault(map);
                        }
                        setMapStatusMessage(
                            "Location blocked — showing Vancouver. Allow location in site settings.",
                            5200
                        );
                    } else {
                        console.info(
                            "[index] auto-locate failed:",
                            err && err.message
                        );
                        setMapStatusMessage(
                            (err && err.message) || "Couldn't locate you",
                            3000
                        );
                    }
                });
        });
    }

    /**
     * Pull all persisted reports from /api/reports and render them. Failure
     * is swallowed (the backend already degrades gracefully when MongoDB is
     * offline by returning an empty list) — there's nothing actionable for
     * the user, the map still works.
     * @param {L.Map} map
     * @author Jiahao
     */
    function loadReports(map) {
        if (typeof listReports !== "function" || typeof renderReportMarkers !== "function") {
            return;
        }
        listReports({})
            .then(function (reports) {
                renderReportMarkers(map, reports);
                if (reports && reports.length) {
                    setMapStatusMessage(reports.length + " reports loaded", 2400);
                }
            })
            .catch(function (err) {
                console.warn("[index] report fetch failed", err);
            });
    }

    /**
     * Wire the Report-submit success event to two visible side effects:
     *   1. Optimistically drop the new pin on the map without re-fetching.
     *   2. Pan to the user's freshly-captured location so the new pin is
     *      in view, and update the shared user-location dot.
     * @param {L.Map} map
     * @author Jiahao
     */
    function bindReportCreatedEvent(map) {
        window.addEventListener("maptoggle:report-created", function (ev) {
            var detail = ev.detail || {};
            var report = detail.report;
            var pos = detail.position;
            if (report && typeof addOneReportMarker === "function") {
                addOneReportMarker(report);
            }
            if (pos) {
                if (pos.isFallback && typeof showLocationFallbackAtDefault === "function") {
                    showLocationFallbackAtDefault(map);
                } else if (typeof showUserLocation === "function") {
                    showUserLocation(pos);
                }
                if (typeof map.flyTo === "function") {
                    map.flyTo([pos.lat, pos.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
                }
            }
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
     * Off mode   → detach the seed pin layer.
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
    if (typeof addUserLocationLayer === "function") {
        addUserLocationLayer(map);
    }
    if (typeof addLocateControl === "function") {
        addLocateControl(map, { onStatus: setMapStatusMessage });
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
    bindReportCreatedEvent(map);

    autoLocateOnLoad(map);
    loadLiveHeatGrid(heat);
    loadFountains(map);
    loadReports(map);
})();
