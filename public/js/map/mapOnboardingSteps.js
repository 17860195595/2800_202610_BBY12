/**
 * @file mapOnboardingSteps.js
 * Tour step copy + spotlight targets only. Logic lives in mapOnboarding.js.
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
        targetSelector: ".app-foot-nav__tabs",
        scrollTarget: true,
    },
];

var MAP_ONBOARDING_SPOTLIGHT_CLASS = "map-onboarding-spotlight";
var MAP_ONBOARDING_SPOTLIGHT_COMPACT_CLASS = "map-onboarding-spotlight--compact";

export {
    MAP_ONBOARDING_STEPS,
    MAP_ONBOARDING_SPOTLIGHT_CLASS,
    MAP_ONBOARDING_SPOTLIGHT_COMPACT_CLASS,
};
