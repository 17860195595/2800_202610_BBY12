/**
 * @file mapReport.js
 *
 * Map report — wires the Bootstrap 5 modal (#map-report-modal) for show /
 * hide and submit, captures the user's GPS via getUserPosition, then POSTs
 * the report to /api/reports. On success it dispatches a window event so
 * pages/index.js can drop the new marker on the map without a re-fetch:
 *
 *   maptoggle:report-created   detail = { report }
 *
 * Markup: index.html  ·  Theme: css/components/mapReport.css
 *
 * Failure paths surface a clear inline status (permission denied, fix
 * timed out, server offline, etc.) without dismissing the modal so the
 * user can retry. Geolocation failures fall back to the same Vancouver
 * default centre as the map so a report can still be saved.
 *
 * @author Jiahao
 */

import { MAP_PAGE_CENTER } from "./mapConfig.js";
import { getUserPosition } from "./mapUserLocationGeoloc.js";
import { createReport } from "../services/reportApi.js";

/** @type {boolean} */
var mapReportOpen = false;

/** @type {boolean} */
var mapReportListenersBound = false;

/** @type {boolean} */
var mapReportSubmitting = false;

/** Same default centre as mapConfig MAP_PAGE_CENTER / mapUserLocation.js */
var MAP_REPORT_DEFAULT_LAT = MAP_PAGE_CENTER.lat;
var MAP_REPORT_DEFAULT_LNG = MAP_PAGE_CENTER.lng;

/**
 * Build a synthetic position object when GPS is unavailable. Pins the
 * report at Vancouver so the flow never hard-fails on permission alone.
 * @param {string} reason
 * @returns {{ lat:number, lng:number, accuracy:null, fetchedAt:number, isFallback:boolean, fallbackReason:string }}
 */
function mapReportFallbackPosition(reason) {
    return {
        lat: MAP_REPORT_DEFAULT_LAT,
        lng: MAP_REPORT_DEFAULT_LNG,
        accuracy: null,
        fetchedAt: Date.now(),
        isFallback: true,
        fallbackReason: reason || "unknown",
    };
}

/**
 * Try GPS; on any failure return the Vancouver default instead of rejecting.
 * @returns {Promise<{ lat:number, lng:number, accuracy:(number|null), fetchedAt:number, isFallback?:boolean, fallbackReason?:string }>}
 */
function mapReportResolvePosition() {
    return getUserPosition({ force: false }).catch(function (err) {
        var kind = err && err.kind ? err.kind : "unknown";
        return mapReportFallbackPosition(kind);
    });
}

/**
 * @returns {HTMLElement|null}
 * @author Jiahao
 */
function mapReportModalEl() {
    return document.getElementById("map-report-modal");
}

/**
 * @returns {Object|null} bootstrap.Modal instance
 * @author Jiahao
 */
function mapReportGetModal() {
    var el = mapReportModalEl();
    if (!el || typeof bootstrap === "undefined" || !bootstrap.Modal) {
        return null;
    }
    return bootstrap.Modal.getOrCreateInstance(el);
}

/**
 * Update the inline status row. Pass an empty string to hide it.
 * @param {string} text
 * @param {'info'|'error'|'success'} [variant]
 * @author Jiahao
 */
function mapReportSetStatus(text, variant) {
    var status = document.getElementById("map-report-status");
    if (!status) return;
    status.textContent = text || "";
    status.hidden = !text;
    status.classList.remove(
        "map-report-status--error",
        "map-report-status--success",
        "map-report-status--info"
    );
    if (text && variant) {
        status.classList.add("map-report-status--" + variant);
    }
}

/**
 * Clear inline status text in the report modal.
 * @author Jiahao
 */
function mapReportClearStatus() {
    mapReportSetStatus("", null);
}

/**
 * Update the location hint to reflect either pending GPS, an actual fix,
 * or a friendly fallback. Called from the submit handler.
 * @param {string} text
 * @author Jiahao
 */
function mapReportSetLocationHint(text) {
    var hint = document.getElementById("map-report-location-hint");
    if (hint) hint.textContent = text || "";
}

/**
 * Return selected report type from radio group.
 * @returns {string}
 * @author Jiahao
 */
function mapReportSelectedTypeId() {
    var picked = document.querySelector('input[name="map-report-type"]:checked');
    return picked && picked.value ? picked.value : "";
}

/**
 * Toggle the submit button's busy state. Disables the input so the user
 * can't double-tap submit while geolocation / POST is in flight.
 * @param {boolean} busy
 * @author Jiahao
 */
