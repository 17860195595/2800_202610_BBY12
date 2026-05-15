/**
 * Added by @Markus
 *
 * main controller for the AI chat page.
 * handles chat history, location selection, UI rendering, and communication with the backend AI service.
 *
 * AI-generated
 * Created as part of the "Sprint 3 Popup Challenge".
 */
(function () {
  "use strict";

  /** Storage key used for persisting chat history in localStorage */
  var STORAGE_KEY = "aiChatHistory";

  /** Currently selected location object */
  var selectedLocation = null;

  /** Array of chat message objects { role, content } */
  var chatHistory = [];

  /** Flag to prevent multiple concurrent sends */
  var isSending = false;

  /** Tracks last selected location to avoid duplicate suggestions */
  var lastLocationKey = null;

  /** Default suggestion inserted when a new location is selected */
  var locationSuggestionText =
    "Please summarize the current conditions, risk score, and guidance for this newly selected location based on the latest computed risk data.";

  /** DOM references */
  var locationNameEl = document.getElementById("aiLocationName");
  var locationDetailsEl = document.getElementById("aiLocationDetails");
  var messagesEl = document.getElementById("aiChatMessages");
  var formEl = document.getElementById("aiChatForm");
  var inputEl = document.getElementById("aiChatInput");
  var resetEl = document.getElementById("aiResetContext");
  var quickLocationsEl = document.getElementById("aiQuickLocations");

  /**
   * Added by @Markus
   *
   * loads chat history from localStorage into memory.
   * ensures safe parsing and fallback to an empty array on failure.
   *
   * AI-generated.
   * Sprint 3 Popup Challenge.
   */
  function loadHistory() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        chatHistory = [];
        return;
      }
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        chatHistory = parsed;
      } else {
        chatHistory = [];
      }
    } catch (err) {
      chatHistory = [];
    }
  }

  /**
   * Added by @Markus
   *
   * saves the current chat history to localStorage.
   *
   * AI-generated.
   * Sprint 3 Popup Challenge.
   */
  function saveHistory() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory));
    } catch (err) {
      console.warn("Unable to save AI chat history.", err);
    }
  }

  /**
   * Added by @Markus
   *
   * generates a unique key for a location using name and coordinates.
   *
   * @param {Object} location
   * @returns {string|null}
   *
   * AI-generated.
   * Sprint 3 Popup Challenge.
   */
  function getLocationKey(location) {
    if (!location) return null;
    return [location.name, location.lat, location.lng].join("|");
  }

  /**
   * Added by @Markus
   *
   * inserts a suggested prompt when a new location is selected.
   *
   * @param {Object} location
   *
   * AI-generated.
   * Sprint 3 Popup Challenge.
   */
  function maybeShowLocationSuggestion(location) {
    if (!inputEl) return;
    var newKey = getLocationKey(location);
    if (!newKey) {
      lastLocationKey = null;
      return;
    }
    if (newKey !== lastLocationKey && !inputEl.value.trim()) {
      inputEl.value = locationSuggestionText;
    }
    lastLocationKey = newKey;
  }

  /**
   * Added by @Markus
   *
   * updates the currently selected location and UI display.
   *
   * @param {Object|null} location
   *
   * AI-generated.
   * Sprint 3 Popup Challenge.
   */
  function setSelectedLocation(location) {
    selectedLocation = location || null;
    if (!selectedLocation) {
      locationNameEl.textContent = "No location selected";
      locationDetailsEl.textContent =
        "Pick a location from the map, or choose one of the key locations below.";
      maybeShowLocationSuggestion(null);
      return;
    }
    locationNameEl.textContent =
      location.name || "Custom Selected Vancouver location";
    locationDetailsEl.textContent =
      (location.lat != null && location.lng != null
        ? "Coordinates: " +
          location.lat.toFixed(5) +
          ", " +
          location.lng.toFixed(5) +
          "."
        : "") + " Use the chat field below to ask for risk and shade guidance.";
    maybeShowLocationSuggestion(location);
  }

  /**
   * Added by @Markus
   *
   * creates a chat bubble element for a given message.
   * supports markdown rendering via marked.js.
   *
   * @param {{role: string, content: string}} message
   * @returns {HTMLElement}
   *
   * AI-generated.
   * Sprint 3 Popup Challenge.
   */
  function buildMessageBubble(message) {
    var bubble = document.createElement("div");
    bubble.className = "ai-chat-bubble ai-chat-bubble--" + message.role;
    bubble.innerHTML = marked.parse(message.content);
    return bubble;
  }

  /**
   * Added by @Markus
   *
   * renders all chat messages to the UI.
   * handles empty state and loading indicators.
   *
   * AI-generated.
   * Sprint 3 Popup Challenge.
   */
  function renderMessages() {
    if (!messagesEl) return;
    messagesEl.textContent = "";

    if (!chatHistory.length) {
      var hint = document.createElement("div");
      hint.className = "ai-chat-bubble ai-chat-bubble--assistant";
      hint.textContent =
        "Ask a question about the selected location, or choose a key public place to start.";
      messagesEl.appendChild(hint);

      if (isSending) {
        var loadingHint = document.createElement("div");
        loadingHint.className =
          "ai-chat-bubble ai-chat-bubble--assistant ai-chat-loading";
        loadingHint.textContent =
          "Thinking... loading the latest risk guidance.";
        messagesEl.appendChild(loadingHint);
      }

      messagesEl.scrollTop = messagesEl.scrollHeight;
      return;
    }

    chatHistory.forEach(function (msg) {
      messagesEl.appendChild(buildMessageBubble(msg));
    });

    if (isSending) {
      var loadingBubble = document.createElement("div");
      loadingBubble.className =
        "ai-chat-bubble ai-chat-bubble--assistant ai-chat-loading";
      loadingBubble.textContent = "Thinking...";
      messagesEl.appendChild(loadingBubble);
    }

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  /**
   * Added by @Markus
   *
   * appends a new message to history and re-renders UI.
   *
   * @param {"user"|"assistant"} role
   * @param {string} content
   *
   * AI-generated.
   * Sprint 3 Popup Challenge.
   */
  function updateHistory(role, content) {
    chatHistory.push({ role: role, content: content });
    if (chatHistory.length > 50) {
      chatHistory = chatHistory.slice(-50);
    }
    saveHistory();
    renderMessages();
  }

  /**
   * Added by @Markus
   *
   * returns the most recent messages for context.
   *
   * @returns {Array}
   *
   * AI-generated.
   * Sprint 3 Popup Challenge.
   */
  function getRecentMessages() {
    return chatHistory.slice(-5).map(function (message) {
      return { role: message.role, content: message.content };
    });
  }

  /**
   * Added by @Markus
   *
   * fetches risk data for a given location from backend API.
   *
   * @param {number} lat
   * @param {number} lng
   *
   * AI-generated.
   * Sprint 3 Popup Challenge.
   */
  async function fetchLocationRisk(lat, lng) {
    var url =
      "/api/risk?lat=" +
      encodeURIComponent(lat) +
      "&lng=" +
      encodeURIComponent(lng) +
      "&past_days=0";

    var response = await fetch(url);
    if (!response.ok) {
      throw new Error("Unable to load location risk details.");
    }

    var data = await response.json();
    var current = Array.isArray(data[2]) && data[2].length ? data[2][0] : null;

    if (current) {
      selectedLocation = selectedLocation || {};
      selectedLocation.riskScore =
        typeof current.risk === "number" ? current.risk.toFixed(2) : null;
      selectedLocation.temperature_C = current.temperature_C;
      selectedLocation.uv_index = current.uv_index;
      selectedLocation.humidity_percent = current.humidity_percent;
      selectedLocation.windspeed_KM = current.windspeed_KM;
      selectedLocation.shade = current.shade;
      setSelectedLocation(selectedLocation);
    }
  }

  /**
   * Added by @Markus
   *
   * sends user message to backend AI API and returns response.
   *
   * @param {string} userMessage
   * @returns {Promise<string>}
   *
   * AI-generated.
   * Sprint 3 Popup Challenge.
   */
  async function callAiApi(userMessage) {
    if (!selectedLocation) {
      throw new Error(
        "Please select a location under the chat or in the map before asking the AI.",
      );
    }

    var payload = {
      messages: getRecentMessages().concat([
        { role: "user", content: userMessage },
      ]),
      location: {
        name: selectedLocation.name,
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
      },
    };

    var response = await fetch("/api/ai-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      var errorBody = await response.json().catch(function () {
        return { error: "Unknown error" };
      });
      throw new Error(errorBody.error || "AI request failed.");
    }

    var result = await response.json();
    return result.answer;
  }

  /**
   * Added by @Markus
   *
   * handles user message submission lifecycle.
   *
   * @param {string} messageText
   *
   * AI-generated.
   * Sprint 3 Popup Challenge.
   */
  async function sendUserMessage(messageText) {
    if (!messageText || !messageText.trim()) return;
    if (isSending) return;

    isSending = true;
    updateHistory("user", messageText.trim());
    inputEl.value = "";
    renderMessages();

    try {
      var answer = await callAiApi(messageText.trim());
      updateHistory(
        "assistant",
        answer || "Sorry, I could not generate a response.",
      );
    } catch (err) {
      updateHistory("assistant", "Error: " + err.message);
    } finally {
      isSending = false;
      renderMessages();
    }
  }

  /**
   * Added by @Markus
   *
   * renders quick selectable locations from mock dataset.
   *
   * AI-generated.
   * Sprint 3 Popup Challenge.
   */
  function renderQuickLocations() {
    if (!quickLocationsEl || typeof MOCK_MAP_LOCATIONS === "undefined") return;

    quickLocationsEl.textContent = "";

    MOCK_MAP_LOCATIONS.forEach(function (spot) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "ai-quick-location-btn";
      button.textContent = spot.name;

      button.addEventListener("click", async function () {
        setSelectedLocation({
          name: spot.name,
          lat: spot.lat,
          lng: spot.lng,
        });

        try {
          await fetchLocationRisk(spot.lat, spot.lng);
          updateHistory(
            "assistant",
            "Location details loaded. Ask a question about this place.",
          );
        } catch (err) {
          updateHistory(
            "assistant",
            "Error loading location details: " + err.message,
          );
        }
      });

      quickLocationsEl.appendChild(button);
    });
  }

  /**
   * Added by @Markus
   *
   * clears chat history and updates UI.
   *
   * AI-generated.
   * Sprint 3 Popup Challenge.
   */
  function resetChat() {
    chatHistory = [];
    saveHistory();
    renderMessages();
  }

  /**
   * Added by @Markus
   *
   * parses location parameters from URL query string.
   *
   * @returns {Object|null}
   *
   * AI-generated.
   * Sprint 3 Popup Challenge.
   */
  function parseLocationFromQuery() {
    var search = window.location.search;
    if (!search) return null;

    var params = new URLSearchParams(search);
    var lat = parseFloat(params.get("lat"));
    var lng = parseFloat(params.get("lng"));
    var name = params.get("name");
    var initialAction = params.get("initialAction");

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      lat: lat,
      lng: lng,
      name: name
        ? decodeURIComponent(name)
        : "Custom Selected Vancouver location",
      initialAction: initialAction,
    };
  }

  /**
   * Added by @Markus
   *
   * initializes the page state and loads data.
   *
   * AI-generated.
   * Sprint 3 Popup Challenge.
   */
  async function initPage() {
    loadHistory();
    renderMessages();
    renderQuickLocations();

    var queryLocation = parseLocationFromQuery();
    if (queryLocation) {
      setSelectedLocation({
        name: queryLocation.name,
        lat: queryLocation.lat,
        lng: queryLocation.lng,
      });

      try {
        await fetchLocationRisk(queryLocation.lat, queryLocation.lng);
      } catch (err) {
        updateHistory(
          "assistant",
          "Unable to load selected location details: " + err.message,
        );
      }
    }
  }

  if (formEl) {
    formEl.addEventListener("submit", function (event) {
      event.preventDefault();
      sendUserMessage(inputEl.value);
    });
  }

  if (inputEl) {
    inputEl.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendUserMessage(inputEl.value);
      }
    });
  }

  if (resetEl) {
    resetEl.addEventListener("click", function () {
      resetChat();
    });
  }

  setSelectedLocation(null);
  initPage();
})();

/**
 * Added by @Markus
 *
 * handles visibility and persistence of the AI chat hero banner.
 *
 * AI-generated.
 * Sprint 3 Popup Challenge.
 */
const hero = document.querySelector(".ai-chat-hero");
const closeBtn = document.getElementById("aiHeroClose");

const HERO_KEY = "aiHeroClosed";

/**
 * hides the hero section and stores preference in localStorage
 */
function hideHero() {
  if (!hero) return;
  hero.style.display = "none";
  localStorage.setItem(HERO_KEY, "true");
}

/**
 * initializes hero visibility based on saved preference
 */
function initHero() {
  if (localStorage.getItem(HERO_KEY) === "true") {
    hero.style.display = "none";
  }

  closeBtn?.addEventListener("click", hideHero);
}

initHero();