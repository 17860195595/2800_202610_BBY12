/**
 * @file mapToggleBar.js
 * Floating switch bar overlaid on the map. Three controls:
 *
 *   Buildings : Off | On              (segmented radio group; "On" maps to
 *                                       the internal 'local' value to keep
 *                                       prefs + downstream code unchanged)
 *   Fountains : on/off                (Bootstrap form-switch)
 *   Heat      : on/off                (Bootstrap form-switch)
 *
 * Pure UI — does not own the layers. Emits CustomEvents on window so
 * pages/index.js (which holds the map + heat controller refs) can wire the
 * actual show/hide:
 *
 *   maptoggle:buildings  detail = { mode: 'off'|'local' }
 *   maptoggle:fountains  detail = { visible: boolean }
 *   maptoggle:heat       detail = { visible: boolean }
 *
 * The legacy "City" option (Vancouver-wide building cluster) was removed —
 * the dataset is slow to fetch and the curated 100 key locations are enough.
 *
 * @author Jiahao
 */

/** Persisted user preferences live here so a page reload restores the toggle
 *  positions. Keep the schema flat — bumping the version key wipes old prefs. */
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
 * Build the floating control DOM and attach it to the map page.
 * Idempotent: returns the existing element if one is already on the page.
 * @returns {HTMLElement}
 * @author Jiahao
 */
function ensureMapToggleBarDom() {
    var existing = document.getElementById("map-toggle-bar");
    if (existing) return existing;

    var bar = document.createElement("div");
    bar.id = "map-toggle-bar";
    bar.className = "map-toggle-bar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Map layers");

    bar.innerHTML =
        '<div class="map-toggle-bar__group" role="group" aria-label="Building layer mode">' +
        '  <span class="map-toggle-bar__label">Buildings</span>' +
        '  <div class="btn-group btn-group-sm map-toggle-bar__seg" role="group">' +
        '    <input type="radio" class="btn-check" name="mtb-bld" id="mtb-bld-off" value="off" autocomplete="off" />' +
        '    <label class="btn btn-outline-success" for="mtb-bld-off">Off</label>' +
        // Internal radio value stays "local" so the buildingsMode pref schema
        // and downstream setBuildingsMode() keep working unchanged; only the
        // user-visible label flipped to "On" for clarity now that "Local" is
        // the only non-Off mode.
        '    <input type="radio" class="btn-check" name="mtb-bld" id="mtb-bld-local" value="local" autocomplete="off" />' +
        '    <label class="btn btn-outline-success" for="mtb-bld-local">On</label>' +
        '  </div>' +
        '</div>' +
        '<div class="map-toggle-bar__row">' +
        '  <div class="form-check form-switch map-toggle-bar__switch">' +
        '    <input class="form-check-input" type="checkbox" role="switch" id="mtb-fountains" />' +
        '    <label class="form-check-label" for="mtb-fountains">Fountains</label>' +
        '  </div>' +
        '  <div class="form-check form-switch map-toggle-bar__switch">' +
        '    <input class="form-check-input" type="checkbox" role="switch" id="mtb-heat" />' +
        '    <label class="form-check-label" for="mtb-heat">Heat</label>' +
        '  </div>' +
        '</div>';

    var mountTarget = document.querySelector(".map-page") || document.body;
    mountTarget.appendChild(bar);
    return bar;
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
