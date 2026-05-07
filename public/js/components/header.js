/**
 * Navbar — inject into `#navbar` if present (legacy).
 * @author Jiahao
 */
function loadNavbar() {
    const mount = document.getElementById("navbar");
    if (!mount) return;

    const navbar = `
        <div class = "navbar">

            <div class="navbar-left-container">
                <p>Stuff in left container</p>
            </div>

            <div></div>
            <div class="navbar-center-container">
                <img src = "images/logo.png" class = "navbar-logo-img">
            </div>

            <div></div>
            <div class="navbar-right-container">
                <p>Stuff in right container</p>
            </div>
            
        </div>
    `;
    mount.innerHTML = navbar;
}

/**
 * Escape text for HTML text nodes.
 * @param {string} value
 * @author Jiahao
 */
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Escape for use inside double-quoted attributes.
 * @param {string} value
 * @author Jiahao
 */
function escapeAttr(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
}

/**
 * App header: optional back button, or logo/title only.
 *
 * @param {object} [options]
 * @param {string} [options.mountId='app-header'] — element id to fill
 * @param {boolean} [options.showBack=false] — show back control on the left
 * @param {string} [options.backHref] — if set with showBack, use link; if showBack and omitted, use history.back()
 * @param {string} [options.backLabel='Back']
 * @param {string} [options.backFallbackHref='index.html'] — when using history back and stack is empty
 * @param {string} [options.logoSrc='images/header_logo.png'] — empty string to hide logo
 * @param {string} [options.logoAlt='ShadeSafe Vancouver']
 * @param {string} [options.title] — optional title under / beside branding
 * @author Jiahao
 */
function loadAppHeader(options) {
    const opts = options || {};
    const mountId = opts.mountId || "app-header";
    const mount = document.getElementById(mountId);
    if (!mount) return;

    const showBack = !!opts.showBack;
    const backHref = opts.backHref;
    const backLabel = opts.backLabel != null ? opts.backLabel : "Back";
    const backFallbackHref = opts.backFallbackHref != null ? opts.backFallbackHref : "index.html";
    const logoSrc = opts.logoSrc !== undefined ? opts.logoSrc : "images/header_logo.png";
    const logoAlt = opts.logoAlt != null ? opts.logoAlt : "ShadeSafe Vancouver";
    const title = opts.title || "";

    let leadingHtml = "";
    if (showBack) {
        if (backHref) {
            leadingHtml =
                '<a class="app-header__back" href="' +
                escapeAttr(backHref) +
                '"><span class="app-header__back-icon" aria-hidden="true">←</span> ' +
                escapeHtml(backLabel) +
                "</a>";
        } else {
            leadingHtml =
                '<button type="button" class="app-header__back" data-app-header-history-back>' +
                '<span class="app-header__back-icon" aria-hidden="true">←</span> ' +
                escapeHtml(backLabel) +
                "</button>";
        }
    }

    const centerParts = [];
    if (logoSrc) {
        centerParts.push(
            '<img src="' +
                escapeAttr(logoSrc) +
                '" alt="' +
                escapeAttr(logoAlt) +
                '" class="app-header__logo" width="1225" height="240" decoding="async">'
        );
    }
    if (title) {
        centerParts.push('<span class="app-header__title">' + escapeHtml(title) + "</span>");
    }

    const centerInner = centerParts.length
        ? '<div class="app-header__center-inner">' + centerParts.join("") + "</div>"
        : '<div class="app-header__center-inner"></div>';

    const html =
        '<header class="app-header" role="banner">' +
        '<div class="app-header__leading">' +
        leadingHtml +
        "</div>" +
        '<div class="app-header__center">' +
        centerInner +
        "</div>" +
        '<div class="app-header__trail"></div>' +
        "</header>";

    mount.innerHTML = html;

    if (showBack && !backHref) {
        const btn = mount.querySelector("[data-app-header-history-back]");
        if (btn) {
            btn.addEventListener("click", function () {
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    window.location.href = backFallbackHref;
                }
            });
        }
    }
}

document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("navbar")) {
        loadNavbar();
    }
});