function mapReportSetSubmitBusy(busy) {
    mapReportSubmitting = !!busy;
    var btn = document.getElementById("map-report-submit");
    if (!btn) return;
    btn.disabled = !!busy;
    btn.classList.toggle("is-busy", !!busy);
    if (busy) {
        btn.dataset.originalLabel = btn.dataset.originalLabel || btn.textContent;
        btn.textContent = "Saving…";
    } else if (btn.dataset.originalLabel) {
        btn.textContent = btn.dataset.originalLabel;
    }
}

/**
 * Open the report modal.
 * @author Jiahao
 */
function openMapReport() {
    var modal = mapReportGetModal();
    if (!modal) {
        return;
    }
    mapReportClearStatus();
    mapReportSetLocationHint(
        "We try your device location first. If access is blocked, your report is saved at Vancouver city centre — you can still submit."
    );
    modal.show();
}

/**
 * Close the report modal.
 * @author Jiahao
 */
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
 * @author Jiahao
 */
function closeMapReportIfOpen() {
    if (!mapReportOpen) {
        return false;
    }
    closeMapReport();
    return true;
}

/**
 * Show a Bootstrap 5 success toast after a report is saved. Falls back to
 * no-op if the markup or Bootstrap bundle is missing.
 * @param {string} message
 * @author Jiahao
 */
function mapReportShowSuccessToast(message) {
    var el = document.getElementById("map-report-success-toast");
    var body = document.getElementById("map-report-success-toast-body");
    if (!el || typeof bootstrap === "undefined" || !bootstrap.Toast) {
        return;
    }
    if (body) {
        body.textContent = message || "Report submitted successfully.";
    }
    var toast = bootstrap.Toast.getOrCreateInstance(el, {
        autohide: true,
        delay: 4500,
    });
    toast.show();
}

/**
 * Validate, geolocate, POST. Closes the modal on success and dispatches
 * `maptoggle:report-created` so the map can render the new pin without
 * waiting for the next list refresh.
 * @author Jiahao
 */
function mapReportOnSubmit() {
    if (mapReportSubmitting) return;

    mapReportClearStatus();
    var typeId = mapReportSelectedTypeId();
    if (!typeId) {
        mapReportSetStatus("Choose one option.", "error");
        return;
    }
    if (typeof createReport !== "function") {
        mapReportSetStatus("Reporting is unavailable right now.", "error");
        return;
    }

    mapReportSetSubmitBusy(true);
    mapReportSetStatus("Getting your location…", "info");

    mapReportResolvePosition()
        .then(function (pos) {
            if (pos.isFallback) {
                mapReportSetLocationHint(
                    "Location unavailable — this report will be pinned at Vancouver city centre (" +
                        pos.lat.toFixed(4) +
                        ", " +
                        pos.lng.toFixed(4) +
                        "). Enable location for this site to pin where you are."
                );
            } else {
                mapReportSetLocationHint(
                    "Captured: " +
                        pos.lat.toFixed(5) +
                        ", " +
                        pos.lng.toFixed(5) +
                        (pos.accuracy ? " (±" + Math.round(pos.accuracy) + " m)" : "")
                );
            }
            mapReportSetStatus("Saving your report…", "info");
            return createReport({
                reportType: typeId,
                lat: pos.lat,
                lng: pos.lng,
                accuracyM: pos.accuracy,
            }).then(function (report) {
                return { report: report, pos: pos };
            });
        })
        .then(function (result) {
            var report = result && result.report;
            var pos = result && result.pos;
            window.dispatchEvent(
                new CustomEvent("maptoggle:report-created", {
                    detail: { report: report, position: pos },
                })
            );
            var toastMsg =
                pos && pos.isFallback
                    ? "Report saved at city centre. Enable location next time for a precise pin."
                    : "Report submitted successfully.";
            closeMapReport();
            requestAnimationFrame(function () {
                mapReportShowSuccessToast(toastMsg);
            });
        })
        .catch(function (err) {
            console.warn("[mapReport] submit failed", err);
            mapReportSetStatus(
                (err && err.message) || "Couldn't save your report. Please try again.",
                "error"
            );
        })
        .then(function () {
            mapReportSetSubmitBusy(false);
        });
}

/**
 * Bind report FAB/modal events once.
 * @author Jiahao
 */
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
            mapReportSetSubmitBusy(false);
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

export { initMapReport, closeMapReportIfOpen };
