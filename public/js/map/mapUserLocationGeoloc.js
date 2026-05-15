/**
 * @file mapUserLocationGeoloc.js
 * Geolocation: cache, getCurrentPosition wrapper, Permissions API, error translation.
 * @author Jiahao
 */

var GEOLOC_CACHE_TTL_MS = 60 * 1000;
var GEOLOC_TIMEOUT_MS = 12 * 1000;

/** @type {{ lat:number, lng:number, accuracy:number|null, fetchedAt:number }|null} */
var cachedPosition = null;

function isGeolocationSupported() {
    return typeof navigator !== "undefined" && !!navigator.geolocation;
}

function getCachedUserPosition() {
    if (!cachedPosition) return null;
    if (Date.now() - cachedPosition.fetchedAt > GEOLOC_CACHE_TTL_MS) {
        return null;
    }
    return cachedPosition;
}

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
                maximumAge: 30 * 1000,
            }
        );
    });
}

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

function tagError(err, kind) {
    err.kind = kind;
    return err;
}

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

export { getUserPosition, getCachedUserPosition, getGeolocationPermissionState };
