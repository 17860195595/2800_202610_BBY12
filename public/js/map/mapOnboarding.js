/**
 * @file mapOnboarding.js
 * Map tour: Bootstrap modal for copy + spotlight ring on real controls (targetSelector).
 * Dialog position is computed so it usually sits beside the highlight, not on top of it.
 *
 * TODO: shouldRunMapOnboarding() — gate on user DB flag when auth exists.
 * @author Jiahao
 */

/** @typedef {{ eyebrow: string, title: string, body: string, targetSelector?: string, scrollTarget?: boolean }} MapOnboardingStep */

/** @type {MapOnboardingStep[]} */
var MAP_ONBOARDING_STEPS = [
    {
        eyebrow: "Welcome, Jiahao Zhu",
        title: "Welcome to ShadeSafe",
        body:
            "We're glad you're here. ShadeSafe helps you find cooler, shadier places in Vancouver " +
            "using live-style heat and shade cues. Take a quick tour — you can skip anytime.",
    },
    {
        eyebrow: "The map",
        title: "Explore heat and relief",
        body: "Pan and zoom here. The heat layer shows where it feels hotter — use it to plan a cooler route.",
        targetSelector: "#map",
        scrollTarget: false,
    },
    {
        eyebrow: "Time of day",
        title: "Scrub through the day",
        body: "Drag this slider to change the hour. The map and place cards update to match.",
        targetSelector: "#map-time-rail",
        scrollTarget: true,
    },
    {
        eyebrow: "Community",
        title: "Report what you feel",
        body: "Tap Report to share too hot, great shade, or needs more shade structures.",
        targetSelector: "#map-report-fab",
        scrollTarget: true,
    },
    {
        eyebrow: "Locations",
        title: "Pins and details",
        body: "Tap a green pin on the map to open details and the 24-hour chart.",
        targetSelector: "#map",
        scrollTarget: false,
    },
    {
        eyebrow: "Navigation",
        title: "More in the app",
        body: "Use these tabs for Analytics, About, and Alerts. You're ready — enjoy a cooler walk.",
        /* Highlight the actual interactive tabs row (clearer than the whole fixed nav wrapper). */
        targetSelector: ".app-foot-nav__tabs",
        scrollTarget: true,
    },
];

var MAP_ONBOARDING_SPOTLIGHT_CLASS = "map-onboarding-spotlight";
var MAP_ONBOARDING_SPOTLIGHT_COMPACT_CLASS = "map-onboarding-spotlight--compact";

/** @type {boolean} */
var mapOnboardingActive = false;

/** @type {number} */
var mapOnboardingStepIndex = 0;

/** @type {boolean} */
var mapOnboardingListenersBound = false;

/** @type {HTMLElement|null} */
var mapOnboardingSpotlightEl = null;

/** @type {number|null} */
var mapOnboardingLayoutTimer = null;

/**
 * @returns {boolean}
 * @author Jiahao
 */
function shouldRunMapOnboarding() {
    return true;
}

/**
 * Return onboarding modal root node.
 * @returns {HTMLElement|null}
 * @author Jiahao
 */
function mapOnboardingModalEl() {
    return document.getElementById("map-onboarding-modal");
}

/**
 * Return Bootstrap modal instance for onboarding.
 * @returns {Object|null}
 * @author Jiahao
 */
function mapOnboardingGetModal() {
    var el = mapOnboardingModalEl();
    if (!el || typeof bootstrap === "undefined" || !bootstrap.Modal) {
        return null;
    }
    return bootstrap.Modal.getOrCreateInstance(el);
}

/**
 * Return Bootstrap dialog element used for dynamic positioning.
 * @returns {HTMLElement|null}
 * @author Jiahao
 */
function mapOnboardingDialogEl() {
    var modal = mapOnboardingModalEl();
    return modal ? modal.querySelector(".map-onboarding-modal-dialog") : null;
}

/**
 * #map-time-rail lives inside .app-bottom-dock (z-index 1100). Children cannot paint above the
 * tour backdrop (1238). Temporarily lift the dock for that step only.
 * @param {HTMLElement|null} highlightEl
 * @author Jiahao
 */
