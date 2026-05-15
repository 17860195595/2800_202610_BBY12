/**
 * @file mapToggleBar.js
 * Floating layer toggles on the map page. Markup lives in index.html (#map-toggle-bar);
 * this module restores prefs from localStorage, wires change handlers, and emits:
 *
 *   maptoggle:buildings  detail = { mode: 'off'|'local' }
 *   maptoggle:fountains  detail = { visible: boolean }
 *   maptoggle:heat       detail = { visible: boolean }
 *
 * Map page bootstrap: js/pages/index.js owns the map + layers and listens for those events.
 * @author Jiahao
 */

var MAP_TOGGLE_PREFS_KEY = "shadeSafe.mapTogglePrefs.v1";

/** @typedef {{ buildingsMode: 'off'|'local', fountainsOn: boolean, heatOn: boolean }} MapTogglePrefs */

/**
 * Read persisted prefs with sensible defaults. A stale buildingsMode of
 * 'city' from older builds is coerced to 'local' so the map still has pins.
 * @returns {MapTogglePrefs}
 * @author Jiahao
 */
function loadMapTogglePrefs() {
    var defaults = { buildingsMode: "local", fountainsOn: true, heatOn: true };
    try {
        var raw = window.localStorage.getItem(MAP_TOGGLE_PREFS_KEY);
        if (!raw) return defaults;
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return defaults;
        var mode = parsed.buildingsMode;
        if (mode !== "off" && mode !== "local") {
            mode = defaults.buildingsMode;
        }
        return {
            buildingsMode: mode,
            fountainsOn: typeof parsed.fountainsOn === "boolean" ? parsed.fountainsOn : true,
            heatOn: typeof parsed.heatOn === "boolean" ? parsed.heatOn : true,
        };
    } catch (e) {
        return defaults;
    }
}

/**
 * @param {MapTogglePrefs} prefs
 * @author Jiahao
 */
function saveMapTogglePrefs(prefs) {
    try {
        window.localStorage.setItem(MAP_TOGGLE_PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {
        // Storage full / blocked — toggles still work for this session.
    }
}

/**
 * Return the bar root from index.html, or null if the page omitted it.
 * @returns {HTMLElement|null}
 * @author Jiahao
 */
function ensureMapToggleBarDom() {
    return document.getElementById("map-toggle-bar");
}

/**
 * Mount the toggle bar, restore prefs, wire change events, fire initial events
 * so the page can apply the restored state immediately.
 *
 * Listens for a "click" on the bar and stops it from bubbling to the Leaflet
 * map (otherwise dragging on the toggle area would pan the map).
 *
 * @returns {MapTogglePrefs} the prefs that were applied
 * @author Jiahao
 */
function initMapToggleBar() {
    var bar = ensureMapToggleBarDom();
    var prefs = loadMapTogglePrefs();
    if (!bar) {
        console.warn("[mapToggleBar] #map-toggle-bar not found");
        return prefs;
    }

    var bldRadios = bar.querySelectorAll('input[name="mtb-bld"]');
    for (var i = 0; i < bldRadios.length; i++) {
        bldRadios[i].checked = bldRadios[i].value === prefs.buildingsMode;
    }
    var fountainsEl = bar.querySelector("#mtb-fountains");
    var heatEl = bar.querySelector("#mtb-heat");
    if (fountainsEl) fountainsEl.checked = prefs.fountainsOn;
    if (heatEl) heatEl.checked = prefs.heatOn;

    function dispatchBuildings(mode) {
        window.dispatchEvent(
            new CustomEvent("maptoggle:buildings", { detail: { mode: mode } })
        );
    }
    function dispatchFountains(visible) {
        window.dispatchEvent(
            new CustomEvent("maptoggle:fountains", { detail: { visible: visible } })
        );
    }
    function dispatchHeat(visible) {
        window.dispatchEvent(
            new CustomEvent("maptoggle:heat", { detail: { visible: visible } })
        );
    }

    for (var k = 0; k < bldRadios.length; k++) {
        bldRadios[k].addEventListener("change", function (ev) {
            if (!ev.target.checked) return;
            prefs.buildingsMode = ev.target.value;
            saveMapTogglePrefs(prefs);
            dispatchBuildings(prefs.buildingsMode);
        });
    }
    if (fountainsEl) {
        fountainsEl.addEventListener("change", function () {
            prefs.fountainsOn = !!fountainsEl.checked;
            saveMapTogglePrefs(prefs);
            dispatchFountains(prefs.fountainsOn);
        });
    }
    if (heatEl) {
        heatEl.addEventListener("change", function () {
            prefs.heatOn = !!heatEl.checked;
            saveMapTogglePrefs(prefs);
            dispatchHeat(prefs.heatOn);
        });
    }

    // Stop click + scroll + dblclick from leaking through to Leaflet (which
    // would otherwise pan/zoom the map when interacting with the bar).
    if (typeof L !== "undefined" && L.DomEvent) {
        L.DomEvent.disableClickPropagation(bar);
        L.DomEvent.disableScrollPropagation(bar);
    }

    // Defer the initial apply by one tick so the listeners on pages/index.js
    // (registered after this init runs) can pick them up.
    setTimeout(function () {
        dispatchBuildings(prefs.buildingsMode);
        dispatchFountains(prefs.fountainsOn);
        dispatchHeat(prefs.heatOn);
    }, 0);

    return prefs;
}

export { initMapToggleBar };
