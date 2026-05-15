/**
 * @file mapTimeRail.js
 * Binds #map-time-slider (0–23) to <output>, body.dataset, and a window "maptimechange" event.
 *
 * CustomEvent decouples the slider from heat + detail without passing the map instance.
 * requestAnimationFrame(onLayout) lets Leaflet invalidateSize after layout shifts (mobile, fonts).
 * @param {function} [onLayout] e.g. map.invalidateSize
 * @author Jiahao
 */

function initMapTimeRail(onLayout) {
    var slider = document.getElementById("map-time-slider");
    var display = document.getElementById("map-time-rail-display");
    if (!slider || !display) return;

    function pad2(n) {
        return n < 10 ? "0" + n : String(n);
    }

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

export { initMapTimeRail };
