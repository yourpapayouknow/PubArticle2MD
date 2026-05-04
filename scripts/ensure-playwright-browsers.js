const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = process.cwd();
const LOCAL_BROWSERS_DIR = path.join(ROOT, "node_modules", "playwright-core", ".local-browsers");

function hasLocalChromium() {
  if (!fs.existsSync(LOCAL_BROWSERS_DIR)) {
    return false;
  }

  const entries = fs.readdirSync(LOCAL_BROWSERS_DIR, { withFileTypes: true });
  return entries.some((entry) => entry.isDirectory() && entry.name.startsWith("chromium-"));
}

function installChromium() {
  const playwrightCli = require.resolve("playwright/cli");
  const result = spawnSync(process.execPath, [playwrightCli, "install", "chromium"], {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: "0"
    }
  });

  if (result.status !== 0) {
    throw new Error("Playwright Chromium install failed.");
  }
}

function main() {
  if (hasLocalChromium()) {
    process.stdout.write("[desktop] Playwright Chromium already exists in node_modules.\n");
    return;
  }

  process.stdout.write("[desktop] Installing Playwright Chromium into node_modules...\n");
  installChromium();

  if (!hasLocalChromium()) {
    throw new Error("Playwright Chromium was not found after installation.");
  }

  process.stdout.write("[desktop] Playwright Chromium is ready.\n");
}

main();
