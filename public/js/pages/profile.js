document.addEventListener("DOMContentLoaded", () => {
  const avatarInput = document.getElementById("avatarInput");
  const avatarPreview = document.getElementById("avatarPreview");

  if (!avatarInput || !avatarPreview) {
    return;
  }

  avatarInput.addEventListener("change", () => {
    const file = avatarInput.files[0];

    if (!file) {
      return;
    }

    const imageUrl = URL.createObjectURL(file);

    avatarPreview.innerHTML = `<img src="${imageUrl}" alt="Profile photo preview" />`;
  });
});