/**
 * @file mapSpotDetailTemplates.js
 * Clones <template> fragments for spot detail stats rows and chart (see index.html).
 * @author Jiahao
 */

/**
 * @returns {HTMLElement}
 */
function cloneMapSpotStatRow() {
    var tpl = document.getElementById("tpl-map-spot-stat-row");
    if (tpl && tpl.content) {
        var row0 = tpl.content.querySelector(".map-spot-detail-panel__row");
        if (row0) {
            return row0.cloneNode(true);
        }
    }
    var row = document.createElement("div");
    row.className = "map-spot-detail-panel__row";
    row.appendChild(document.createElement("dt"));
    row.appendChild(document.createElement("dd"));
    return row;
}

/**
 * @returns {HTMLElement}
 */
function cloneMapSpotChartTicks() {
    var tpl = document.getElementById("tpl-map-spot-chart-ticks");
    if (tpl && tpl.content) {
        var el = tpl.content.querySelector(".map-spot-detail-chart__ticks");
        if (el) {
            return el.cloneNode(true);
        }
    }
    var ticks = document.createElement("div");
    ticks.className = "map-spot-detail-chart__ticks";
    ticks.setAttribute("aria-hidden", "true");
    return ticks;
}

/**
 * @returns {HTMLButtonElement}
 */
function cloneMapSpotChartBarButton() {
    var tpl = document.getElementById("tpl-map-spot-chart-bar");
    if (tpl && tpl.content) {
        var btn = tpl.content.querySelector("button.map-spot-detail-chart__bar-wrap");
        if (btn) {
            return /** @type {HTMLButtonElement} */ (btn.cloneNode(true));
        }
    }
    var wrap = document.createElement("button");
    wrap.type = "button";
    wrap.className = "map-spot-detail-chart__bar-wrap";
    var bar = document.createElement("span");
    bar.className = "map-spot-detail-chart__bar";
    var lab = document.createElement("span");
    lab.className = "map-spot-detail-chart__hour";
    wrap.appendChild(bar);
    wrap.appendChild(lab);
    return wrap;
}

export { cloneMapSpotStatRow, cloneMapSpotChartTicks, cloneMapSpotChartBarButton };
