/**
 * @file mapUserLocation.js
 * User dot, accuracy circle, Vancouver fallback marker, Leaflet Locate control.
 * @author Jiahao
 */

import { MAP_PAGE_CENTER, MAP_PAGE_MESSAGES } from "./mapConfig.js";
import { getUserPosition, getGeolocationPermissionState } from "./mapUserLocationGeoloc.js";

var FALLBACK_LAT = MAP_PAGE_CENTER.lat;
var FALLBACK_LNG = MAP_PAGE_CENTER.lng;
var toast = MAP_PAGE_MESSAGES;

/** @type {L.Map|null} */
var activeMap = null;
/** @type {L.Marker|null} */
var userMarker = null;
/** @type {L.Circle|null} */
var userAccuracyCircle = null;
var fallbackMarker = null;

function createUserLocationIcon() {
    var html =
        '<div class="map-user-loc" aria-hidden="true">' +
        '<span class="map-user-loc__pulse"></span>' +
        '<span class="map-user-loc__dot"></span>' +
        "</div>";
    return L.divIcon({
        className: "map-user-loc-wrap",
        html: html,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
    });
}

function createFallbackLocationIcon() {
    var html =
        '<div class="map-fallback-loc" aria-hidden="true">' +
        '<span class="map-fallback-loc__ring"></span>' +
        '<span class="map-fallback-loc__dot"></span>' +
        "</div>";
    return L.divIcon({
        className: "map-fallback-loc-wrap",
        html: html,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
    });
}

function hideLocationFallback() {
    if (fallbackMarker && activeMap) {
        activeMap.removeLayer(fallbackMarker);
        fallbackMarker = null;
    }
}

function showLocationFallbackAtDefault(map) {
    activeMap = map || activeMap;
    if (!activeMap) return;
    if (fallbackMarker) {
        fallbackMarker.setLatLng([FALLBACK_LAT, FALLBACK_LNG]);
        return;
    }
    fallbackMarker = L.marker([FALLBACK_LAT, FALLBACK_LNG], {
        icon: createFallbackLocationIcon(),
        title: "Approximate: Vancouver (enable location for your position)",
        keyboard: false,
        interactive: true,
        zIndexOffset: 350,
    });
    fallbackMarker.bindPopup(
        "<strong>Default map centre</strong><br />Location access is blocked or unavailable. " +
            "Allow location for this site in your browser settings to see where you are.",
        { closeButton: true, autoPan: true }
    );
    fallbackMarker.addTo(activeMap);
}

function addUserLocationLayer(map) {
    activeMap = map;
}

function showUserLocation(pos) {
    if (!activeMap || !pos) return;
    hideLocationFallback();
    var latlng = [pos.lat, pos.lng];

    if (!userMarker) {
        userMarker = L.marker(latlng, {
            icon: createUserLocationIcon(),
            interactive: false,
            keyboard: false,
            zIndexOffset: 400,
        }).addTo(activeMap);
    } else {
        userMarker.setLatLng(latlng);
    }

    if (typeof pos.accuracy === "number" && pos.accuracy > 0) {
        if (!userAccuracyCircle) {
            userAccuracyCircle = L.circle(latlng, {
                radius: pos.accuracy,
                className: "map-user-loc-accuracy",
                color: "#1976d2",
                weight: 1,
                opacity: 0.55,
                fillColor: "#1976d2",
                fillOpacity: 0.12,
                interactive: false,
            }).addTo(activeMap);
        } else {
            userAccuracyCircle.setLatLng(latlng);
            userAccuracyCircle.setRadius(pos.accuracy);
        }
    }
}

function addLocateControl(map, opts) {
    var onStatus = opts && typeof opts.onStatus === "function" ? opts.onStatus : null;
    var panZoom = opts && typeof opts.panZoom === "number" ? opts.panZoom : 15;

    var LocateControl = L.Control.extend({
        options: { position: "topleft" },
        onAdd: function () {
            var btn = L.DomUtil.create("button", "map-locate-btn leaflet-bar");
            btn.type = "button";
            btn.setAttribute("aria-label", "Locate me");
            btn.setAttribute("title", "Locate me");
            btn.innerHTML =
                '<svg class="map-locate-btn__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' +
                '<circle cx="12" cy="12" r="3.25"/>' +
                '<path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" stroke-linecap="round"/>' +
                '<circle cx="12" cy="12" r="7.5" fill="none" stroke-width="2"/>' +
                "</svg>";
            L.DomEvent.disableClickPropagation(btn);
            L.DomEvent.disableScrollPropagation(btn);
            btn.addEventListener("click", function () {
                if (btn.classList.contains("is-busy")) return;
                btn.classList.add("is-busy");

                function finishBusy() {
                    btn.classList.remove("is-busy");
                }

                getGeolocationPermissionState()
                    .then(function (state) {
                        if (state === "denied") {
                            showLocationFallbackAtDefault(map);
                            map.flyTo(
                                [FALLBACK_LAT, FALLBACK_LNG],
                                Math.max(12, map.getZoom()),
                                { duration: 0.45 }
                            );
                            if (onStatus) {
                                onStatus(
                                    toast ? toast.locBlocked
                                        : "Location blocked — showing Vancouver. Allow location in site settings.",
                                    5200
                                );
                            }
                            return null;
                        }
                        if (onStatus) {
                            onStatus(toast ? toast.locating : "Locating you…", 0);
                        }
                        return getUserPosition({ force: true });
                    })
                    .then(function (pos) {
                        if (!pos) return;
                        showUserLocation(pos);
                        map.flyTo([pos.lat, pos.lng], panZoom, { duration: 0.6 });
                        if (onStatus) {
                            onStatus(toast ? toast.centeredOnYou : "Centered on your location", 1800);
                        }
                    })
                    .catch(function (err) {
                        if (err && err.kind === "denied") {
                            showLocationFallbackAtDefault(map);
                            map.flyTo(
                                [FALLBACK_LAT, FALLBACK_LNG],
                                Math.max(12, map.getZoom()),
                                { duration: 0.45 }
                            );
                        } else {
                            console.warn("[mapUserLocation] locate failed", err);
                        }
                        if (onStatus) {
                            onStatus(
                                err.message ||
                                    (toast ? toast.couldntLocate : "Couldn't locate you"),
                                3200
                            );
                        }
                    })
                    .then(finishBusy, finishBusy);
            });
            return btn;
        },
    });

    var ctrl = new LocateControl();
    ctrl.addTo(map);
    return ctrl;
}

export {
    addUserLocationLayer,
    showUserLocation,
    showLocationFallbackAtDefault,
    hideLocationFallback,
    addLocateControl,
};
