import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "..", "dist");
const indexPath = path.join(dist, "index.html");

if (!fs.existsSync(indexPath)) {
  throw new Error("CareBridge performance budget requires a production build. Run npm run build first.");
}

const html = fs.readFileSync(indexPath, "utf8");
const assetPath = (pattern, label) => {
  const match = html.match(pattern);
  if (!match?.[1]) throw new Error(`Could not find the ${label} entry asset in dist/index.html.`);
  return path.join(dist, match[1].replace(/^\//, ""));
};

const entryJs = assetPath(/<script[^>]+src=["']([^"']+\.js)["']/i, "JavaScript");
const entryCss = assetPath(/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/i, "CSS");
const assetsDir = path.join(dist, "assets");
const jsFiles = fs.readdirSync(assetsDir).filter((name) => name.endsWith(".js")).map((name) => path.join(assetsDir, name));

const bytes = (file) => fs.statSync(file).size;
const gzipBytes = (file) => zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length;
const kb = (value) => Number((value / 1024).toFixed(1));

const metrics = {
  entryJsRawKb: kb(bytes(entryJs)),
  entryJsGzipKb: kb(gzipBytes(entryJs)),
  cssRawKb: kb(bytes(entryCss)),
  cssGzipKb: kb(gzipBytes(entryCss)),
  largestLazyChunkKb: kb(Math.max(...jsFiles.filter((file) => file !== entryJs).map(bytes), 0)),
  totalJsRawKb: kb(jsFiles.reduce((sum, file) => sum + bytes(file), 0)),
};

const limits = {
  entryJsRawKb: Number(process.env.CB_BUDGET_ENTRY_JS_KB || 380),
  entryJsGzipKb: Number(process.env.CB_BUDGET_ENTRY_JS_GZIP_KB || 120),
  cssRawKb: Number(process.env.CB_BUDGET_CSS_KB || 500),
  cssGzipKb: Number(process.env.CB_BUDGET_CSS_GZIP_KB || 85),
  largestLazyChunkKb: Number(process.env.CB_BUDGET_LAZY_CHUNK_KB || 90),
  totalJsRawKb: Number(process.env.CB_BUDGET_TOTAL_JS_KB || 700),
};

let failed = false;
for (const [key, value] of Object.entries(metrics)) {
  const limit = limits[key];
  const ok = value <= limit;
  console.log(`${ok ? "✓" : "✗"} ${key}: ${value} KB / ${limit} KB`);
  if (!ok) failed = true;
}

if (failed) {
  throw new Error("CareBridge client performance budget exceeded. Optimize the regression before release.");
}

console.log("CareBridge client performance budget passed.");