function mapOnboardingSyncDockElevation(highlightEl) {
    var dock = document.querySelector(".app-bottom-dock");
    if (!dock) {
        return;
    }
    var elevate =
        !!highlightEl &&
        (highlightEl.id === "map-time-rail" || !!highlightEl.closest(".app-bottom-dock"));
    dock.classList.toggle("map-onboarding-dock--elevated", elevate);
}

/**
 * Remove all spotlight classes from previous target.
 * @author Jiahao
 */
function mapOnboardingClearSpotlight() {
    if (mapOnboardingSpotlightEl) {
        mapOnboardingSpotlightEl.classList.remove(
            MAP_ONBOARDING_SPOTLIGHT_CLASS,
            MAP_ONBOARDING_SPOTLIGHT_COMPACT_CLASS
        );
        mapOnboardingSpotlightEl = null;
    }
    mapOnboardingSyncDockElevation(null);
}

/**
 * Resolve the DOM node to highlight (some ids are wrappers; fixed children need direct query).
 * @param {MapOnboardingStep|null} step
 * @returns {HTMLElement|null}
 * @author Jiahao
 */
function mapOnboardingResolveTarget(step) {
    if (!step || !step.targetSelector) {
        return null;
    }
    var el = document.querySelector(step.targetSelector);
    if (!el) {
        return null;
    }
    /* Legacy: if markup still points at #app-footer, use the visible fixed tab bar */
    if (step.targetSelector === "#app-footer") {
        var nav = document.querySelector(".app-foot-nav");
        if (nav) {
            return nav;
        }
    }
    return el;
}

/**
 * Apply spotlight styles to the current step target and optionally scroll it into view.
 * @param {MapOnboardingStep|null} step
 * @author Jiahao
 */
function mapOnboardingApplySpotlight(step) {
    mapOnboardingClearSpotlight();
    if (!step) {
        return;
    }
    var el = mapOnboardingResolveTarget(step);
    if (!el) {
        return;
    }
    mapOnboardingSpotlightEl = el;
    el.classList.add(MAP_ONBOARDING_SPOTLIGHT_CLASS);
    var br = el.getBoundingClientRect();
    if (br.height < 72 || br.width < 72) {
        el.classList.add(MAP_ONBOARDING_SPOTLIGHT_COMPACT_CLASS);
    }
    if (step.scrollTarget) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    mapOnboardingSyncDockElevation(el);
}

/**
 * Parse CSS dock padding variable to pixel value.
 * @returns {number}
 * @author Jiahao
 */
function mapOnboardingDockPadPx() {
    var raw = getComputedStyle(document.body).getPropertyValue("--app-bottom-dock-pad").trim();
    if (!raw) {
        return 168;
    }
    if (raw.endsWith("rem")) {
        var n = parseFloat(raw);
        if (!isNaN(n)) {
            var fs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
            return n * fs;
        }
    }
    var px = parseFloat(raw);
    return isNaN(px) ? 168 : px;
}

/**
 * Place the modal dialog near the spotlight so the highlighted control stays visible.
 * @author Jiahao
 */
