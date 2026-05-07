/**
 * Alerts page entry (alert.html).
 * Page-specific logic will go here.
 */

/**
 * Added @author Eric Guo
 * Reloads the Alerts page when the user clicks
 * the "Check Again Now" button.
 */

const checkButton = document.querySelector(".alerts-check-btn");

if (checkButton) {
  checkButton.addEventListener("click", function () {
    location.reload();
  });
}
