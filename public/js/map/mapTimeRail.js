/**
 * @file mapTimeRail.js
 * Time-of-day range input (0–23) wired to a live <output>, body dataset, and a window CustomEvent.
 *
 * Why CustomEvent on window:
 *   Decouples the slider from heat + detail: any listener can react to maptimechange without
 *   importing the map instance. bubbles:true helps if you later attach listeners on document.
 *   (Event shape double-checked via MDN + Claude when debugging ordering with the heat layer.)
 *
 * Why requestAnimationFrame(onLayout):
 *   After the dock/slider layout updates, Leaflet sometimes needs invalidateSize() so tiles and
 *   overlays measure correctly on mobile / after font load.
 *
 * @param {function} [onLayout] Optional callback, e.g. map.invalidateSize bound from index.js
 * @author Jiahao
 */

/**
 * Bind the map time slider and mirror state to dataset + maptimechange.
 * @param {function} [onLayout]
 * @author Jiahao
 */
function initMapTimeRail(onLayout) {
    var slider = document.getElementById("map-time-slider");
    var display = document.getElementById("map-time-rail-display");
    if (!slider || !display) return;

    /**
     * Format an hour as two digits.
     * @param {number} n
     * @returns {string}
     * @author Jiahao
     */
    function pad2(n) {
        return n < 10 ? "0" + n : String(n);
    }

    /**
     * Apply slider value to UI state and notify listeners.
     * @author Jiahao
     */
    function apply() {
        var h = parseInt(slider.value, 10);
        if (isNaN(h)) h = 0;
        var label = pad2(h) + ":00";
        display.value = label;
        slider.setAttribute("aria-valuenow", String(h));
        slider.setAttribute("aria-valuetext", label);
        document.body.dataset.mapTimeHour = String(h);
        document.body.dataset.mapTimeHm = label;
        window.dispatchEvent(
            new CustomEvent("maptimechange", {
                bubbles: true,
                detail: { hour: h, label: label, minutesFromMidnight: h * 60 },
            })
        );
        if (typeof onLayout === "function") requestAnimationFrame(onLayout);
    }

    slider.addEventListener("input", apply);
    slider.addEventListener("change", apply);
    apply();
}
