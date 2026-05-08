document.addEventListener("DOMContentLoaded", () => {
  const settingControls = document.querySelectorAll("[data-setting]");
  const resetButton = document.getElementById("resetPreferencesBtn");

  settingControls.forEach((control) => {
    const settingKey = `shadeSafe.${control.dataset.setting}`;
    const savedValue = localStorage.getItem(settingKey);

    if (savedValue !== null) {
      control.value = savedValue;
    }

    control.addEventListener("change", () => {
      localStorage.setItem(settingKey, control.value);
      applyDisplayPreferences();
    });
  });

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      localStorage.removeItem("shadeSafe.theme");
      localStorage.removeItem("shadeSafe.accentColor");
      localStorage.removeItem("shadeSafe.profile");

      settingControls.forEach((control) => {
        if (control.dataset.setting === "theme") {
          control.value = "light";
        }

        if (control.dataset.setting === "accentColor") {
          control.value = "green";
        }
      });

      applyDisplayPreferences();
    });
  }

  applyDisplayPreferences();
});

function applyDisplayPreferences() {
  const theme = localStorage.getItem("shadeSafe.theme") || "light";
  const accentColor = localStorage.getItem("shadeSafe.accentColor") || "green";

  document.body.dataset.theme = theme;
  document.body.dataset.accent = accentColor;
}