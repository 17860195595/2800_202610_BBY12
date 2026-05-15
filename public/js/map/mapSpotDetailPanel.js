/**
 * @file mapSpotDetailPanel.js
 * Spot detail sheet: bind HTML shell, open/close, /api/risk fetch orchestration, sync header + body.
 * Depends: mapUtils.js, services/mapApi.js, mapSpotDetailRender.js (render*).
 * Shell + templates: index.html (#map-spot-detail-*, #tpl-map-spot-*).
 *
 * Tricky: chart bar → slider needs input+change with bubbles; race-safe fetch with currentSpot check.
 * @author Jiahao
 */

import { ensureSpotApiData } from "../services/mapApi.js";
import { getSpotApiHourly, parseMapTimeHour } from "./mapUtils.js";
import { mapRiskTierFromScore } from "./mapSpotDetailRisk.js";
import { renderDetailStats, renderTemperatureBars } from "./mapSpotDetailRender.js";

/**
 * @typedef {Object} MapSpotDetailUiRefs
 * @property {HTMLElement|null} backdrop
 * @property {HTMLElement|null} panel
 * @property {HTMLElement|null} titleEl
 * @property {HTMLElement|null} riskTierEl
 * @property {HTMLElement|null} timeLabelEl
 * @property {HTMLElement|null} summaryEl
 * @property {HTMLElement|null} statsEl
 * @property {HTMLElement|null} chartEl
 * @property {HTMLElement|null} stateEl
 * @property {HTMLButtonElement|null} retryBtn
 * @property {HTMLButtonElement|null} aiChatBtn
 * @property {HTMLButtonElement|null} closeBtn
 * @property {Object|null} currentSpot
 */

/** @type {MapSpotDetailUiRefs} */
var mapSpotDetailUi = {
    backdrop: null,
    panel: null,
    titleEl: null,
    riskTierEl: null,
    timeLabelEl: null,
    summaryEl: null,
    statsEl: null,
    chartEl: null,
    stateEl: null,
    retryBtn: null,
    aiChatBtn: null,
    closeBtn: null,
    currentSpot: null,
};

function ensureMapSpotDetailUi() {
    if (mapSpotDetailUi.backdrop) {
        return;
    }

    var backdrop = document.getElementById("map-spot-detail-backdrop");
    var panel = document.getElementById("map-spot-detail-panel");
    if (!backdrop || !panel) {
        console.warn("[mapSpotDetail] missing #map-spot-detail-backdrop or #map-spot-detail-panel");
        return;
    }

    backdrop.addEventListener("click", function () {
        closeMapSpotDetail();
    });
    panel.addEventListener("click", function (ev) {
        ev.stopPropagation();
    });

    var title = document.getElementById("map-spot-detail-title");
    var riskTier = document.getElementById("map-spot-detail-risk-tier");
    var timeLabel = document.getElementById("map-spot-detail-time");
    var closeBtn = document.getElementById("map-spot-detail-close");
    var summary = document.getElementById("map-spot-detail-summary");
    var aiChatBtn = document.getElementById("map-spot-detail-ai-chat");
    var state = document.getElementById("map-spot-detail-state");
    var retryBtn = document.getElementById("map-spot-detail-retry");
    var stats = document.getElementById("map-spot-detail-stats");
    var chart = document.getElementById("map-spot-detail-chart");

    if (
        !title ||
        !riskTier ||
        !timeLabel ||
        !closeBtn ||
        !summary ||
        !aiChatBtn ||
        !state ||
        !retryBtn ||
        !stats ||
        !chart
    ) {
        console.warn("[mapSpotDetail] missing one or more #map-spot-detail-* nodes");
        return;
    }

    closeBtn.addEventListener("click", function () {
        closeMapSpotDetail();
    });
    aiChatBtn.addEventListener("click", function () {
        var sel = mapSpotDetailUi.currentSpot;
        if (
            !sel ||
            typeof sel.lat !== "number" ||
            typeof sel.lng !== "number" ||
            isNaN(sel.lat) ||
            isNaN(sel.lng)
        ) {
            return;
        }
        var url = new URL(window.location.origin + "/ai-chat");
        url.searchParams.set("lat", String(sel.lat));
        url.searchParams.set("lng", String(sel.lng));
        url.searchParams.set("name", sel.name || "");
        url.searchParams.set("initialAction", "summary");
        window.location.href = url.toString();
    });
    retryBtn.addEventListener("click", function () {
        if (!mapSpotDetailUi.currentSpot) return;
        beginSpotApiLoad(mapSpotDetailUi.currentSpot);
    });

    mapSpotDetailUi.backdrop = backdrop;
    mapSpotDetailUi.panel = panel;
    mapSpotDetailUi.titleEl = title;
    mapSpotDetailUi.riskTierEl = riskTier;
    mapSpotDetailUi.timeLabelEl = timeLabel;
    mapSpotDetailUi.summaryEl = summary;
    mapSpotDetailUi.statsEl = stats;
    mapSpotDetailUi.chartEl = chart;
    mapSpotDetailUi.stateEl = state;
    mapSpotDetailUi.retryBtn = retryBtn;
    mapSpotDetailUi.aiChatBtn = aiChatBtn;
    mapSpotDetailUi.closeBtn = closeBtn;
}

