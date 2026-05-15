/**
 * Added by @Edward
 *
 * Loads the Me page profile summary from the user-center backend API.
 * Displays the saved profile photo after the Profile page uploads it.
 */

document.addEventListener("DOMContentLoaded", () => {
  const displayNameEl = document.getElementById("meDisplayName");
  const usernameEl = document.getElementById("meUsername");
  const roleEl = document.getElementById("meRole");
  const avatarEl = document.querySelector(".profile-avatar");

  async function requestJson(url) {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
    });

    let data = {};

    try {
      data = await response.json();
    } catch (err) {
      data = {};
    }

    if (!response.ok) {
      const error = new Error(data.message || "Request failed.");
      error.status = response.status;
      throw error;
    }

    return data;
  }

  /*
   * Added by @Edward
   *
   * Shows the saved avatar on the Me page after it is uploaded from Profile.
   * If no avatar is saved yet, the profile circle falls back to SS.
   */
  function renderAvatar(avatarUrl) {
    if (!avatarEl) return;

    avatarEl.innerHTML = "";

    if (!avatarUrl) {
      avatarEl.textContent = "SS";
      return;
    }

    const img = document.createElement("img");
    img.src = avatarUrl;
    img.alt = "Profile photo";
    avatarEl.appendChild(img);
  }

  function applyDisplayPreferences(preferences) {
    if (!preferences) return;

    document.body.dataset.theme = preferences.theme || "light";
    document.body.dataset.accent = preferences.accentColor || "green";
  }

  function applyUserData(userData) {
    const profile = userData.profile || {};
    const preferences = userData.preferences || {};
    const displayName = profile.displayName || userData.username || "Guest User";
    const role = profile.role || "ShadeSafe User";

    if (displayNameEl) displayNameEl.textContent = displayName;
    if (usernameEl) usernameEl.textContent = userData.username ? "@" + userData.username : "";
    if (roleEl) roleEl.textContent = role;

    renderAvatar(profile.avatarUrl || "");
    applyDisplayPreferences(preferences);
  }

  async function loadMePage() {
    try {
      const userData = await requestJson("/api/me");
      applyUserData(userData);
    } catch (err) {
      if (err.status === 401 && usernameEl) {
        usernameEl.textContent = "Log in to load your profile.";
      }
    }
  }

  loadMePage();
});
