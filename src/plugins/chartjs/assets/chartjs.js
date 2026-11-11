// Renders every <canvas data-chartjs> on the page with Chart.js. The library
// (vendored next to this file) is only fetched when the page has a chart.
(function () {
  "use strict";

  var canvases = document.querySelectorAll("canvas[data-chartjs]");
  if (!canvases.length) return;

  var LIB = "/plugins/chartjs/assets/chart.umd.js";
  var LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
  var DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
  var FILL_TYPES = { pie: 1, doughnut: 1, polarArea: 1 };
  var charts = [];

  function isDark() {
    var cls = document.body.classList;
    if (cls.contains("theme-dark")) return true;
    if (cls.contains("theme-light")) return false;
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.body).getPropertyValue(name).trim();
    return v || fallback;
  }

  function withAlpha(hex, alpha) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + alpha + ")";
  }

  function paletteFor(canvas) {
    var custom = canvas.getAttribute("data-chartjs-palette");
    if (custom) {
      var list = custom.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      if (list.length) return list;
    }
    return isDark() ? DARK : LIGHT;
  }

  function parse(attr) {
    try { return JSON.parse(attr || "{}"); } catch (e) { return null; }
  }

  function colorize(config, meta, palette) {
    var type = config.type;
    var alpha = typeof meta.transparency === "number" ? meta.transparency : (type === "line" || type === "radar" ? 0.2 : 0.85);
    var datasets = (config.data && config.data.datasets) || [];
    datasets.forEach(function (ds, i) {
      var perPoint = FILL_TYPES[type] || meta.labelColors === true;
      var dsType = ds.type || type;
      var dsAlpha = dsType === "line" || dsType === "radar" ? Math.min(alpha, 0.2) : alpha;
      if (perPoint) {
        var n = Array.isArray(ds.data) ? ds.data.length : 0;
        var bg = [], border = [];
        for (var j = 0; j < n; j++) {
          bg.push(withAlpha(palette[j % palette.length], alpha));
          border.push(palette[j % palette.length]);
        }
        if (ds.backgroundColor === undefined) ds.backgroundColor = bg;
        // Arcs get a gap in the page's surface color; bars/points keep their own hue.
        if (ds.borderColor === undefined) ds.borderColor = FILL_TYPES[type] ? surfaceColor() : border;
      } else {
        var c = palette[i % palette.length];
        if (ds.backgroundColor === undefined) ds.backgroundColor = withAlpha(c, dsAlpha);
        if (ds.borderColor === undefined) ds.borderColor = c;
      }
      if (dsType === "bar" && ds.borderRadius === undefined) ds.borderRadius = 4;
      if ((dsType === "line" || dsType === "radar") && ds.pointRadius === undefined) ds.pointRadius = 3;
    });
    return config;
  }

  function surfaceColor() {
    return cssVar("--background-primary", isDark() ? "#1e1e1e" : "#ffffff");
  }

  function applyTheme(Chart) {
    Chart.defaults.color = cssVar("--text-muted", isDark() ? "#aaa" : "#666");
    // Radial tick labels default to a white backdrop, which shows as boxes on dark themes.
    Chart.defaults.scales.radialLinear.ticks.backdropColor = "transparent";
    Chart.defaults.borderColor = cssVar("--background-modifier-border", isDark() ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)");
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily || Chart.defaults.font.family;
  }

  function render(Chart) {
    charts.forEach(function (c) { c.destroy(); });
    charts = [];
    applyTheme(Chart);
    Array.prototype.forEach.call(canvases, function (canvas) {
      var config = parse(canvas.getAttribute("data-chartjs"));
      var meta = parse(canvas.getAttribute("data-chartjs-meta")) || {};
      if (!config || !config.type) return;
      var wrapper = canvas.parentElement;
      if (wrapper && wrapper.style.height) {
        config.options = config.options || {};
        config.options.maintainAspectRatio = false;
      }
      if (meta.textColor) {
        config.options = config.options || {};
        config.options.color = meta.textColor;
      }
      try {
        charts.push(new Chart(canvas, colorize(config, meta, paletteFor(canvas))));
      } catch (e) {
        console.warn("[chartjs] could not render chart:", e);
        if (wrapper) wrapper.classList.add("chartjs-chart--error");
      }
    });
  }

  function watchTheme(Chart) {
    var timer;
    var rerender = function () { clearTimeout(timer); timer = setTimeout(function () { render(Chart); }, 50); };
    new MutationObserver(rerender).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    new MutationObserver(rerender).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.addEventListener) mq.addEventListener("change", rerender);
    }
  }

  function start() {
    var Chart = window.Chart;
    if (!Chart) { console.warn("[chartjs] Chart.js failed to load"); return; }
    render(Chart);
    watchTheme(Chart);
  }

  if (window.Chart) {
    start();
  } else {
    var s = document.createElement("script");
    s.src = LIB;
    s.onload = start;
    s.onerror = function () { console.warn("[chartjs] could not load " + LIB); };
    document.head.appendChild(s);
  }
})();
