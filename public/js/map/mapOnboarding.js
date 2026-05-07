/**
 * @file mapOnboarding.js
 * Map guided tour as a Bootstrap 5 modal (reliable on mobile vs custom overlay).
 * Markup: #map-onboarding-modal in index.html. Styles: mapOnboarding.css
 *
 * TODO: shouldRunMapOnboarding() — gate on logged-in user DB flag when auth exists.
 */

/** @typedef {{ eyebrow: string, title: string, body: string }} MapOnboardingStep */

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
        body: "Pan and zoom to explore the city. The colored heat layer shows where it feels hotter; use it to plan a cooler route or break.",
    },
    {
        eyebrow: "Time of day",
        title: "Scrub through the day",
        body: "Drag the time slider at the bottom to see how conditions shift from morning to night. The map and location details update to match the hour you pick.",
    },
    {
        eyebrow: "Community",
        title: "Report what you feel",
        body: "Tap the floating Report button to share whether a spot feels too hot, has great shade, or needs more shade structures. GPS will attach when we wire it up.",
    },
    {
        eyebrow: "Locations",
        title: "Pins and details",
        body: "Tap a green pin to open a place card with stats and a 24-hour temperature chart. Try changing the time slider while a card is open.",
    },
    {
        eyebrow: "Navigation",
        title: "More in the app",
        body: "Use the tabs at the bottom for Analytics, About, and Alerts. You're ready — enjoy a cooler walk.",
    },
];

/** @type {boolean} */
var mapOnboardingActive = false;

/** @type {number} */
var mapOnboardingStepIndex = 0;

/** @type {boolean} */
var mapOnboardingListenersBound = false;

/**
 * @returns {boolean}
 */
function shouldRunMapOnboarding() {
    return true;
}

function mapOnboardingModalEl() {
    return document.getElementById("map-onboarding-modal");
}

function mapOnboardingGetModal() {
    var el = mapOnboardingModalEl();
    if (!el || typeof bootstrap === "undefined" || !bootstrap.Modal) {
        return null;
    }
    return bootstrap.Modal.getOrCreateInstance(el);
}

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
}

function mapOnboardingShow() {
    var modal = mapOnboardingGetModal();
    if (!modal) {
        return;
    }
    mapOnboardingStepIndex = 0;
    mapOnboardingRenderStep();
    modal.show();
}

function mapOnboardingFinish() {
    var modal = mapOnboardingGetModal();
    if (modal) {
        modal.hide();
    }
    mapOnboardingActive = false;
    mapOnboardingStepIndex = 0;
}

function mapOnboardingNext() {
    if (mapOnboardingStepIndex >= MAP_ONBOARDING_STEPS.length - 1) {
        mapOnboardingFinish();
        return;
    }
    mapOnboardingStepIndex += 1;
    mapOnboardingRenderStep();
}

function mapOnboardingPrev() {
    if (mapOnboardingStepIndex <= 0) {
        return;
    }
    mapOnboardingStepIndex -= 1;
    mapOnboardingRenderStep();
}

/**
 * @returns {boolean}
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
 * @param {object} [options]
 * @param {number} [options.delayMs]
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
        });
        modalEl.addEventListener("shown.bs.modal", function () {
            var nextBtn = document.getElementById("map-onboarding-next");
            if (nextBtn) {
                nextBtn.focus();
            }
        });

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
