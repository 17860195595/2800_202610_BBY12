document.addEventListener("DOMContentLoaded", () => {
  const settingControls = document.querySelectorAll("[data-setting]");

  settingControls.forEach((control) => {
    const settingKey = `shadeSafe.${control.dataset.setting}`;
    const savedValue = localStorage.getItem(settingKey);

    if (savedValue !== null) {
      if (control.type === "checkbox") {
        control.checked = savedValue === "true";
      } else {
        control.value = savedValue;
      }
    }

    control.addEventListener("change", () => {
      if (control.type === "checkbox") {
        localStorage.setItem(settingKey, control.checked);
      } else {
        localStorage.setItem(settingKey, control.value);
      }

      applyVisualPreferences();
    });
  });

  applyVisualPreferences();
});

function applyVisualPreferences() {
  const theme = localStorage.getItem("shadeSafe.theme") || "light";
  const accentColor = localStorage.getItem("shadeSafe.accentColor") || "green";

  document.body.dataset.theme = theme;
  document.body.dataset.accent = accentColor;
}