/**
 * @file mapReport.js
 * Map report — wires Bootstrap 5 modal (#map-report-modal) for show/hide and submit.
 * Markup: index.html. Theme: css/components/mapReport.css
 *
 * Submit is client-only (console) until user accounts / API are wired.
 */

/** @type {boolean} */
var mapReportOpen = false;

/** @type {boolean} */
var mapReportListenersBound = false;

/**
 * @returns {HTMLElement|null}
 */
function mapReportModalEl() {
    return document.getElementById("map-report-modal");
}

/**
 * @returns {Object|null} bootstrap.Modal instance
 */
function mapReportGetModal() {
    var el = mapReportModalEl();
    if (!el || typeof bootstrap === "undefined" || !bootstrap.Modal) {
        return null;
    }
    return bootstrap.Modal.getOrCreateInstance(el);
}

function mapReportClearStatus() {
    var status = document.getElementById("map-report-status");
    if (status) {
        status.textContent = "";
        status.hidden = true;
    }
}

function mapReportSelectedTypeId() {
    var picked = document.querySelector('input[name="map-report-type"]:checked');
    return picked && picked.value ? picked.value : "";
}

function openMapReport() {
    var modal = mapReportGetModal();
    if (!modal) {
        return;
    }
    mapReportClearStatus();
    modal.show();
}

function closeMapReport() {
    var modal = mapReportGetModal();
    if (!modal) {
        mapReportOpen = false;
        return;
    }
    modal.hide();
}

/**
 * @returns {boolean} True if the modal was open and is now closed.
 */
function closeMapReportIfOpen() {
    if (!mapReportOpen) {
        return false;
    }
    closeMapReport();
    return true;
}

function mapReportOnSubmit() {
    mapReportClearStatus();
    var typeId = mapReportSelectedTypeId();
    var status = document.getElementById("map-report-status");
    if (!typeId) {
        if (status) {
            status.hidden = false;
            status.textContent = "Choose one option.";
        }
        return;
    }
    var payload = {
        reportType: typeId,
        recordedAt: new Date().toISOString(),
        location: {
            source: "device_gps",
            status: "pending",
            lat: null,
            lng: null,
            accuracyM: null,
        },
    };
    console.log("[mapReport] (demo — not persisted)", payload);
    if (status) {
        status.hidden = false;
        status.textContent = "Thanks — logged in the console only for now.";
    }
}

function initMapReport() {
    var fab = document.getElementById("map-report-fab");
    var modalEl = mapReportModalEl();
    var submit = document.getElementById("map-report-submit");
    if (!fab || !modalEl || typeof bootstrap === "undefined" || !bootstrap.Modal) {
        return;
    }

    if (!mapReportListenersBound) {
        mapReportListenersBound = true;
        fab.addEventListener("click", openMapReport);
        modalEl.addEventListener("show.bs.modal", function () {
            mapReportOpen = true;
            mapReportClearStatus();
        });
        modalEl.addEventListener("hidden.bs.modal", function () {
            mapReportOpen = false;
            mapReportClearStatus();
        });
        modalEl.addEventListener("shown.bs.modal", function () {
            var fs = document.getElementById("map-report-type-fieldset");
            var firstRadio = fs && fs.querySelector('input[name="map-report-type"]');
            if (firstRadio && !mapReportSelectedTypeId()) {
                firstRadio.checked = true;
            }
            if (firstRadio) {
                firstRadio.focus();
            }
        });
        if (submit) {
            submit.addEventListener("click", mapReportOnSubmit);
        }
    }
}
