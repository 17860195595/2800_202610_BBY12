/**
 * @file index.js — Map page bootstrap (ES module).
 *
 * Loaded from index.html as <script type="module" src="js/pages/index.js">.
 * Leaflet, leaflet.heat, and Bootstrap bundle are classic scripts; this file uses import/export.
 *
 * @author Jiahao
 */

import {
    MAP_PAGE_CENTER,
    MAP_PAGE_INITIAL_ZOOM,
    MAP_PAGE_ONBOARDING_DELAY_MS,
    MAP_PAGE_MESSAGES,
} from "../map/mapConfig.js";
import { MOCK_MAP_LOCATIONS } from "../data/mockMapLocations.js";
import { parseMapTimeHour } from "../map/mapUtils.js";
import { fetchWeatherGrid, fetchAllFountains } from "../services/mapApi.js";
import { createMapHeatController, setLiveHeatStations } from "../map/mapHeat.js";
import { getUserPosition, getGeolocationPermissionState } from "../map/mapUserLocationGeoloc.js";
import {
    addUserLocationLayer,
    showUserLocation,
    showLocationFallbackAtDefault,
    addLocateControl,
} from "../map/mapUserLocation.js";
import { listReports } from "../services/reportApi.js";
import { renderReportMarkers, addOneReportMarker } from "../map/mapReportMarkers.js";
import { initMapReport, closeMapReportIfOpen } from "../map/mapReport.js";
import {
    addMockLocationMarkers,
    renderSeedSpotPins,
    setBuildingsMode,
    addFountainMarkers,
    setFountainsVisible,
} from "../map/mapMarkers.js";
import { initMapTimeRail } from "../map/mapTimeRail.js";
import { initMapToggleBar } from "../map/mapToggleBar.js";
import { initMapOnboarding, closeMapOnboardingIfOpen } from "../map/mapOnboarding.js";
import { closeMapSpotDetail, syncMapSpotDetailPanel } from "../map/mapSpotDetailPanel.js";

