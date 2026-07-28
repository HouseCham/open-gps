// Pre-paint theme apply — prevents FOUC between page load and React mount.
// Source priority: localStorage > system pref > light.
// Include in the root layout <head> BEFORE any rendered content.
//
// In Astro:
//   <script is:inline>{themeInitSource}</script>
//   or
//   <script is:inline src="/src/scripts/theme-init.js"></script>

(function () {
    try {
        var saved = localStorage.getItem('opengps-theme');
        var sysDark =
            window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: dark)').matches;
        var t =
            saved === 'dark' || saved === 'light'
                ? saved
                : sysDark
                  ? 'dark'
                  : 'light';
        document.documentElement.setAttribute('data-theme', t);
    } catch (e) {
        document.documentElement.setAttribute('data-theme', 'light');
    }
})();