/**
 * @param {{ kind: 'loading'|'error'|'no-data'|'idle', message?: string }|null} state
 */
function setMapSpotDetailState(state) {
    var ui = mapSpotDetailUi;
    if (!ui.stateEl || !ui.retryBtn) return;
    if (!state || state.kind === "idle") {
        ui.stateEl.hidden = true;
        ui.stateEl.textContent = "";
        ui.stateEl.className = "map-spot-detail-panel__state";
        ui.retryBtn.hidden = true;
        if (ui.panel) ui.panel.classList.remove("is-loading");
        return;
    }
    ui.stateEl.hidden = false;
    ui.stateEl.textContent = state.message || "";
    ui.stateEl.className =
        "map-spot-detail-panel__state map-spot-detail-panel__state--" + state.kind;
    ui.retryBtn.hidden = state.kind !== "error";
    if (ui.panel) {
        if (state.kind === "loading") {
            ui.panel.classList.add("is-loading");
        } else {
            ui.panel.classList.remove("is-loading");
        }
    }
}

/**
 * @param {Object} spot
 */
function beginSpotApiLoad(spot) {
    if (!spot) return;
    setMapSpotDetailState({ kind: "loading", message: "Loading live readings…" });
    syncMapSpotDetailPanel();

    ensureSpotApiData(spot)
        .then(function () {
            if (mapSpotDetailUi.currentSpot !== spot) return;
            if (spot.dataSource === "no-data") {
                setMapSpotDetailState({
                    kind: "no-data",
                    message: "No readings available for this location right now.",
                });
            } else {
                setMapSpotDetailState(null);
            }
            syncMapSpotDetailPanel();
        })
        .catch(function () {
            if (mapSpotDetailUi.currentSpot !== spot) return;
            setMapSpotDetailState({
                kind: "error",
                message: "Could not load live readings. Tap retry to try again.",
            });
            syncMapSpotDetailPanel();
        });
}

/**
 * @param {Object} spot
 */
function openMapSpotDetail(spot) {
    ensureMapSpotDetailUi();
    if (!mapSpotDetailUi.backdrop || !mapSpotDetailUi.panel) {
        return;
    }
    mapSpotDetailUi.currentSpot = spot;
    mapSpotDetailUi.backdrop.hidden = false;
    mapSpotDetailUi.panel.hidden = false;
    mapSpotDetailUi.backdrop.setAttribute("aria-hidden", "false");
    mapSpotDetailUi.panel.setAttribute("aria-hidden", "false");

    if (getSpotApiHourly(spot)) {
        setMapSpotDetailState(null);
        syncMapSpotDetailPanel();
    } else {
        beginSpotApiLoad(spot);
    }

    if (mapSpotDetailUi.closeBtn) {
        mapSpotDetailUi.closeBtn.focus();
    }
}

function closeMapSpotDetail() {
    if (!mapSpotDetailUi.backdrop || !mapSpotDetailUi.panel) {
        return;
    }
    mapSpotDetailUi.backdrop.hidden = true;
    mapSpotDetailUi.panel.hidden = true;
    mapSpotDetailUi.backdrop.setAttribute("aria-hidden", "true");
    mapSpotDetailUi.panel.setAttribute("aria-hidden", "true");
    mapSpotDetailUi.currentSpot = null;
    setMapSpotDetailState(null);
}

/**
 * @returns {Object|null}
 */
function getMapSpotDetailCurrentSpot() {
    if (!mapSpotDetailUi.panel || mapSpotDetailUi.panel.hidden) {
        return null;
    }
    return mapSpotDetailUi.currentSpot || null;
}

function syncMapSpotDetailPanel() {
    var spot = mapSpotDetailUi.currentSpot;
    if (
        !spot ||
        !mapSpotDetailUi.panel ||
        mapSpotDetailUi.panel.hidden ||
        !mapSpotDetailUi.titleEl ||
        !mapSpotDetailUi.summaryEl
    ) {
        return;
    }

    var hour = parseMapTimeHour();
    var label =
        document.body.dataset.mapTimeHm ||
        (hour < 10 ? "0" + hour : String(hour)) + ":00";

    var hourly = getSpotApiHourly(spot);
    var snap = hourly ? hourly[hour] : null;

    mapSpotDetailUi.titleEl.textContent = spot.name || "Location";

    var tier = mapRiskTierFromScore(snap ? snap.riskScore : NaN);
    mapSpotDetailUi.riskTierEl.textContent = tier.label;
    mapSpotDetailUi.riskTierEl.className =
        "map-spot-detail-panel__risk-tier map-spot-detail-panel__risk-tier--" + tier.tier;

    mapSpotDetailUi.timeLabelEl.textContent = "Selected time: " + label;
    mapSpotDetailUi.summaryEl.textContent = spot.summary || "";

    if (mapSpotDetailUi.aiChatBtn) {
        var coordsOk =
            typeof spot.lat === "number" &&
            typeof spot.lng === "number" &&
            !isNaN(spot.lat) &&
            !isNaN(spot.lng);
        mapSpotDetailUi.aiChatBtn.disabled = !coordsOk;
    }

    renderDetailStats(mapSpotDetailUi.statsEl, snap);
    renderTemperatureBars(mapSpotDetailUi.chartEl, hourly, hour);
}

export { openMapSpotDetail, closeMapSpotDetail, syncMapSpotDetailPanel };
