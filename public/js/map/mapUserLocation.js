/**
 * @file mapUserLocation.js
 *
 * One module for everything related to "where am I right now":
 *
 *   - getUserPosition({ force? })       → Promise<{ lat, lng, accuracy, fetchedAt }>
 *                                          Wraps navigator.geolocation with a
 *                                          60 s in-memory cache so the Report
 *                                          flow and the Locate button can
 *                                          share one fix without re-prompting.
 *   - getCachedUserPosition()           → most recent fix or null
 *   - addUserLocationLayer(map)         → builds (but doesn't show) the blue
 *                                          dot + accuracy circle that
 *                                          represent the user.
 *   - showUserLocation(pos)             → drops/updates the dot + circle.
 *   - addLocateControl(map, opts)       → adds the round "📍" button to the
 *                                          top-right corner of the Leaflet
 *                                          canvas. Click → locate + pan.
 *
 * Behaviour: the page kicks off a single auto-locate on first paint so
 * "open map → see myself" works without an extra tap. If the browser
 * denies / times out / isn't supported, the map stays at the Vancouver
 * centre default (already painted before the geolocate runs) and the
 * Locate control remains available for explicit retry.
 *
 * @author Jiahao
 */

(function (global) {
    "use strict";

    /** Re-use a geolocation fix that's less than a minute old. The
     *  page-side flows (locate click, report submit) typically happen in
     *  quick succession; one cached fix is plenty. */
    var GEOLOC_CACHE_TTL_MS = 60 * 1000;
    /** Soft timeout for the underlying getCurrentPosition call. Mobile
     *  Safari frequently sits ~6 s waiting for an indoor fix; we wait a
     *  little longer than that, then surface a "Locating failed" message. */
    var GEOLOC_TIMEOUT_MS = 12 * 1000;

    /** When GPS is blocked or unavailable, we still show *something* on the
     *  map so the user isn't staring at a blank canvas — same centre as
     *  pages/index.js MAP_CENTER. */
    var FALLBACK_LAT = 49.2827;
    var FALLBACK_LNG = -123.1207;

    /** @type {{ lat:number, lng:number, accuracy:number|null, fetchedAt:number }|null} */
    var cachedPosition = null;
    /** @type {L.Map|null} */
    var activeMap = null;
    /** @type {L.Marker|null} */
    var userMarker = null;
    /** @type {L.Circle|null} */
    var userAccuracyCircle = null;
    /** Grey "approximate" dot when geolocation is denied / unsupported. */
    var fallbackMarker = null;

    function isGeolocationSupported() {
        return typeof navigator !== "undefined" && !!navigator.geolocation;
    }

    /**
     * @returns {{ lat:number, lng:number, accuracy:number|null, fetchedAt:number }|null}
     */
    function getCachedUserPosition() {
        if (!cachedPosition) return null;
        if (Date.now() - cachedPosition.fetchedAt > GEOLOC_CACHE_TTL_MS) {
            return null;
        }
        return cachedPosition;
    }

    /**
     * @param {{ force?: boolean }} [opts] force=true bypasses the cache
     * @returns {Promise<{ lat:number, lng:number, accuracy:number|null, fetchedAt:number }>}
     */
    function getUserPosition(opts) {
        var force = !!(opts && opts.force);
        if (!force) {
            var cached = getCachedUserPosition();
            if (cached) return Promise.resolve(cached);
        }
        if (!isGeolocationSupported()) {
            return Promise.reject(new Error("Geolocation is not supported on this device"));
        }
        return new Promise(function (resolve, reject) {
            navigator.geolocation.getCurrentPosition(
                function (pos) {
                    cachedPosition = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        accuracy:
                            typeof pos.coords.accuracy === "number" && pos.coords.accuracy >= 0
                                ? pos.coords.accuracy
                                : null,
                        fetchedAt: Date.now(),
                    };
                    resolve(cachedPosition);
                },
                function (err) {
                    reject(translateGeolocationError(err));
                },
                {
                    enableHighAccuracy: true,
                    timeout: GEOLOC_TIMEOUT_MS,
                    // Accept a recent OS-level cache silently (no permission
                    // re-prompt for fixes within the last 30 s).
                    maximumAge: 30 * 1000,
                }
            );
        });
    }

    /**
     * Turn the W3C PositionError numeric codes into something the inline
     * status text in the report modal / toast can show verbatim. The
     * returned Error gets a `kind` tag so callers can decide whether to
     * surface it as a real error (console.warn) or a benign user choice
     * (console.info) — "permission denied" is the latter.
     * @param {GeolocationPositionError|Error} err
     * @returns {Error & { kind: 'denied'|'position-unavailable'|'timeout'|'unknown' }}
     */
    function translateGeolocationError(err) {
        if (!err) {
            return tagError(new Error("Could not get your location"), "unknown");
        }
        var code = err.code;
        if (code === 1) {
            return tagError(
                new Error("Location permission denied. Allow location access and try again."),
                "denied"
            );
        }
        if (code === 2) {
            return tagError(
                new Error("Your device couldn't get a fix. Try moving to an open area."),
                "position-unavailable"
            );
        }
        if (code === 3) {
            return tagError(new Error("Locating timed out. Please try again."), "timeout");
        }
        return tagError(new Error(err.message || "Could not get your location"), "unknown");
    }

    /**
     * @param {Error} err
     * @param {string} kind
     * @returns {Error}
     */
    function tagError(err, kind) {
        err.kind = kind;
        return err;
    }

    /**
     * Check whether the browser already has a saved "denied" answer for
     * the geolocation permission. Returns a Promise so we can use it as a
     * cheap gate before calling getCurrentPosition (which would otherwise
     * re-emit the same denied error every page load).
     *
     * Resolves to:
     *   "granted"  — permission already granted, safe to call
     *   "denied"   — user said no in this browser; don't even ask
     *   "prompt"   — never asked yet, calling will trigger the OS prompt
     *   "unknown"  — Permissions API unsupported (mobile Safari pre-16, etc.)
     *
     * @returns {Promise<'granted'|'denied'|'prompt'|'unknown'>}
     */
    function getGeolocationPermissionState() {
        if (
            typeof navigator === "undefined" ||
            !navigator.permissions ||
            typeof navigator.permissions.query !== "function"
        ) {
            return Promise.resolve("unknown");
        }
        return navigator.permissions
            .query({ name: "geolocation" })
            .then(function (status) {
                return status && status.state ? status.state : "unknown";
            })
            .catch(function () {
                return "unknown";
            });
    }

    /**
     * Build the user-location DivIcon. A pulsing halo behind a solid blue
     * dot — the familiar "you are here" affordance on web maps.
     * @returns {L.DivIcon}
     */
    function createUserLocationIcon() {
        var html =
            '<div class="map-user-loc" aria-hidden="true">' +
            '<span class="map-user-loc__pulse"></span>' +
            '<span class="map-user-loc__dot"></span>' +
            '</div>';
        return L.divIcon({
            className: "map-user-loc-wrap",
            html: html,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
        });
    }

    /**
     * Muted pin for "we can't read GPS — map is centred on Vancouver".
     * @returns {L.DivIcon}
     */
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

    /**
     * Remove the Vancouver fallback marker (called when a real GPS fix lands).
     * @author Jiahao
     */
    function hideLocationFallback() {
        if (fallbackMarker && activeMap) {
            activeMap.removeLayer(fallbackMarker);
            fallbackMarker = null;
        }
    }

    /**
     * Show a static marker at Vancouver centre when geolocation is denied or
     * not available — satisfies "default position" visually on the map.
     * @param {L.Map} map
     * @author Jiahao
     */
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

    /**
     * Capture the map reference. The marker + circle are lazily created
     * the first time showUserLocation runs.
     * @param {L.Map} map
     */
    function addUserLocationLayer(map) {
        activeMap = map;
    }

    /**
     * Drop or update the user's blue dot + accuracy ring. Safe to call
     * repeatedly; subsequent calls just reposition.
     * @param {{ lat:number, lng:number, accuracy:number|null }} pos
     */
    function showUserLocation(pos) {
        if (!activeMap || !pos) return;
        hideLocationFallback();
        var latlng = [pos.lat, pos.lng];

        if (!userMarker) {
            userMarker = L.marker(latlng, {
                icon: createUserLocationIcon(),
                interactive: false,
                keyboard: false,
                // Keep the dot below the report markers but above the heat
                // layer; Leaflet's zIndexOffset is fine for this.
                zIndexOffset: 400,
            }).addTo(activeMap);
        } else {
            userMarker.setLatLng(latlng);
        }

        // Only draw the accuracy ring when we have a useful number — sub-
        // 10 m fixes render an invisible ring otherwise.
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

    /**
     * Build the round Locate button as a Leaflet control. Clicking it
     * triggers a fresh geolocate (bypassing the in-memory cache so the
     * UX feels responsive) and pans + zooms the map.
     *
     * Status feedback is delegated to opts.onStatus so this module stays
     * decoupled from the page-level toast UI.
     *
     * @param {L.Map} map
     * @param {{ onStatus?: (text:string, ms?:number) => void, panZoom?: number }} [opts]
     * @returns {L.Control}
     */
    function addLocateControl(map, opts) {
        var onStatus = opts && typeof opts.onStatus === "function" ? opts.onStatus : null;
        var panZoom = opts && typeof opts.panZoom === "number" ? opts.panZoom : 15;

        var LocateControl = L.Control.extend({
            // Stack under the default zoom control on the top-left; the
            // top-right corner is already occupied by the toggle bar.
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

                    // If the browser already remembers "denied", never call
                    // getCurrentPosition — it only spams the console and
                    // throws the same error every click (see user report ×7).
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
                                        "Location blocked — showing Vancouver. Allow location in site settings.",
                                        5200
                                    );
                                }
                                return null;
                            }
                            if (onStatus) onStatus("Locating you…", 0);
                            return getUserPosition({ force: true });
                        })
                        .then(function (pos) {
                            if (!pos) return;
                            showUserLocation(pos);
                            map.flyTo([pos.lat, pos.lng], panZoom, { duration: 0.6 });
                            if (onStatus) onStatus("Centered on your location", 1800);
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
                                onStatus(err.message || "Couldn't locate you", 3200);
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

    global.getUserPosition = getUserPosition;
    global.getCachedUserPosition = getCachedUserPosition;
    global.getGeolocationPermissionState = getGeolocationPermissionState;
    global.addUserLocationLayer = addUserLocationLayer;
    global.showUserLocation = showUserLocation;
    global.showLocationFallbackAtDefault = showLocationFallbackAtDefault;
    global.hideLocationFallback = hideLocationFallback;
    global.addLocateControl = addLocateControl;
})(window);
