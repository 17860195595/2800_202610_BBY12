/**
 * Added by @Edward
 *
 * Connects the Profile page to the user-center backend API.
 * Handles profile photo upload by resizing the selected image in the browser,
 * previewing it on the page, and saving the image data to MongoDB through
 * PATCH /api/me/profile.
 */

document.addEventListener("DOMContentLoaded", () => {
  /*
   * Added by @Edward
   *
   * Limits and normalizes uploaded profile photos before saving them.
   * The app stores a compact 256px JPEG data URL instead of the full file.
   */
  const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;
  const AVATAR_CANVAS_SIZE = 256;
  const AVATAR_JPEG_QUALITY = 0.86;

  /*
   * Added by @Edward
   *
   * Collects Profile page form controls and avatar preview targets.
   * These ids connect profile.html to the save and preview logic below.
   */
  const displayNameInput = document.getElementById("profileDisplayNameInput");
  const roleInput = document.getElementById("profileRoleInput");
  const emailInput = document.getElementById("profileEmailInput");
  const bioInput = document.getElementById("profileBioInput");
  const avatarInput = document.getElementById("avatarInput");
  const avatarPreview = document.getElementById("avatarPreview");
  const profileCardAvatar = document.getElementById("profileCardAvatar");
  const saveButton = document.getElementById("saveProfileBtn");
  const saveStatus = document.getElementById("profileSaveStatus");
  const profileCardName = document.getElementById("profileCardName");
  const profileCardMeta = document.querySelector(".profile-card p");

  /*
   * Added by @Edward
   *
   * Tracks the currently saved avatar and a newly selected avatar.
   * The pending avatar is only written to the database when Save Profile runs.
   */
  let currentAvatarUrl = "";
  let pendingAvatarDataUrl = "";
  let isPreparingAvatar = false;

  function setStatus(message, isError) {
    if (!saveStatus) return;

    saveStatus.textContent = message;
    saveStatus.dataset.state = isError ? "error" : "success";
  }

  function setSaveButtonDisabled(isDisabled) {
    if (!saveButton) return;

    saveButton.disabled = isDisabled;
  }

  async function requestJson(url, options) {
    const requestOptions = Object.assign(
      {
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
      },
      options || {}
    );

    const response = await fetch(url, requestOptions);
    let data = {};

    try {
      data = await response.json();
    } catch (err) {
      data = {};
    }

    if (!response.ok) {
      const error = new Error(data.message || "Request failed.");
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  /*
   * Added by @Edward
   *
   * Renders either the saved profile photo or the SS fallback in one avatar box.
   * The error handler protects the layout if an image URL cannot load.
   */
  function renderAvatarIn(container, avatarUrl, altText) {
    if (!container) return;

    container.innerHTML = "";

    if (!avatarUrl) {
      container.textContent = "SS";
      return;
    }

    const img = document.createElement("img");
    img.src = avatarUrl;
    img.alt = altText;
    img.addEventListener("error", () => {
      container.innerHTML = "";
      container.textContent = "SS";
    });
    container.appendChild(img);
  }

  /*
   * Added by @Edward
   *
   * Keeps the small upload preview and the top profile-card avatar in sync.
   */
  function renderAvatar(avatarUrl) {
    renderAvatarIn(avatarPreview, avatarUrl, "Profile photo preview");
    renderAvatarIn(profileCardAvatar, avatarUrl, "Profile photo");
  }

  /*
   * Added by @Edward
   *
   * Loads backend profile data into the Profile form and avatar previews.
   */
  function applyProfileData(userData) {
    const profile = userData.profile || {};
    const displayName = profile.displayName || userData.username || "Guest User";
    const role = profile.role || "ShadeSafe User";
    const email = userData.email || "";
    const bio = profile.bio || "";

    if (displayNameInput) displayNameInput.value = displayName;
    if (roleInput) roleInput.value = role;
    if (emailInput) emailInput.value = email;
    if (bioInput) bioInput.value = bio;
    if (profileCardName) profileCardName.textContent = displayName;
    if (profileCardMeta) profileCardMeta.textContent = role + " - ShadeSafe Vancouver";

    currentAvatarUrl = profile.avatarUrl || "";
    pendingAvatarDataUrl = "";
    renderAvatar(currentAvatarUrl);
  }

  /*
   * Added by @Edward
   *
   * Reads the selected upload file as a data URL so it can be drawn to canvas.
   */
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.addEventListener("load", () => {
        resolve(String(reader.result || ""));
      });

      reader.addEventListener("error", () => {
        reject(new Error("Photo could not be read."));
      });

      reader.readAsDataURL(file);
    });
  }

  /*
   * Added by @Edward
   *
   * Loads the data URL into an Image object before resizing it.
   */
  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", () => reject(new Error("Photo could not be loaded.")));
      image.src = dataUrl;
    });
  }

  /*
   * Added by @Edward
   *
   * Validates, center-crops, and compresses the selected profile photo.
   * The returned data URL is small enough to send through JSON and store in MongoDB.
   */
  async function createAvatarDataUrl(file) {
    if (!file.type || !file.type.startsWith("image/")) {
      throw new Error("Choose an image file for your profile photo.");
    }

    if (file.size > MAX_AVATAR_FILE_BYTES) {
      throw new Error("Choose a photo smaller than 5 MB.");
    }

    const sourceDataUrl = await readFileAsDataUrl(file);
    const image = await loadImage(sourceDataUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    if (!sourceWidth || !sourceHeight) {
      throw new Error("Photo could not be processed.");
    }

    const cropSize = Math.min(sourceWidth, sourceHeight);
    const cropX = Math.floor((sourceWidth - cropSize) / 2);
    const cropY = Math.floor((sourceHeight - cropSize) / 2);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Photo could not be processed in this browser.");
    }

    canvas.width = AVATAR_CANVAS_SIZE;
    canvas.height = AVATAR_CANVAS_SIZE;
    context.drawImage(
      image,
      cropX,
      cropY,
      cropSize,
      cropSize,
      0,
      0,
      AVATAR_CANVAS_SIZE,
      AVATAR_CANVAS_SIZE
    );

    return canvas.toDataURL("image/jpeg", AVATAR_JPEG_QUALITY);
  }

  /*
   * Added by @Edward
   *
   * Requests the logged-in user's saved profile and fills the Profile page.
   */
  async function loadProfile() {
    try {
      const userData = await requestJson("/api/me");
      applyProfileData(userData);
      setStatus("", false);
    } catch (err) {
      if (err.status === 401) {
        setStatus("Log in to load and save your profile.", true);
        return;
      }

      setStatus("Profile could not be loaded right now.", true);
    }
  }

  /*
   * Added by @Edward
   *
   * Saves editable profile fields and the pending avatar data URL to the backend.
   */
  async function saveProfile() {
    if (!saveButton) return;

    if (isPreparingAvatar) {
      setStatus("Photo is still getting ready.", true);
      return;
    }

    const payload = {
      displayName: displayNameInput ? displayNameInput.value : "",
      role: roleInput ? roleInput.value : "",
      email: emailInput ? emailInput.value : "",
      bio: bioInput ? bioInput.value : "",
    };

    if (pendingAvatarDataUrl) {
      payload.avatarUrl = pendingAvatarDataUrl;
    }

    setSaveButtonDisabled(true);
    setStatus("Saving profile...", false);

    try {
      const updatedUser = await requestJson("/api/me/profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      applyProfileData(updatedUser);
      setStatus("Profile saved.", false);
    } catch (err) {
      const firstError = err.data && err.data.errors && err.data.errors[0];
      setStatus(firstError || "Profile could not be saved.", true);
    } finally {
      setSaveButtonDisabled(false);
    }
  }

  if (avatarInput) {
    /*
     * Added by @Edward
     *
     * Prepares a newly selected avatar immediately, but waits until Save Profile
     * before sending it to MongoDB.
     */
    avatarInput.addEventListener("change", async () => {
      const file = avatarInput.files && avatarInput.files[0];

      if (!file) {
        return;
      }

      isPreparingAvatar = true;
      setSaveButtonDisabled(true);
      setStatus("Preparing photo...", false);

      try {
        pendingAvatarDataUrl = await createAvatarDataUrl(file);
        renderAvatar(pendingAvatarDataUrl);
        setStatus("Photo ready. Save profile to keep it.", false);
      } catch (err) {
        pendingAvatarDataUrl = "";
        avatarInput.value = "";
        renderAvatar(currentAvatarUrl);
        setStatus(err.message || "Photo could not be prepared.", true);
      } finally {
        isPreparingAvatar = false;
        setSaveButtonDisabled(false);
      }
    });
  }

  if (saveButton) {
    saveButton.addEventListener("click", saveProfile);
  }

  loadProfile();
});
