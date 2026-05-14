/**
 * @file services/reportApi.js
 *
 * Thin fetch wrappers around the /api/reports backend (routes/reports.js):
 *
 *   listReports({ limit? })     → Promise<Array<Report>>
 *   createReport(payload)       → Promise<Report>
 *
 * Both throw on non-2xx so callers can surface the server's error message
 * via .catch(err => err.message). createReport rejects with the validation
 * text returned by the server (e.g. "Invalid reportType.") so the modal can
 * show meaningful inline status without the client re-checking shapes.
 *
 * Exposed on the window so the (non-module) frontend can call them via the
 * global namespace, matching the rest of /public/js conventions.
 *
 * @author Jiahao
 */

(function (global) {
    "use strict";

    /**
     * @param {{ limit?: number }} [opts]
     * @returns {Promise<Array<{ _id?: string, reportType: string, lat: number, lng: number, accuracyM: (number|null), createdAt: string }>>}
     */
    function listReports(opts) {
        var limit = opts && typeof opts.limit === "number" ? opts.limit : null;
        var url = "/api/reports" + (limit ? "?limit=" + encodeURIComponent(limit) : "");
        return fetch(url, { headers: { Accept: "application/json" } })
            .then(function (res) {
                return res.json().then(function (body) {
                    if (!res.ok) {
                        var msg = (body && body.error) || "Failed to list reports";
                        throw new Error(msg);
                    }
                    return body && Array.isArray(body.reports) ? body.reports : [];
                });
            });
    }

    /**
     * @param {{ reportType: string, lat: number, lng: number, accuracyM?: (number|null) }} payload
     * @returns {Promise<{ _id?: string, reportType: string, lat: number, lng: number, accuracyM: (number|null), createdAt: string }>}
     */
    function createReport(payload) {
        return fetch("/api/reports", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(payload || {}),
        }).then(function (res) {
            return res.json().then(function (body) {
                if (!res.ok) {
                    var msg = (body && body.error) || "Failed to save report";
                    var err = new Error(msg);
                    err.status = res.status;
                    throw err;
                }
                return body && body.report;
            });
        });
    }

    global.listReports = listReports;
    global.createReport = createReport;
})(window);
