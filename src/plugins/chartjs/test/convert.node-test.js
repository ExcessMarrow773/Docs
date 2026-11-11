const test = require("node:test");
const assert = require("node:assert/strict");
const { convertChartBlock, convertRawBlock, sanitizeSize } = require("../lib/convert");

test("bar chart with labels and series", () => {
  const r = convertChartBlock(`
type: bar
labels: [Mon, Tue]
series:
  - title: Sales
    data: [1, 2]
  - title: Returns
    data: [3, 4]
`);
  assert.equal(r.error, undefined);
  assert.equal(r.config.type, "bar");
  assert.deepEqual(r.config.data.labels, ["Mon", "Tue"]);
  assert.equal(r.config.data.datasets.length, 2);
  assert.equal(r.config.data.datasets[0].label, "Sales");
  assert.deepEqual(r.config.data.datasets[1].data, [3, 4]);
  assert.equal(r.width, "100%");
  assert.equal(r.height, undefined);
});

test("type defaults to bar", () => {
  const r = convertChartBlock("labels: [a]\nseries:\n  - data: [1]");
  assert.equal(r.config.type, "bar");
  assert.equal(r.config.data.datasets[0].label, "");
});

test("axis options map to scales", () => {
  const r = convertChartBlock(`
type: line
labels: [a, b]
series:
  - data: [1, 2]
beginAtZero: true
stacked: true
xTitle: Day
yTitle: Count
yMin: 0
yMax: 10
xReverse: true
indexAxis: y
spanGaps: true
tension: 0.4
legend: false
legendPosition: bottom
`);
  const o = r.config.options;
  assert.equal(o.scales.y.beginAtZero, true);
  assert.equal(o.scales.x.stacked, true);
  assert.equal(o.scales.y.stacked, true);
  assert.deepEqual(o.scales.x.title, { display: true, text: "Day" });
  assert.deepEqual(o.scales.y.title, { display: true, text: "Count" });
  assert.equal(o.scales.y.min, 0);
  assert.equal(o.scales.y.max, 10);
  assert.equal(o.scales.x.reverse, true);
  assert.equal(o.indexAxis, "y");
  assert.equal(o.spanGaps, true);
  assert.equal(r.config.data.datasets[0].tension, 0.4);
  assert.equal(o.plugins.legend.display, false);
  assert.equal(o.plugins.legend.position, "bottom");
});

test("fill: stacked fills to origin then previous dataset", () => {
  const r = convertChartBlock(`
type: line
labels: [a]
series:
  - data: [1]
  - data: [2]
fill: true
stacked: true
`);
  assert.equal(r.config.data.datasets[0].fill, "origin");
  assert.equal(r.config.data.datasets[1].fill, "-1");
  const r2 = convertChartBlock("type: line\nlabels: [a]\nseries:\n  - data: [1]\nfill: true");
  assert.equal(r2.config.data.datasets[0].fill, true);
});

test("radar and polarArea use the r scale", () => {
  const r = convertChartBlock("type: radar\nlabels: [a]\nseries:\n  - data: [1]\nbeginAtZero: true");
  assert.equal(r.config.options.scales.r.beginAtZero, true);
  assert.equal(r.config.options.scales.y, undefined);
});

test("width and height are sanitized", () => {
  assert.equal(sanitizeSize("80%"), "80%");
  assert.equal(sanitizeSize("300px"), "300px");
  assert.equal(sanitizeSize(400), "400px");
  assert.equal(sanitizeSize("10em"), "10em");
  assert.equal(sanitizeSize("expression(alert(1))"), undefined);
  assert.equal(sanitizeSize("80%;color:red"), undefined);
  const r = convertChartBlock("type: pie\nlabels: [a]\nseries:\n  - data: [1]\nwidth: 50%\nheight: 200px");
  assert.equal(r.width, "50%");
  assert.equal(r.height, "200px");
});

test("meta carries client-side hints", () => {
  const r = convertChartBlock("type: bar\nlabels: [a]\nseries:\n  - data: [1]\nlabelColors: true\ntransparency: 0.5\ntextColor: red");
  assert.deepEqual(r.meta, { labelColors: true, transparency: 0.5, textColor: "red" });
});

test("extra series keys pass through to the dataset", () => {
  const r = convertChartBlock("type: bar\nlabels: [a]\nseries:\n  - title: x\n    data: [1]\n    backgroundColor: '#123456'\n    yAxisID: y2");
  assert.equal(r.config.data.datasets[0].backgroundColor, "#123456");
  assert.equal(r.config.data.datasets[0].yAxisID, "y2");
});

test("unsupported keys are reported", () => {
  const r = convertChartBlock("type: bar\nlabels: [a]\nseries:\n  - data: [1]\nid: table1\nbestFit: true\ntime: month");
  assert.deepEqual(r.unsupported.sort(), ["bestFit", "id", "time"]);
  assert.equal(r.config.options.scales?.x?.type, undefined);
});

test("invalid yaml and non-object input return an error", () => {
  assert.match(convertChartBlock("type: [unclosed").error, /.+/);
  assert.match(convertChartBlock("just a string").error, /.+/);
  assert.match(convertChartBlock("").error, /.+/);
  assert.match(convertChartBlock("type: bar").error, /series/);
});

test("raw chartjs block: JSON or YAML config passes through", () => {
  const json = convertRawBlock('{"type":"line","data":{"labels":["a"],"datasets":[{"data":[1]}]},"width":"40%"}');
  assert.equal(json.config.type, "line");
  assert.equal(json.config.width, undefined);
  assert.equal(json.width, "40%");
  const yaml = convertRawBlock("type: doughnut\ndata:\n  labels: [a, b]\n  datasets:\n    - data: [1, 2]\noptions:\n  cutout: 70%");
  assert.equal(yaml.config.options.cutout, "70%");
  assert.match(convertRawBlock("data: {}").error, /type/);
  assert.match(convertRawBlock("{").error, /.+/);
});
