document.addEventListener("DOMContentLoaded", function () {
  var html = document.documentElement;
  var themeBtn = document.getElementById("themeToggle");
  var iconMoon = document.getElementById("iconMoon");
  var iconSun = document.getElementById("iconSun");
  if (!themeBtn) return;

  var dark = localStorage.getItem("li-theme") === "dark";
  applyTheme();

  themeBtn.addEventListener("click", function () {
    dark = !dark;
    localStorage.setItem("li-theme", dark ? "dark" : "light");
    applyTheme();
  });

  function applyTheme() {
    html.setAttribute("data-theme", dark ? "dark" : "light");
    if (iconMoon) iconMoon.style.display = dark ? "none" : "";
    if (iconSun) iconSun.style.display = dark ? "" : "none";
  }
});
