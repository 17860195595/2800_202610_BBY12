/**
 * Alerts page entry (alert.html).
 * Fetches risk data using the user's current location.
 * Updates heat stress risk level, weather details,
 * refresh time, and high alert history.
 *
 * @author Eric Guo
 * Some UI structure, async fetch logic, and localStorage logic
 * were improved with assistance from ChatGPT.
 */

console.log("alert.js loaded");

const checkButton = document.querySelector(".alerts-check-btn");

/**
 * Gets the user's current location from the browser
 * and sends the latitude and longitude to fetchAlertData().
 *
 * @author Eric Guo
 */
function getUserLocation() {
  console.log("Getting user location...");

  navigator.geolocation.getCurrentPosition(function (position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    console.log("User latitude:", lat);
    console.log("User longitude:", lng);

    fetchAlertData(lat, lng);
  });
}

/**
 * Fetches risk and weather data from the backend API
 * using the user's latitude and longitude.
 * Then updates the risk score, risk level, chart,
 * weather metrics, location, and last updated time.
 *
 * @author Eric Guo
 * ChatGPT assisted with async/await structure
 * and dynamic HTML rendering improvements.
 */
async function fetchAlertData(lat, lng) {
  console.log("Fetching alert data...");

  const response = await fetch(`/api/risk?lat=${lat}&lng=${lng}&past_days=0`);
  const data = await response.json();

  console.log(data);

  const weatherEntries = data.slice(2).flat();
  const latest = weatherEntries[weatherEntries.length - 1];

  console.log("Latest data:", latest);

  const riskLevel = getRiskLevel(latest.risk);
  const riskValue = Math.round(latest.risk * 100);

  document.getElementById("risk-chart-value").textContent = `${riskValue}%`;

  chart.updateSeries([riskValue]);

  document.getElementById("risk-level").textContent = riskLevel;
  document.getElementById("risk-pill").textContent = riskLevel;

  updateRiskStyles(riskLevel);

  document.getElementById("risk-desc").innerHTML = `
    <p class="risk-desc-summary">${riskLevel} heat stress risk.</p>

    <div class="risk-metrics-grid">
      <div class="risk-metric">
        <i data-lucide="activity"></i>
        <div>
          <span>Risk score</span>
          <strong>${riskValue}%</strong>
        </div>
      </div>

      <div class="risk-metric">
        <i data-lucide="thermometer"></i>
        <div>
          <span>Temperature</span>
          <strong>${latest.temperature_C.toFixed(1)}°C</strong>
        </div>
      </div>

      <div class="risk-metric">
        <i data-lucide="sun"></i>
        <div>
          <span>UV index</span>
          <strong>${latest.uv_index.toFixed(1)}</strong>
        </div>
      </div>

      <div class="risk-metric">
        <i data-lucide="droplets"></i>
        <div>
          <span>Humidity</span>
          <strong>${latest.humidity_percent.toFixed(0)}%</strong>
        </div>
      </div>
    </div>
  `;

  lucide.createIcons();

  document.getElementById("alert-location").textContent = "Vancouver, BC";

  document.getElementById("alert-last-updated").textContent = formatTime(
    new Date(),
  );

  updateLastHighAlert(weatherEntries);

  const riskColor = getRiskColor(riskLevel);

  chart.updateOptions({
    colors: [riskColor],
  });

  chart.updateSeries([riskValue]);
}

/**
 * Updates the "Last High Alert" section.
 * It checks today's weather entries and finds the most recent
 * time when the risk level reached HIGH.
 *
 * @author Eric Guo
 */
function updateLastHighAlert(weatherEntries) {
  const lastHighAlert = weatherEntries
    .slice()
    .reverse()
    .find(function (entry) {
      return getRiskLevel(entry.risk) === "HIGH";
    });

  const lastPill = document.getElementById("last-pill");

  lastPill.classList.remove("last-pill--high", "last-pill--none");

  if (lastHighAlert) {
    document.getElementById("last-time").textContent =
      `Today, ${formatTime(lastHighAlert.time)}`;

    document.getElementById("last-desc").textContent =
      "Heat stress risk reached HIGH in your current area.";

    lastPill.textContent = "HIGH";
    lastPill.classList.add("last-pill--high");
  } else {
    document.getElementById("last-time").textContent = "No high alert today";

    document.getElementById("last-desc").textContent =
      "No HIGH heat stress risk has been detected in your current area.";

    lastPill.textContent = "NONE";
    lastPill.classList.add("last-pill--none");
  }
}

/**
 * Returns the chart color based on the current risk level.
 *
 * @author Eric Guo
 */
