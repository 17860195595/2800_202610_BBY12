/**
 * Added by @Edward
 *
 * Connects the Profile page to the user-center backend API.
 */

document.addEventListener("DOMContentLoaded", () => {
  const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;
  const AVATAR_CANVAS_SIZE = 256;
  const AVATAR_JPEG_QUALITY = 0.86;

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

  function renderAvatar(avatarUrl) {
    renderAvatarIn(avatarPreview, avatarUrl, "Profile photo preview");
    renderAvatarIn(profileCardAvatar, avatarUrl, "Profile photo");
  }

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

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", () => reject(new Error("Photo could not be loaded.")));
      image.src = dataUrl;
    });
  }

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
