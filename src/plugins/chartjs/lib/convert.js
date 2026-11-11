// Converts a ```chart block (Obsidian Charts YAML) or a ```chartjs block
// (raw Chart.js config in JSON/YAML) into a plain Chart.js configuration.
// Runs at build time in Node; no Chart.js needed here. Colors, fonts and
// theme are applied in the browser by assets/chartjs.js.

const YAML = require("yaml");

const SIZE_RE = /^\d+(\.\d+)?(px|%|em|rem|vw|vh)$/;

// Only allow plain CSS lengths so the value can be inlined into a style attribute.
function sanitizeSize(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number" && isFinite(value) && value > 0) return `${value}px`;
  const s = String(value).trim();
  return SIZE_RE.test(s) ? s : undefined;
}

function parseYaml(source) {
  try {
    return { value: YAML.parse(source) };
  } catch (e) {
    return { error: e && e.message ? e.message : String(e) };
  }
}

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// Keys from Obsidian Charts that need something we cannot ship
// (a regression helper, a date adapter, table lookup). Reported so the
// build log can mention them.
const UNSUPPORTED = ["id", "bestFit", "bestFitLineColor", "bestFitTitle", "bestFitNumber", "time"];

function setPath(obj, path, value) {
  if (value === undefined) return;
  const keys = path.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!isObject(cur[keys[i]])) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

function convertChartBlock(source) {
  const parsed = parseYaml(source || "");
  if (parsed.error) return { error: `invalid YAML: ${parsed.error}` };
  const y = parsed.value;
  if (!isObject(y)) return { error: "chart block must be a YAML mapping" };
  if (!Array.isArray(y.series) || y.series.length === 0) {
    return { error: "chart block needs a non-empty `series` list" };
  }

  const type = typeof y.type === "string" && y.type ? y.type : "bar";
  const cartesian = !["radar", "polarArea", "pie", "doughnut"].includes(type);
  const radial = type === "radar" || type === "polarArea";
  const stacked = y.stacked === true;

  const datasets = y.series.map((item, i) => {
    const s = isObject(item) ? item : { data: item };
    const { title, ...rest } = s;
    let fill;
    if (y.fill === true) fill = stacked ? (i === 0 ? "origin" : "-1") : true;
    return {
      label: title === undefined || title === null ? "" : String(title),
      borderWidth: type === "line" || type === "radar" || !cartesian ? 2 : 1,
      tension: typeof y.tension === "number" ? y.tension : 0,
      ...(fill !== undefined ? { fill } : {}),
      ...rest,
    };
  });

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: y.legend !== false,
        position: typeof y.legendPosition === "string" ? y.legendPosition : "top",
      },
    },
  };
  if (y.spanGaps !== undefined) options.spanGaps = y.spanGaps;
  if (typeof y.indexAxis === "string") options.indexAxis = y.indexAxis;
  if (y.padding !== undefined) setPath(options, "layout.padding", y.padding);

  if (cartesian) {
    setPath(options, "scales.y.beginAtZero", y.beginAtZero);
    if (stacked) {
      setPath(options, "scales.x.stacked", true);
      setPath(options, "scales.y.stacked", true);
    }
    for (const axis of ["x", "y"]) {
      setPath(options, `scales.${axis}.min`, y[`${axis}Min`]);
      setPath(options, `scales.${axis}.max`, y[`${axis}Max`]);
      setPath(options, `scales.${axis}.reverse`, y[`${axis}Reverse`]);
      setPath(options, `scales.${axis}.display`, y[`${axis}Display`]);
      setPath(options, `scales.${axis}.ticks.display`, y[`${axis}TickDisplay`]);
      setPath(options, `scales.${axis}.ticks.padding`, y[`${axis}TickPadding`]);
      if (y[`${axis}Title`] !== undefined) {
        setPath(options, `scales.${axis}.title`, { display: true, text: String(y[`${axis}Title`]) });
      }
    }
  } else if (radial) {
    setPath(options, "scales.r.beginAtZero", y.beginAtZero);
  }

  const meta = {};
  if (y.labelColors === true) meta.labelColors = true;
  if (typeof y.transparency === "number") meta.transparency = y.transparency;
  if (typeof y.textColor === "string") meta.textColor = y.textColor;

  return {
    config: { type, data: { labels: Array.isArray(y.labels) ? y.labels : [], datasets }, options },
    meta,
    width: sanitizeSize(y.width) || "100%",
    height: sanitizeSize(y.height),
    unsupported: UNSUPPORTED.filter((k) => y[k] !== undefined),
  };
}

function convertRawBlock(source) {
  const parsed = parseYaml(source || "");
  if (parsed.error) return { error: `invalid JSON/YAML: ${parsed.error}` };
  const c = parsed.value;
  if (!isObject(c)) return { error: "chartjs block must be an object" };
  if (typeof c.type !== "string" || !c.type) return { error: "chartjs block needs a `type`" };
  const { width, height, ...config } = c;
  return {
    config,
    meta: {},
    width: sanitizeSize(width) || "100%",
    height: sanitizeSize(height),
    unsupported: [],
  };
}

module.exports = { convertChartBlock, convertRawBlock, sanitizeSize };
