/**
 * Bottom main navigation (foot nav): Map / Analytics / About / Alerts — not a copyright footer.
 * Icons are inline SVGs; swap for <img src="images/..."> if needed.
 */

function escapeAttrFootNav(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
}

function escapeHtmlFootNav(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function footNavIconMap() {
    return '<svg class="app-foot-nav__icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>';
}

function footNavIconAnalytics() {
    return '<svg class="app-foot-nav__icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>';
}

function footNavIconAbout() {
    return '<svg class="app-foot-nav__icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>';
}

function footNavIconAlert() {
    return '<svg class="app-foot-nav__icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>';
}

/**
 * Resolve the active tab from the current URL (or force via options.activeKey: map | analytics | about | alert).
 */
function resolveFootNavActiveKey(options) {
    if (options && options.activeKey) {
        return options.activeKey;
    }
    const path = (window.location.pathname || "").toLowerCase();
    const file = (path.split("/").pop() || "").toLowerCase();
    if (path.includes("analytics") || file === "analytics.html") return "analytics";
    if (path.includes("about") || file === "about.html") return "about";
    if (path.includes("alert") || file === "alert.html") return "alert";
    return "map";
}

/**
 * Inject the bottom main nav into `#app-footer`.
 *
 * @param {object} [options]
 * @param {string} [options.mountId='app-footer']
 * @param {'map'|'analytics'|'about'|'alert'} [options.activeKey] — omit to infer from the URL
 */
function loadAppFooter(options) {
    const opts = options || {};
    const mountId = opts.mountId || "app-footer";
    const mount = document.getElementById(mountId);
    if (!mount) return;

    const activeKey = resolveFootNavActiveKey(opts);

    const items = [
        { key: "map", href: "/", label: "Map", icon: footNavIconMap() },
        { key: "analytics", href: "/analytics", label: "Analytics", icon: footNavIconAnalytics() },
        { key: "about", href: "/about", label: "About", icon: footNavIconAbout() },
        { key: "alert", href: "/alert", label: "Alerts", icon: footNavIconAlert() },
    ];

    const links = items
        .map(function (item) {
            const isActive = item.key === activeKey;
            const activeClass = isActive ? " app-foot-nav__link--active" : "";
            const ariaCurrent = isActive ? ' aria-current="page"' : "";
            return (
                '<a class="app-foot-nav__link' +
                activeClass +
                '" href="' +
                escapeAttrFootNav(item.href) +
                '"' +
                ariaCurrent +
                ">" +
                item.icon +
                '<span class="app-foot-nav__label">' +
                escapeHtmlFootNav(item.label) +
                "</span>" +
                "</a>"
            );
        })
        .join("");

 
    mount.innerHTML =
        '<nav class="app-foot-nav" role="navigation" aria-label="Main navigation">' +
        '<div class="app-foot-nav__tabs">' +
        links +
        "</div>" +
        "</nav>";
}
