/**
 * @file mapSpotDetail.js
 * Location detail "sheet": dialog panel above the map (below the bottom dock), stats, 24h bar chart.
 *
 * Live-data only: the panel renders nothing but values returned from
 * /api/risk. When the user opens a pin we kick off ensureSpotApiData(spot),
 * show a loading state until it resolves, and only then populate the stats
 * and bar chart. The mock series attached in mockMapLocations.js is reserved
 * for the heat layer and is intentionally not consumed here.
 *
 * Depends on: mapUtils.js — escapeHtmlMap, formatShadeScore, parseMapTimeHour,
 * getSpotApiHourly; services/mapApi.js — ensureSpotApiData.
 *
 * Styling: public/css/pages/map.css (panel, chart, tier colors). z-index stays under the tab bar.
 *
 * Tricky bits (validated with Claude AI + MDN while wiring):
 *   - Bar click → time slider: programmatic value change does not fire "input" natively; we
 *     dispatch input + change with bubbles:true so initMapTimeRail and the heat refresh listener run.
 *   - UV row uses innerHTML only after escapeHtmlMap on the label fragment; numeric parts are plain text.
 *   - Race-safe loading: when the user clicks pin A, then immediately pin B,
 *     A's resolved fetch must not overwrite the panel that is now showing B.
 *     We guard renders with the currentSpot identity check.
 * @author Jiahao
 */

/** Upper bound (exclusive) for LOW tier in °C; keep in sync with chart/badge CSS modifiers. */
var MAP_TEMP_LOW_MAX_C = 18;
/** Lower bound (inclusive) for HIGH tier in °C. */
var MAP_TEMP_HIGH_MIN_C = 24;

/**
 * Map Celsius to LOW / MID / HIGH for the detail badge and chart bar hue.
 * @param {number} tempC
 * @returns {{ tier: string, label: string }}
 * @author Jiahao
 */
function mapTempTierFromCelsius(tempC) {
    if (typeof tempC !== "number" || isNaN(tempC)) {
        return { tier: "unknown", label: "—" };
    }
    if (tempC < MAP_TEMP_LOW_MAX_C) {
        return { tier: "low", label: "LOW" };
    }
    if (tempC < MAP_TEMP_HIGH_MIN_C) {
        return { tier: "mid", label: "MID" };
    }
    return { tier: "high", label: "HIGH" };
}

/**
 * Singleton DOM refs for the detail UI (filled once in ensureMapSpotDetailUi).
 * @typedef {Object} MapSpotDetailUiRefs
 * @property {HTMLElement|null} backdrop
 * @property {HTMLElement|null} panel
 * @property {HTMLElement|null} titleEl
 * @property {HTMLElement|null} tempTierEl
 * @property {HTMLElement|null} timeLabelEl
 * @property {HTMLElement|null} summaryEl
 * @property {HTMLElement|null} statsEl
 * @property {HTMLElement|null} chartEl
 * @property {HTMLElement|null} stateEl
 * @property {HTMLButtonElement|null} retryBtn
 * @property {HTMLButtonElement|null} closeBtn
 * @property {Object|null} currentSpot
 */

/** @type {MapSpotDetailUiRefs} */
var mapSpotDetailUi = {
    backdrop: null,
    panel: null,
    titleEl: null,
    tempTierEl: null,
    timeLabelEl: null,
    summaryEl: null,
    statsEl: null,
    chartEl: null,
    stateEl: null,
    retryBtn: null,
    closeBtn: null,
    currentSpot: null,
};

/**
 * One-time DOM build: backdrop + aside appended to body. Click backdrop closes; panel stops propagation.
 * @author Jiahao
 */