(function () {
    "use strict";

    var center = [MAP_PAGE_CENTER.lat, MAP_PAGE_CENTER.lng];
    var initialZoom = MAP_PAGE_INITIAL_ZOOM;
    var onboardingDelayMs = MAP_PAGE_ONBOARDING_DELAY_MS;
    var msg = MAP_PAGE_MESSAGES;

    /**
     * @param {string} text
     * @param {number} hideAfterMs 0 = stay visible until next message
     */
    function setMapStatusMessage(text, hideAfterMs) {
        var el = document.getElementById("map-data-status");
        if (!el) return;
        el.textContent = text || "";
        el.hidden = !text;
        if (hideAfterMs && text) {
            window.clearTimeout(setMapStatusMessage._t);
            setMapStatusMessage._t = window.setTimeout(function () {
                el.hidden = true;
            }, hideAfterMs);
        }
    }

    function loadLiveHeatGrid(heatController) {
        setMapStatusMessage(msg.loadingLiveWeather, 0);
        fetchWeatherGrid()
            .then(function (stations) {
                if (!stations || !stations.length) {
                    setMapStatusMessage(msg.weatherEmpty, 3000);
                    return;
                }
                setLiveHeatStations(stations);
                if (heatController && typeof heatController.refresh === "function") {
                    heatController.refresh(parseMapTimeHour());
                }
                setMapStatusMessage(msg.liveWeatherStations(stations.length), 2400);
            })
            .catch(function (err) {
                console.warn("[index] weather grid fetch failed", err);
                setMapStatusMessage(msg.liveWeatherUnavailable, 3000);
            });
    }

    function loadFountains(map) {
        fetchAllFountains()
            .then(function (fountains) {
                window.VAN_FOUNTAINS = fountains;
                addFountainMarkers(map, fountains);
                setFountainsVisible(currentTogglePrefs().fountainsOn !== false);
                if (fountains && fountains.length) {
                    setMapStatusMessage(msg.fountainsLoaded(fountains.length), 2400);
                }
            })
            .catch(function (err) {
                console.warn("[index] fountain fetch failed", err);
            });
    }

    function autoLocateOnLoad(map) {
        if (!navigator.geolocation) {
            showLocationFallbackAtDefault(map);
            setMapStatusMessage(msg.geoUnsupported, 4500);
            return;
        }

        getGeolocationPermissionState().then(function (state) {
            console.info("[index] auto-locate permission state:", state);

            if (state === "denied") {
                showLocationFallbackAtDefault(map);
                setMapStatusMessage(msg.locBlocked, 5200);
                return;
            }

            setMapStatusMessage(msg.locating, 0);

            getUserPosition({ force: true })
                .then(function (pos) {
                    showUserLocation(pos);
                    map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 14));
                    setMapStatusMessage(msg.centeredOnYou, 1800);
                })
                .catch(function (err) {
                    if (err && err.kind === "denied") {
                        showLocationFallbackAtDefault(map);
                        setMapStatusMessage(msg.locBlocked, 5200);
                    } else {
                        console.info("[index] auto-locate failed:", err && err.message);
                        setMapStatusMessage((err && err.message) || msg.couldntLocate, 3000);
                    }
                });
        });
    }

    function loadReports(map) {
        listReports({})
            .then(function (reports) {
                renderReportMarkers(map, reports);
                if (reports && reports.length) {
                    setMapStatusMessage(msg.reportsLoaded(reports.length), 2400);
                }
            })
            .catch(function (err) {
                console.warn("[index] report fetch failed", err);
            });
    }

    function bindReportCreatedEvent(map) {
        window.addEventListener("maptoggle:report-created", function (ev) {
            var detail = ev.detail || {};
            var report = detail.report;
            var pos = detail.position;
            if (report) {
                addOneReportMarker(report);
            }
            if (pos) {
                if (pos.isFallback) {
                    showLocationFallbackAtDefault(map);
                } else {
                    showUserLocation(pos);
                }
                if (typeof map.flyTo === "function") {
                    map.flyTo([pos.lat, pos.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
                }
            }
        });
    }

    var lastTogglePrefs = { buildingsMode: "local", fountainsOn: true, heatOn: true };
    function currentTogglePrefs() {
        return lastTogglePrefs;
    }

    function bindToggleBar(map, heatController) {
        window.addEventListener("maptoggle:buildings", function (ev) {
            var mode = ev.detail && ev.detail.mode;
            lastTogglePrefs.buildingsMode = mode;
            setBuildingsMode(mode, MOCK_MAP_LOCATIONS);
        });

        window.addEventListener("maptoggle:fountains", function (ev) {
            var visible = !!(ev.detail && ev.detail.visible);
            lastTogglePrefs.fountainsOn = visible;
            setFountainsVisible(visible);
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

    var map = L.map(mapEl, { zoomControl: true, scrollWheelZoom: true }).setView(
        center,
        initialZoom
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
    }).addTo(map);

    function invalidateSize() {
        map.invalidateSize();
    }
    requestAnimationFrame(invalidateSize);
    setTimeout(invalidateSize, 250);
    window.addEventListener("resize", invalidateSize);

    var heat = createMapHeatController(map);
    addMockLocationMarkers(map);
    renderSeedSpotPins(map, MOCK_MAP_LOCATIONS);
    addUserLocationLayer(map);
    addLocateControl(map, { onStatus: setMapStatusMessage });
    initMapTimeRail(invalidateSize);
    window.addEventListener("maptimechange", function () {
        syncMapSpotDetailPanel();
    });

    var sliderEl = document.getElementById("map-time-slider");
    if (sliderEl && heat) {
        function refreshHeatFromSlider() {
            var hour = parseInt(sliderEl.value, 10);
            if (isNaN(hour)) hour = parseMapTimeHour();
            heat.refresh(hour);
        }
        sliderEl.addEventListener("input", refreshHeatFromSlider);
        sliderEl.addEventListener("change", refreshHeatFromSlider);
    }
    if (heat) {
        heat.refresh(parseMapTimeHour());
    }

    initMapReport();
    initMapOnboarding({ delayMs: onboardingDelayMs });

    document.addEventListener("keydown", function (ev) {
        if (ev.key !== "Escape") return;
        if (closeMapOnboardingIfOpen()) return;
        if (closeMapReportIfOpen()) return;
        closeMapSpotDetail();
    });

    bindToggleBar(map, heat);
    bindReportCreatedEvent(map);

    autoLocateOnLoad(map);
    loadLiveHeatGrid(heat);
    loadFountains(map);
    loadReports(map);
})();
