/**
 * @file mapSpotDetailRender.js
 * Spot detail panel: stats list + 24h temperature bars (live /api/risk only).
 * Depends: mapUtils.js, mapSpotDetailRisk.js, mapSpotDetailTemplates.js.
 * @author Jiahao
 */

import { escapeHtmlMap, formatShadeScore } from "./mapUtils.js";
import { mapRiskTierFromScore } from "./mapSpotDetailRisk.js";
import {
    cloneMapSpotStatRow,
    cloneMapSpotChartTicks,
    cloneMapSpotChartBarButton,
} from "./mapSpotDetailTemplates.js";

/**
 * @param {Object} snap
 * @returns {string}
 */
function formatDetailTemp(snap) {
    if (snap && typeof snap.tempC === "number" && !isNaN(snap.tempC)) {
        return snap.tempC + "°C";
    }
    return "—";
}

/**
 * @param {HTMLElement} statsEl
 * @param {Object|null} snap Hourly row from getSpotApiHourly, or null while loading
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
        var row = cloneMapSpotStatRow();
        var dt = row.querySelector("dt");
        var dd = row.querySelector("dd");
        if (!dt || !dd) continue;
        dt.textContent = rows[i].label;
        if (rows[i].rawHtmlValue) {
            dd.innerHTML = rows[i].value;
        } else {
            dd.textContent = rows[i].value;
        }
        statsEl.appendChild(row);
    }
}

/**
 * @param {HTMLElement} chartEl
 * @param {Array<Object>|null} hourly
 * @param {number} selectedHour
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

    var ticks = cloneMapSpotChartTicks();

    for (var h = 0; h < 24; h++) {
        var wrap = cloneMapSpotChartBarButton();
        var temp = typeof hourly[h].tempC === "number" ? hourly[h].tempC : minT;
        var tierInfo = mapRiskTierFromScore(
            typeof hourly[h].riskScore === "number" ? hourly[h].riskScore : NaN
        );
        wrap.className =
            "map-spot-detail-chart__bar-wrap map-spot-detail-chart__bar-wrap--" + tierInfo.tier;
        if (h === selectedHour) {
            wrap.classList.add("is-selected");
        }
        var pct = ((temp - minT) / span) * 100;
        pct = Math.max(12, Math.min(100, pct));

        var bar = wrap.querySelector(".map-spot-detail-chart__bar");
        var lab = wrap.querySelector(".map-spot-detail-chart__hour");
        if (!bar || !lab) continue;
        bar.className = "map-spot-detail-chart__bar map-spot-detail-chart__bar--" + tierInfo.tier;
        bar.style.height = pct + "%";

        lab.textContent = h % 6 === 0 ? String(h) : "";

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

export { formatDetailTemp, renderDetailStats, renderTemperatureBars };