function ensureMapSpotDetailUi() {
    if (mapSpotDetailUi.backdrop) {
        return;
    }

    var backdrop = document.createElement("div");
    backdrop.className = "map-spot-detail-backdrop";
    backdrop.hidden = true;
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.addEventListener("click", function () {
        closeMapSpotDetail();
    });

    var panel = document.createElement("aside");
    panel.className = "map-spot-detail-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "map-spot-detail-title");
    panel.addEventListener("click", function (ev) {
        ev.stopPropagation();
    });

    var head = document.createElement("header");
    head.className = "map-spot-detail-panel__head";

    var title = document.createElement("h2");
    title.className = "map-spot-detail-panel__title";
    title.id = "map-spot-detail-title";

    var tempTier = document.createElement("p");
    tempTier.className = "map-spot-detail-panel__temp-tier map-spot-detail-panel__temp-tier--unknown";
    tempTier.setAttribute("aria-live", "polite");

    var timeLabel = document.createElement("p");
    timeLabel.className = "map-spot-detail-panel__time";
    timeLabel.setAttribute("aria-live", "polite");

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "map-spot-detail-panel__close";
    closeBtn.setAttribute("aria-label", "Close location details");
    closeBtn.textContent = "\u00D7";
    closeBtn.addEventListener("click", function () {
        closeMapSpotDetail();
    });

    head.appendChild(title);
    head.appendChild(tempTier);
    head.appendChild(timeLabel);
    head.appendChild(closeBtn);

    var body = document.createElement("div");
    body.className = "map-spot-detail-panel__body";

    var summary = document.createElement("p");
    summary.className = "map-spot-detail-panel__summary";

    // The state element doubles as both loading and error display. Hidden
    // entirely once live data lands so it does not leave a dead row in the
    // panel. role="status" + aria-live keeps screen readers in the loop.
    var state = document.createElement("div");
    state.className = "map-spot-detail-panel__state";
    state.setAttribute("role", "status");
    state.setAttribute("aria-live", "polite");
    state.hidden = true;

    var retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "map-spot-detail-panel__retry";
    retryBtn.textContent = "Retry";
    retryBtn.hidden = true;
    retryBtn.addEventListener("click", function () {
        if (!mapSpotDetailUi.currentSpot) return;
        beginSpotApiLoad(mapSpotDetailUi.currentSpot);
    });

    var stats = document.createElement("dl");
    stats.className = "map-spot-detail-panel__stats";

    var chartSection = document.createElement("section");
    chartSection.className = "map-spot-detail-chart-section";
    var chartHeading = document.createElement("h3");
    chartHeading.className = "map-spot-detail-chart-section__title";
    var chartEyebrow = document.createElement("span");
    chartEyebrow.className = "map-spot-detail-chart-section__eyebrow";
    chartEyebrow.textContent = "24-hour outlook";
    var chartHeadline = document.createElement("span");
    chartHeadline.className = "map-spot-detail-chart-section__headline";
    chartHeadline.textContent = "Temperature";
    chartHeading.appendChild(chartEyebrow);
    chartHeading.appendChild(chartHeadline);
    var chartWell = document.createElement("div");
    chartWell.className = "map-spot-detail-chart-well";
    var chart = document.createElement("div");
    chart.className = "map-spot-detail-chart";
    chart.setAttribute("role", "img");
    chart.setAttribute(
        "aria-label",
        "Bar chart of temperature by hour; matches the time-of-day control above the tab bar."
    );
    chartWell.appendChild(chart);
    chartSection.appendChild(chartHeading);
    chartSection.appendChild(chartWell);

    var note = document.createElement("p");
    note.className = "map-spot-detail-panel__note";
    note.textContent = "Live readings from /api/risk for this exact location.";

    body.appendChild(summary);
    body.appendChild(state);
    body.appendChild(retryBtn);
    body.appendChild(stats);
    body.appendChild(chartSection);
    body.appendChild(note);

    panel.appendChild(head);
    panel.appendChild(body);

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    mapSpotDetailUi.backdrop = backdrop;
    mapSpotDetailUi.panel = panel;
    mapSpotDetailUi.titleEl = title;
    mapSpotDetailUi.tempTierEl = tempTier;
    mapSpotDetailUi.timeLabelEl = timeLabel;
    mapSpotDetailUi.summaryEl = summary;
    mapSpotDetailUi.statsEl = stats;
    mapSpotDetailUi.chartEl = chart;
    mapSpotDetailUi.stateEl = state;
    mapSpotDetailUi.retryBtn = retryBtn;
    mapSpotDetailUi.closeBtn = closeBtn;
}

/**
 * @param {Object} snap
 * @returns {string}
 * @author Jiahao
 */
function formatDetailTemp(snap) {
    if (snap && typeof snap.tempC === "number" && !isNaN(snap.tempC)) {
        return snap.tempC + "°C";
    }
    return "—";
}

