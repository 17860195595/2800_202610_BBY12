/**
 * @file mapReportMarkers.js
 *
 * Visualises the crowd-sourced reports from /api/reports on the Leaflet
 * map. Each report has one of three types and we use a distinct icon +
 * colour per type so the layer reads at a glance:
 *
 *   too_hot               🔥  red flame    "too hot here"
 *   great_shade           🌳  green tree   "shady, comfortable"
 *   needs_shade_structure ⛱   amber brolly "open spot needs awning/canopy"
 *
 * Public API attached to window:
 *
 *   renderReportMarkers(map, reports)   — replaces the layer with one
 *                                          marker per report. Safe to
 *                                          call after a fresh fetch.
 *   addOneReportMarker(report)          — optimistic insert after a POST
 *                                          succeeds; no need to refetch.
 *   getReportTypeMeta(type)             — { label, glyph } for the modal
 *                                          and any future inline summary.
 *
 * @author Jiahao
 */

(function (global) {
    "use strict";

    /** Per-type metadata. Glyphs are single emojis so we don't ship extra
     *  SVG assets; the coloured pill behind them carries the semantics. */
    var REPORT_TYPE_META = {
        too_hot: { label: "Too hot", glyph: "\uD83D\uDD25" },          // 🔥
        great_shade: { label: "Great shade", glyph: "\uD83C\uDF33" },  // 🌳
        needs_shade_structure: { label: "Needs shade", glyph: "\u26F1" }, // ⛱
    };

    /** Singleton layer + identity tracker. */
    var reportLayerGroup = null;
    var reportMarkerMap = Object.create(null); // _id → L.Marker
    /** @type {L.Map|null} */
    var reportActiveMap = null;

    /**
     * @param {string} type
     * @returns {{label:string, glyph:string}}
     */
    function getReportTypeMeta(type) {
        return REPORT_TYPE_META[type] || { label: "Report", glyph: "\u2691" }; // ⚑
    }

    /**
     * Build a DivIcon for one of the three report types. The pill carries
     * the colour cue; the emoji glyph sits centred inside it. Pure inline
     * SVG so there's no extra HTTP request per marker.
     * @param {string} reportType
     * @returns {L.DivIcon}
     */
    function createReportDivIcon(reportType) {
        var meta = getReportTypeMeta(reportType);
        var w = 32;
        var h = 40;
        var modifier = REPORT_TYPE_META[reportType] ? reportType : "unknown";
        var html =
            '<div class="map-report-marker map-report-marker--' +
            modifier +
            '" aria-hidden="true">' +
            '<svg class="map-report-marker__pin" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" width="' +
            w +
            '" height="' +
            h +
            '">' +
            '<path d="M16 1.5C8.5 1.5 2.5 7.4 2.5 14.7c0 9 13.5 23.5 13.5 23.5s13.5-14.5 13.5-23.5C29.5 7.4 23.5 1.5 16 1.5z"/>' +
            '<circle cx="16" cy="14.5" r="8.5"/>' +
            "</svg>" +
            '<span class="map-report-marker__glyph">' +
            meta.glyph +
            "</span>" +
            "</div>";
        return L.divIcon({
            className: "map-report-marker-wrap",
            html: html,
            iconSize: [w, h],
            iconAnchor: [w / 2, h],
            popupAnchor: [0, -h + 6],
        });
    }

    /**
     * Format a Date / ISO string for the popup (English labels, e.g.
     * "May 15, 06:58"). Uses en-US so the string does not follow the
     * browser's system locale (which produced "5月15日" on zh-CN devices).
     * @param {string|Date} value
     * @returns {string}
     */
    function formatReportTime(value) {
        if (!value) return "";
        try {
            var d = value instanceof Date ? value : new Date(value);
            if (isNaN(d.getTime())) return String(value);
            return d.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            });
        } catch (e) {
            return String(value);
        }
    }

    /**
     * Build the popup HTML shown when a report pin is clicked. Plain text
     * only — no input fields here.
     * @param {Object} report
     * @returns {string}
     */
    function buildReportPopupHtml(report) {
        var meta = getReportTypeMeta(report.reportType);
        var when = formatReportTime(report.createdAt);
        return (
            '<div class="map-report-popup">' +
            '<strong class="map-report-popup__title">' +
            meta.glyph +
            " " +
            escapeHtmlReport(meta.label) +
            "</strong>" +
            (when
                ? '<p class="map-report-popup__meta">' + escapeHtmlReport(when) + "</p>"
                : "") +
            "</div>"
        );
    }

    /**
     * Append one marker to the existing layer (without rebuilding the
     * full layer group). Used right after a successful POST so the user
     * sees their report immediately, no need to wait for the next list.
     * @param {Object} report
     */
    function addOneReportMarker(report) {
        if (!reportActiveMap || !report) return;
        if (!reportLayerGroup) {
            reportLayerGroup = L.layerGroup().addTo(reportActiveMap);
        }
        var marker = buildSingleMarker(report);
        if (!marker) return;
        marker.addTo(reportLayerGroup);
        if (report._id) {
            reportMarkerMap[report._id] = marker;
        }
    }

    /**
     * @param {Object} report
     * @returns {L.Marker|null}
     */
    function buildSingleMarker(report) {
        if (
            !report ||
            typeof report.lat !== "number" ||
            typeof report.lng !== "number" ||
            isNaN(report.lat) ||
            isNaN(report.lng)
        ) {
            return null;
        }
        var marker = L.marker([report.lat, report.lng], {
            icon: createReportDivIcon(report.reportType),
            title: getReportTypeMeta(report.reportType).label,
            keyboard: false,
        });
        marker.bindPopup(buildReportPopupHtml(report), {
            closeButton: true,
            autoPan: true,
        });
        return marker;
    }

    /**
     * Replace the report layer with one marker per record. Call this
     * once on map boot and after a fresh fetch.
     * @param {L.Map} map
     * @param {Array<Object>} reports
     */
    function renderReportMarkers(map, reports) {
        reportActiveMap = map;
        if (reportLayerGroup) {
            map.removeLayer(reportLayerGroup);
            reportLayerGroup = null;
        }
        reportMarkerMap = Object.create(null);

        var group = L.layerGroup();
        if (Array.isArray(reports)) {
            for (var i = 0; i < reports.length; i++) {
                var r = reports[i];
                var m = buildSingleMarker(r);
                if (!m) continue;
                m.addTo(group);
                if (r._id) {
                    reportMarkerMap[r._id] = m;
                }
            }
        }
        group.addTo(map);
        reportLayerGroup = group;
    }

    /**
     * Tiny HTML-escape used inside the popup template.
     * @param {string} s
     * @returns {string}
     */
    function escapeHtmlReport(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    global.renderReportMarkers = renderReportMarkers;
    global.addOneReportMarker = addOneReportMarker;
    global.getReportTypeMeta = getReportTypeMeta;
})(window);
