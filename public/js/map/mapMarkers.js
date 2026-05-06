/**
 * @file mapMarkers.js
 * Leaflet markers for MOCK_MAP_LOCATIONS: custom divIcon (SVG pin), click opens spot detail.
 *
 * Depends on: Leaflet, MOCK_MAP_LOCATIONS, mapSpotDetail.js (openMapSpotDetail)
 *
 * Layering: markers use Leaflet’s marker pane (above the heat canvas overlay pane), so pins stay clickable.
 *
 * Note on divIcon: iconAnchor is bottom-center of the pin so the tip sits on the coordinates;
 * Leaflet docs + Claude-assisted sanity check on anchor vs viewBox size.
 */

/**
 * Build a DivIcon with inline SVG (no extra HTTP request). className clears default leaflet-div-icon border.
 * @returns {L.DivIcon}
 */
function createSpotDivIcon() {
    var w = 36;
    var h = 46;
    var html =
        '<div class="map-spot-marker" aria-hidden="true">' +
        '<svg class="map-spot-marker__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 46" width="' +
        w +
        '" height="' +
        h +
        '">' +
        '<path class="map-spot-marker__pin" d="M18 1.5C9.4 1.5 2.5 8.4 2.5 17c0 10.2 14.2 26.2 15.2 27.8.4.7 1.2.7 1.6 0C20.3 43.2 33.5 27.2 33.5 17 33.5 8.4 26.6 1.5 18 1.5z"/>' +
        '<circle class="map-spot-marker__dot" cx="18" cy="17" r="5.25"/>' +
        "</svg></div>";

    return L.divIcon({
        className: "map-spot-marker-wrap",
        html: html,
        iconSize: [w, h],
        iconAnchor: [w / 2, h],
        popupAnchor: [0, -h],
    });
}

/**
 * Add one marker per valid mock row; reuse the same icon instance for performance.
 * IIFE in the loop captures spot `s` for the click handler (classic JS closure fix).
 * @param {L.Map} map
 */
function addMockLocationMarkers(map) {
    var rows =
        typeof MOCK_MAP_LOCATIONS !== "undefined" && Array.isArray(MOCK_MAP_LOCATIONS)
            ? MOCK_MAP_LOCATIONS
            : [];
    if (!rows.length) {
        return;
    }

    var icon = createSpotDivIcon();

    for (var i = 0; i < rows.length; i++) {
        var spot = rows[i];
        if (
            typeof spot.lat !== "number" ||
            typeof spot.lng !== "number" ||
            isNaN(spot.lat) ||
            isNaN(spot.lng)
        ) {
            continue;
        }

        var marker = L.marker([spot.lat, spot.lng], {
            icon: icon,
            title: spot.name || "Location",
        });

        (function (s) {
            marker.on("click", function () {
                openMapSpotDetail(s);
            });
        })(spot);

        marker.addTo(map);
    }
}