/**
 * Render the definition list for the selected hour's snapshot. Pass null/{}
 * during the loading state so every row collapses to em dashes — visually
 * differentiating "not loaded yet" from a real reading of zero.
 * @param {HTMLElement} statsEl
 * @param {Object|null} snap Hourly row from getSpotApiHourly, or null while loading
 * @author Jiahao
 */
function renderDetailStats(statsEl, snap) {
    statsEl.textContent = "";
    var s = snap || {};
    var rows = [
        { label: "Temperature", value: formatDetailTemp(s) },
        {
            label: "UV index",
            value:
                (typeof s.uvIndex === "number" && !isNaN(s.uvIndex) ? String(s.uvIndex) : "—") +
                (s.uvLevel ? " (" + escapeHtmlMap(s.uvLevel) + ")" : ""),
            rawHtmlValue: true,
        },
        {
            label: "Humidity",
            value:
                typeof s.humidityPct === "number" && !isNaN(s.humidityPct)
                    ? s.humidityPct + "%"
                    : "—",
        },
        {
            label: "Wind",
            value:
                typeof s.windKmh === "number" && !isNaN(s.windKmh)
                    ? s.windKmh + " km/h"
                    : "—",
        },
        { label: "Shade coverage", value: formatShadeScore(s.shadeScore) },
        {
            label: "Heat risk",
            value:
                typeof s.riskScore === "number" && !isNaN(s.riskScore)
                    ? Math.round(Math.max(0, Math.min(1, s.riskScore)) * 100) + "%"
                    : "—",
        },
    ];

    for (var i = 0; i < rows.length; i++) {
        var row = document.createElement("div");
        row.className = "map-spot-detail-panel__row";
        var dt = document.createElement("dt");
        dt.textContent = rows[i].label;
        var dd = document.createElement("dd");
        if (rows[i].rawHtmlValue) {
            dd.innerHTML = rows[i].value;
        } else {
            dd.textContent = rows[i].value;
        }
        row.appendChild(dt);
        row.appendChild(dd);
        statsEl.appendChild(row);
    }
}

/**
 * 24 buttons laid out as a mini bar chart. Pass null/[] while data is loading
 * to render an empty placeholder; otherwise heights encode temp within the
 * day's min–max for this spot. CSS classes encode LOW/MID/HIGH tier per bar.
 * Each bar uses an IIFE (function (hour) { ... })(h) so the click handler
 * closes over the correct index.
 * @param {HTMLElement} chartEl
 * @param {Array<Object>|null} hourly  null while loading
 * @param {number} selectedHour
 * @author Jiahao
 */
function renderTemperatureBars(chartEl, hourly, selectedHour) {
    chartEl.textContent = "";
    if (!hourly || !hourly.length) {
        chartEl.classList.add("map-spot-detail-chart--empty");
        return;
    }
    chartEl.classList.remove("map-spot-detail-chart--empty");

    var temps = [];
    for (var t = 0; t < hourly.length; t++) {
        temps.push(typeof hourly[t].tempC === "number" ? hourly[t].tempC : 0);
    }
    var minT = Math.min.apply(null, temps);
    var maxT = Math.max.apply(null, temps);
    var span = maxT - minT;
    if (span < 0.5) {
        span = 1;
    }

    var ticks = document.createElement("div");
    ticks.className = "map-spot-detail-chart__ticks";
    ticks.setAttribute("aria-hidden", "true");

    for (var h = 0; h < 24; h++) {
        var wrap = document.createElement("button");
        wrap.type = "button";
        var temp = typeof hourly[h].tempC === "number" ? hourly[h].tempC : minT;
        var tierInfo = mapTempTierFromCelsius(
            typeof hourly[h].tempC === "number" ? hourly[h].tempC : NaN
        );
        wrap.className =
            "map-spot-detail-chart__bar-wrap map-spot-detail-chart__bar-wrap--" + tierInfo.tier;
        if (h === selectedHour) {
            wrap.classList.add("is-selected");
        }
        var pct = ((temp - minT) / span) * 100;
        pct = Math.max(12, Math.min(100, pct));

        var bar = document.createElement("span");
        bar.className = "map-spot-detail-chart__bar map-spot-detail-chart__bar--" + tierInfo.tier;
        bar.style.height = pct + "%";

        var lab = document.createElement("span");
        lab.className = "map-spot-detail-chart__hour";
        lab.textContent = h % 6 === 0 ? String(h) : "";

        wrap.appendChild(bar);
        wrap.appendChild(lab);

        var tip =
            (hourly[h].hour != null ? hourly[h].hour : h) +
            ":00 — " +
            (typeof hourly[h].tempC === "number" ? hourly[h].tempC + "°C" : "—");
        wrap.setAttribute("title", tip);
        wrap.setAttribute("aria-label", "Set time to " + h + ":00");

        (function (hour) {
            wrap.addEventListener("click", function () {
                var slider = document.getElementById("map-time-slider");
                if (!slider) return;
                slider.value = String(hour);
                slider.dispatchEvent(new Event("input", { bubbles: true }));
                slider.dispatchEvent(new Event("change", { bubbles: true }));
            });
        })(h);

        ticks.appendChild(wrap);
    }

    chartEl.appendChild(ticks);
}

