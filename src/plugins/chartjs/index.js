// Build hook: turns ```chart and ```chartjs fences into a <canvas> carrying
// the Chart.js config as JSON. Rendering happens in assets/chartjs.js.
const path = require("path");
const { convertChartBlock, convertRawBlock } = require(path.join(__dirname, "lib/convert.js"));

const FENCES = { chart: convertChartBlock, chartjs: convertRawBlock };

module.exports = {
  setupMarkdown(md, context) {
    const settings = (context && context.settings) || {};
    const original =
      md.renderer.rules.fence ||
      ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options, env, self));

    md.renderer.rules.fence = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      const lang = (token.info || "").trim().split(/\s+/)[0];
      const convert = FENCES[lang];
      if (!convert) return original(tokens, idx, options, env, self);

      const result = convert(token.content);
      if (result.error) {
        console.warn(`[chartjs] skipped a \`\`\`${lang} block: ${result.error}`);
        return original(tokens, idx, options, env, self);
      }
      if (result.unsupported.length) {
        console.warn(`[chartjs] ignoring unsupported key(s) in a \`\`\`chart block: ${result.unsupported.join(", ")}`);
      }

      const style = [`width:${result.width}`, result.height ? `height:${result.height}` : ""].filter(Boolean).join(";");
      const esc = md.utils.escapeHtml;
      const attrs = [
        `data-chartjs="${esc(JSON.stringify(result.config))}"`,
        `data-chartjs-meta="${esc(JSON.stringify(result.meta))}"`,
      ];
      if (typeof settings.palette === "string" && settings.palette.trim()) {
        attrs.push(`data-chartjs-palette="${esc(settings.palette.trim())}"`);
      }
      return `<div class="chartjs-chart" style="${esc(style)}"><canvas ${attrs.join(" ")}></canvas></div>\n`;
    };
  },
};