function getRiskColor(riskLevel) {
  if (riskLevel === "LOW") {
    return "#1f9d55";
  }

  if (riskLevel === "MODERATE") {
    return "#f5a623";
  }

  return "#dc2626";
}

/**
 * Converts the numeric risk score into a readable risk level.
 *
 * LOW: risk below 0.2
 * MODERATE: risk below 0.4
 * HIGH: risk 0.4 or higher
 *
 * @author Eric Guo
 */
function getRiskLevel(risk) {
  if (risk < 0.2) {
    return "LOW";
  }

  if (risk < 0.4) {
    return "MODERATE";
  }

  return "HIGH";
}

/**
 * Formats a date or time string into a readable local time.
 *
 * @author Eric Guo
 */
function formatTime(timeInput) {
  const date = new Date(timeInput);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Updates the risk card styling based on the current risk level.
 * This changes the card state, title color, and pill badge color.
 *
 * @author Eric Guo
 */
function updateRiskStyles(riskLevel) {
  const riskTitle = document.getElementById("risk-level");
  const riskPill = document.getElementById("risk-pill");
  const riskCard = document.querySelector(".alerts-risk-card");

  riskCard.classList.remove(
    "risk-low-state",
    "risk-moderate-state",
    "risk-high-state",
  );

  riskTitle.classList.remove("risk-low", "risk-moderate", "risk-high");

  riskPill.classList.remove(
    "arc-pill--low",
    "arc-pill--moderate",
    "arc-pill--high",
  );

  if (riskLevel === "LOW") {
    riskCard.classList.add("risk-low-state");
    riskTitle.classList.add("risk-low");
    riskPill.classList.add("arc-pill--low");
  } else if (riskLevel === "MODERATE") {
    riskCard.classList.add("risk-moderate-state");
    riskTitle.classList.add("risk-moderate");
    riskPill.classList.add("arc-pill--moderate");
  } else {
    riskCard.classList.add("risk-high-state");
    riskTitle.classList.add("risk-high");
    riskPill.classList.add("arc-pill--high");
  }
}

/**
 * Adds a click event to the refresh button.
 * When clicked, the page fetches the user's current location
 * and updates the risk data again.
 *
 * @author Eric Guo
 */
if (checkButton) {
  checkButton.addEventListener("click", getUserLocation);
}

/**
 * Sets up dismissible first-time user hints.
 * If the user has already closed a hint before,
 * localStorage prevents the same hint from showing again.
 *
 * @author Eric Guo
 * localStorage implementation was assisted by ChatGPT.
 */
function setupDismissibleHint(elementId, storageKey) {
  const hint = document.getElementById(elementId);

  if (!hint) {
    return;
  }

  if (localStorage.getItem(storageKey) === "true") {
    hint.style.display = "none";
  }

  hint.addEventListener("closed.bs.alert", function () {
    localStorage.setItem(storageKey, "true");
  });
}

setupDismissibleHint("alerts-first-time-hint", "alertsFirstTimeHintSeen");
setupDismissibleHint("alerts-risk-hint", "alertsRiskHintSeen");
setupDismissibleHint("alerts-refresh-hint", "alertsRefreshHintSeen");

/**
 * Loads the user's location and risk data when the page first opens.
 *
 * @author Eric Guo
 */
getUserLocation();

/**
 * Automatically refreshes the risk data every 6 minutes.
 *
 * @author Eric Guo
 */
setInterval(getUserLocation, 360000);

const riskValue = 0;

/**
 * ApexCharts radial bar chart configuration.
 * This chart displays the current heat stress risk score.
 *
 * @author Eric Guo
 * Chart configuration was adjusted with assistance from ChatGPT.
 */
const options = {
  series: [riskValue],

  chart: {
    type: "radialBar",
    height: 230,
    offsetY: -20,
    sparkline: {
      enabled: true,
    },
  },

  plotOptions: {
    radialBar: {
      startAngle: -90,
      endAngle: 90,

      track: {
        background: "#e7ece3",
        strokeWidth: "97%",
        margin: 5,
      },

      dataLabels: {
        name: {
          show: false,
        },
        value: {
          show: false,
        },
      },
    },
  },

  grid: {
    padding: {
      top: -10,
    },
  },

  fill: {
    type: "gradient",
    gradient: {
      shade: "light",
      shadeIntensity: 0.4,
      inverseColors: false,
      opacityFrom: 1,
      opacityTo: 1,
      stops: [0, 50, 100],
    },
  },

  colors: ["#f5a623"],
  labels: ["Risk"],
};

const chart = new ApexCharts(document.querySelector("#chart"), options);
chart.render();