function mapOnboardingPositionDialog() {
    var dialog = mapOnboardingDialogEl();
    var modalRoot = mapOnboardingModalEl();
    if (!dialog || !modalRoot || !modalRoot.classList.contains("show")) {
        return;
    }

    dialog.classList.add("map-onboarding-dialog--placed");

    var step = MAP_ONBOARDING_STEPS[mapOnboardingStepIndex];
    var target = step ? mapOnboardingResolveTarget(step) : null;

    var margin = 12;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var dockPad = mapOnboardingDockPadPx();
    var minTop = 8;
    var bottomSafe = dockPad + margin;

    dialog.style.maxWidth = "min(26rem, calc(100vw - 1.25rem))";
    dialog.style.width = dialog.style.maxWidth;

    if (!target) {
        dialog.style.left = "50%";
        dialog.style.top = "50%";
        dialog.style.bottom = "auto";
        dialog.style.right = "auto";
        dialog.style.transform = "translate(-50%, -50%)";
        return;
    }

    var r = target.getBoundingClientRect();
    void dialog.offsetHeight;
    var dh = dialog.getBoundingClientRect().height;
    var dw = dialog.getBoundingClientRect().width;
    var cx = r.left + r.width / 2;
    cx = Math.max(dw / 2 + margin, Math.min(cx, vw - dw / 2 - margin));

    var placeBelowTop = r.bottom + margin;
    var fitsBelow = placeBelowTop + dh <= vh - bottomSafe;

    var placeAboveTop = r.top - margin - dh;
    var fitsAbove = placeAboveTop >= minTop;

    if (fitsBelow || !fitsAbove) {
        if (!fitsBelow && placeBelowTop + dh > vh - bottomSafe) {
            placeBelowTop = Math.max(minTop, vh - bottomSafe - dh - margin);
        }
        dialog.style.top = placeBelowTop + "px";
        dialog.style.bottom = "auto";
        dialog.style.transform = "translateX(-50%)";
        dialog.style.left = cx + "px";
    } else {
        dialog.style.top = placeAboveTop + "px";
        dialog.style.bottom = "auto";
        dialog.style.transform = "translateX(-50%)";
        dialog.style.left = cx + "px";
    }
}

/**
 * Debounce dialog reposition work.
 * @author Jiahao
 */
function mapOnboardingScheduleLayout() {
    if (mapOnboardingLayoutTimer != null) {
        window.clearTimeout(mapOnboardingLayoutTimer);
    }
    mapOnboardingLayoutTimer = window.setTimeout(function () {
        mapOnboardingLayoutTimer = null;
        mapOnboardingPositionDialog();
    }, 50);
}

/**
 * Leaflet / scroll need a tick to settle before getBoundingClientRect matches the visible UI.
 * @author Jiahao
 */
function mapOnboardingReflowThenLayout() {
    window.dispatchEvent(new Event("resize"));
    mapOnboardingScheduleLayout();
    window.setTimeout(function () {
        if (mapOnboardingActive) {
            mapOnboardingPositionDialog();
        }
    }, 120);
    window.setTimeout(function () {
        if (mapOnboardingActive) {
            mapOnboardingPositionDialog();
        }
    }, 380);
}

/**
 * Render step indicator dots.
 * @param {number} total
 * @param {number} activeIndex
 * @author Jiahao
 */
function mapOnboardingRenderDots(total, activeIndex) {
    var host = document.getElementById("map-onboarding-dots");
    if (!host) {
        return;
    }
    host.innerHTML = "";
    for (var i = 0; i < total; i++) {
        var d = document.createElement("span");
        d.className = "map-onboarding__dot" + (i === activeIndex ? " is-active" : "");
        host.appendChild(d);
    }
}

/**
 * Render current onboarding step text, controls, and spotlight.
 * @author Jiahao
 */
function mapOnboardingRenderStep() {
    var step = MAP_ONBOARDING_STEPS[mapOnboardingStepIndex];
    if (!step) {
        return;
    }
    var eyebrow = document.getElementById("map-onboarding-eyebrow");
    var title = document.getElementById("map-onboarding-title");
    var body = document.getElementById("map-onboarding-body");
    var prevBtn = document.getElementById("map-onboarding-prev");
    var nextBtn = document.getElementById("map-onboarding-next");
    if (eyebrow) {
        eyebrow.textContent = step.eyebrow;
    }
    if (title) {
        title.textContent = step.title;
    }
    if (body) {
        body.textContent = step.body;
    }
    if (prevBtn) {
        prevBtn.hidden = mapOnboardingStepIndex === 0;
    }
    if (nextBtn) {
        nextBtn.textContent =
            mapOnboardingStepIndex >= MAP_ONBOARDING_STEPS.length - 1 ? "Get started" : "Next";
    }
    mapOnboardingRenderDots(MAP_ONBOARDING_STEPS.length, mapOnboardingStepIndex);
    mapOnboardingApplySpotlight(step);
    mapOnboardingReflowThenLayout();
}