/**
 * Update the inline status row above the stats. Pass null to hide it; the
 * retry button only shows up in the "error" state. Stays out of the way once
 * live data lands so the panel reads clean.
 * @param {{ kind: 'loading'|'error'|'no-data'|'idle', message?: string }|null} state
 * @author Jiahao
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
 * Kick off (or re-kick) ensureSpotApiData for the given spot. Updates the
 * panel state to "loading", and on resolution re-renders — but only if the
 * panel is still pointed at the same spot (the user may have clicked
 * elsewhere mid-fetch).
 * @param {Object} spot
 * @author Jiahao
 */
function beginSpotApiLoad(spot) {
    if (!spot) return;
    if (typeof ensureSpotApiData !== "function") {
        setMapSpotDetailState({
            kind: "error",
            message: "Live data client unavailable.",
        });
        return;
    }
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
 * Open the detail panel for a spot and sync to the current time rail hour.
 * Triggers a lazy /api/risk fetch if this spot has never been hydrated; the
 * panel shows a loading state until the response lands.
 * @param {Object} spot
 * @author Jiahao
 */
function openMapSpotDetail(spot) {
    ensureMapSpotDetailUi();
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

/**
 * Close the spot detail panel and clear selected spot state.
 * @author Jiahao
 */
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
 * Spot currently shown in the detail sheet, if the sheet is open.
 * Used to pre-select a location in the report modal (see mapReport.js).
 * @returns {Object|null}
 * @author Jiahao
 */
function getMapSpotDetailCurrentSpot() {
    if (!mapSpotDetailUi.panel || mapSpotDetailUi.panel.hidden) {
        return null;
    }
    return mapSpotDetailUi.currentSpot || null;
}

/**
 * Called on maptimechange (when the sheet may be closed) and when opening a
 * spot. No-ops if no spot or panel is hidden — avoids wasted DOM work. Only
 * renders real /api/risk numbers; while data is still loading the stats and
 * chart fall back to an empty/dash state instead of synthetic values.
 * @author Jiahao
 */
function syncMapSpotDetailPanel() {
    var spot = mapSpotDetailUi.currentSpot;
    if (!spot || !mapSpotDetailUi.panel || mapSpotDetailUi.panel.hidden) {
        return;
    }

    var hour = parseMapTimeHour();
    var label =
        document.body.dataset.mapTimeHm ||
        (hour < 10 ? "0" + hour : String(hour)) + ":00";

    var hourly = getSpotApiHourly(spot);
    var snap = hourly ? hourly[hour] : null;

    mapSpotDetailUi.titleEl.textContent = spot.name || "Location";

    var tier = mapTempTierFromCelsius(snap ? snap.tempC : NaN);
    mapSpotDetailUi.tempTierEl.textContent = tier.label;
    mapSpotDetailUi.tempTierEl.className =
        "map-spot-detail-panel__temp-tier map-spot-detail-panel__temp-tier--" + tier.tier;

    mapSpotDetailUi.timeLabelEl.textContent = "Selected time: " + label;
    mapSpotDetailUi.summaryEl.textContent = spot.summary || "";

    renderDetailStats(mapSpotDetailUi.statsEl, snap);
    renderTemperatureBars(mapSpotDetailUi.chartEl, hourly, hour);
}
