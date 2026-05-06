/**
 * @file mapSpotDetail.js
 * Location detail “sheet”: dialog panel above the map (below the bottom dock), stats, 24h bar chart.
 *
 * Depends on: mapUtils.js — escapeHtmlMap, formatShadeScore, parseMapTimeHour, getSpotHourly
 *
 * Styling: public/css/pages/map.css (panel, chart, tier colors). z-index stays under the tab bar.
 *
 * Tricky bits (validated with Claude AI + MDN while wiring):
 *   - Bar click → time slider: programmatic value change does not fire "input" natively; we
 *     dispatch input + change with bubbles:true so initMapTimeRail and the heat refresh listener run.
 *   - UV row uses innerHTML only after escapeHtmlMap on the label fragment; numeric parts are plain text.
 */

/** Upper bound (exclusive) for LOW tier in °C; keep in sync with chart/badge CSS modifiers. */
var MAP_TEMP_LOW_MAX_C = 18;
/** Lower bound (inclusive) for HIGH tier in °C. */
var MAP_TEMP_HIGH_MIN_C = 24;

/**
 * Map Celsius to LOW / MID / HIGH for the detail badge and chart bar hue.
 * @param {number} tempC
 * @returns {{ tier: string, label: string }}
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
    closeBtn: null,
    currentSpot: null,
};

/**
 * One-time DOM build: backdrop + aside appended to body. Click backdrop closes; panel stops propagation.
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
    note.textContent = "Mock data for UI only.";

    body.appendChild(summary);
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
    mapSpotDetailUi.closeBtn = closeBtn;
}

/**
 * @param {Object} snap
 * @returns {string}
 */
function formatDetailTemp(snap) {
    if (typeof snap.tempC === "number" && !isNaN(snap.tempC)) {
        return snap.tempC + "°C";
    }
    return "—";
}

/**
 * Render the definition list for the selected hour’s snapshot.
 * Only the UV row mixes HTML (escaped uvLevel); other rows use textContent.
 * @param {HTMLElement} statsEl
 * @param {Object} snap Hourly row from getSpotHourly
 */
function renderDetailStats(statsEl, snap) {
    statsEl.textContent = "";
    var rows = [
        { label: "Temperature", value: formatDetailTemp(snap) },
        {
            label: "UV index",
            value:
                (typeof snap.uvIndex === "number" && !isNaN(snap.uvIndex) ? String(snap.uvIndex) : "—") +
                (snap.uvLevel ? " (" + escapeHtmlMap(snap.uvLevel) + ")" : ""),
            rawHtmlValue: true,
        },
        {
            label: "Humidity",
            value:
                typeof snap.humidityPct === "number" && !isNaN(snap.humidityPct)
                    ? snap.humidityPct + "%"
                    : "—",
        },
        {
            label: "Wind",
            value:
                typeof snap.windKmh === "number" && !isNaN(snap.windKmh)
                    ? snap.windKmh + " km/h"
                    : "—",
        },
        { label: "Shade coverage", value: formatShadeScore(snap.shadeScore) },
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
 * 24 buttons laid out as a mini bar chart; height encodes temp within the day’s min–max for this spot.
 * CSS classes encode LOW/MID/HIGH tier per bar for green/orange/red fills.
 * Each bar uses an IIFE (function (hour) { ... })(h) so the click handler closes over the correct index.
 * @param {HTMLElement} chartEl
 * @param {Array<Object>} hourly
 * @param {number} selectedHour Current map time rail hour
 */
function renderTemperatureBars(chartEl, hourly, selectedHour) {
    chartEl.textContent = "";
    if (!hourly.length) {
        return;
    }

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
 * Open the detail panel for a spot and sync to the current time rail hour.
 * @param {Object} spot
 */
function openMapSpotDetail(spot) {
    ensureMapSpotDetailUi();
    mapSpotDetailUi.currentSpot = spot;
    mapSpotDetailUi.backdrop.hidden = false;
    mapSpotDetailUi.panel.hidden = false;
    mapSpotDetailUi.backdrop.setAttribute("aria-hidden", "false");
    mapSpotDetailUi.panel.setAttribute("aria-hidden", "false");
    syncMapSpotDetailPanel();
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
}

/**
 * Called on maptimechange (when the sheet may be closed) and when opening a spot.
 * No-ops if no spot or panel is hidden — avoids wasted DOM work.
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
    var hourly = getSpotHourly(spot);
    var snap = hourly[hour] || {};

    mapSpotDetailUi.titleEl.textContent = spot.name || "Location";

    var tier = mapTempTierFromCelsius(snap.tempC);
    mapSpotDetailUi.tempTierEl.textContent = tier.label;
    mapSpotDetailUi.tempTierEl.className =
        "map-spot-detail-panel__temp-tier map-spot-detail-panel__temp-tier--" + tier.tier;

    mapSpotDetailUi.timeLabelEl.textContent = "Selected time: " + label;
    mapSpotDetailUi.summaryEl.textContent = spot.summary || "";

    renderDetailStats(mapSpotDetailUi.statsEl, snap);
    renderTemperatureBars(mapSpotDetailUi.chartEl, hourly, hour);
}