/**
 * Open onboarding modal from the first step.
 * @author Jiahao
 */
function mapOnboardingShow() {
    var modal = mapOnboardingGetModal();
    if (!modal) {
        return;
    }
    mapOnboardingStepIndex = 0;
    mapOnboardingRenderStep();
    modal.show();
}

/**
 * Close onboarding and reset local state.
 * @author Jiahao
 */
function mapOnboardingFinish() {
    var modal = mapOnboardingGetModal();
    if (modal) {
        modal.hide();
    }
    mapOnboardingActive = false;
    mapOnboardingStepIndex = 0;
    mapOnboardingClearSpotlight();
    var dialog = mapOnboardingDialogEl();
    if (dialog) {
        dialog.classList.remove("map-onboarding-dialog--placed");
        dialog.style.cssText = "";
    }
}

/**
 * Go to next onboarding step or finish on last step.
 * @author Jiahao
 */
function mapOnboardingNext() {
    if (mapOnboardingStepIndex >= MAP_ONBOARDING_STEPS.length - 1) {
        mapOnboardingFinish();
        return;
    }
    mapOnboardingStepIndex += 1;
    mapOnboardingRenderStep();
}

/**
 * Go back one onboarding step.
 * @author Jiahao
 */
function mapOnboardingPrev() {
    if (mapOnboardingStepIndex <= 0) {
        return;
    }
    mapOnboardingStepIndex -= 1;
    mapOnboardingRenderStep();
}

/**
 * @returns {boolean}
 * @author Jiahao
 */
function closeMapOnboardingIfOpen() {
    var el = mapOnboardingModalEl();
    if (!el || !el.classList.contains("show")) {
        return false;
    }
    mapOnboardingFinish();
    return true;
}

/**
 * Reposition dialog when viewport changes.
 * @author Jiahao
 */
function mapOnboardingOnResize() {
    if (!mapOnboardingActive) {
        return;
    }
    mapOnboardingScheduleLayout();
}

/**
 * @param {object} [options]
 * @param {number} [options.delayMs]
 * @author Jiahao
 */
function initMapOnboarding(options) {
    var opts = options || {};
    var delayMs = typeof opts.delayMs === "number" ? opts.delayMs : 550;

    if (!shouldRunMapOnboarding()) {
        return;
    }

    var modalEl = mapOnboardingModalEl();
    if (!modalEl || typeof bootstrap === "undefined" || !bootstrap.Modal) {
        return;
    }

    if (!mapOnboardingListenersBound) {
        mapOnboardingListenersBound = true;
        modalEl.addEventListener("show.bs.modal", function () {
            mapOnboardingActive = true;
        });
        modalEl.addEventListener("hidden.bs.modal", function () {
            mapOnboardingActive = false;
            mapOnboardingStepIndex = 0;
            mapOnboardingClearSpotlight();
            var dialog = mapOnboardingDialogEl();
            if (dialog) {
                dialog.classList.remove("map-onboarding-dialog--placed");
                dialog.style.cssText = "";
            }
        });
        modalEl.addEventListener("shown.bs.modal", function () {
            mapOnboardingRenderStep();
            var nextBtn = document.getElementById("map-onboarding-next");
            if (nextBtn) {
                nextBtn.focus();
            }
        });

        window.addEventListener("resize", mapOnboardingOnResize);
        window.addEventListener("orientationchange", mapOnboardingOnResize);

        var skip = document.getElementById("map-onboarding-skip");
        var prev = document.getElementById("map-onboarding-prev");
        var next = document.getElementById("map-onboarding-next");
        if (skip) {
            skip.addEventListener("click", mapOnboardingFinish);
        }
        if (prev) {
            prev.addEventListener("click", mapOnboardingPrev);
        }
        if (next) {
            next.addEventListener("click", mapOnboardingNext);
        }
    }

    window.setTimeout(function () {
        if (!shouldRunMapOnboarding()) {
            return;
        }
        mapOnboardingShow();
    }, delayMs);
}
