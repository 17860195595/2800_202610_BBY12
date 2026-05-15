/**
 * Map summary selection and redirect to AI page.
 */
var mapSummarySelection = null;
var mapSummaryMarker = null;

function updateMapSummaryUI() {
  var button = document.getElementById("map-summary-fab");
  if (!button) {
    return;
  }
  if (!mapSummarySelection) {
    button.hidden = true;
    return;
  }
  button.hidden = false;
  button.textContent = "Summarize selected location";
  button.title = "Open AI chat and summarize this selected location.";
}

function selectMapSummaryLocation(lat, lng) {
  mapSummarySelection = {
    lat: lat,
    lng: lng,
    name: "Custom Selected Vancouver location",
  };
  updateMapSummaryUI();
}

function renderMapSummaryMarker(map, lat, lng) {
  if (!map) return;
  if (!mapSummaryMarker) {
    mapSummaryMarker = L.circleMarker([lat, lng], {
      radius: 10,
      weight: 2,
      color: "#1f7a4f",
      fillColor: "rgba(143, 208, 166, 0.9)",
      fillOpacity: 0.7,
      pane: "markerPane",
    }).addTo(map);
  } else {
    mapSummaryMarker.setLatLng([lat, lng]);
  }
}

function initMapSummary(map) {
  if (!map) {
    return;
  }
  var button = document.getElementById("map-summary-fab");
  if (!button) {
    return;
  }
  button.hidden = true;

  map.on("click", function (ev) {
    if (!ev || !ev.latlng) {
      return;
    }
    selectMapSummaryLocation(ev.latlng.lat, ev.latlng.lng);
    renderMapSummaryMarker(map, ev.latlng.lat, ev.latlng.lng);
  });

  button.addEventListener("click", function () {
    if (!mapSummarySelection) {
      return;
    }
    var url = new URL(window.location.origin + "/ai-chat");
    url.searchParams.set("lat", String(mapSummarySelection.lat));
    url.searchParams.set("lng", String(mapSummarySelection.lng));
    url.searchParams.set("name", mapSummarySelection.name);
    url.searchParams.set("initialAction", "summary");
    window.location.href = url.toString();
  });
}
