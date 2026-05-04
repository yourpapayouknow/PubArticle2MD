const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const TARGET_DIR = path.join(ROOT, "public", "vendor");

const assets = [
  {
    from: path.join(ROOT, "node_modules", "turndown", "dist", "turndown.js"),
    to: path.join(TARGET_DIR, "turndown.js")
  },
  {
    from: path.join(ROOT, "node_modules", "turndown-plugin-gfm", "dist", "turndown-plugin-gfm.js"),
    to: path.join(TARGET_DIR, "turndown-plugin-gfm.js")
  },
  {
    from: path.join(ROOT, "node_modules", "jszip", "dist", "jszip.min.js"),
    to: path.join(TARGET_DIR, "jszip.min.js")
  },
  {
    from: path.join(ROOT, "node_modules", "html2pdf.js", "dist", "html2pdf.bundle.min.js"),
    to: path.join(TARGET_DIR, "html2pdf.bundle.min.js")
  }
];

fs.mkdirSync(TARGET_DIR, { recursive: true });

for (const asset of assets) {
  if (!fs.existsSync(asset.from)) {
    throw new Error(`Missing vendor asset: ${asset.from}`);
  }

  fs.copyFileSync(asset.from, asset.to);
  process.stdout.write(`[vendor] ${path.relative(ROOT, asset.to)}\n`);
}
