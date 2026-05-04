const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = process.cwd();
const TARGET_DIRS = ["server", "scripts", "public"];

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "outputs" || entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}

const jsFiles = TARGET_DIRS.flatMap((dir) => {
  const absolute = path.join(ROOT, dir);
  if (!fs.existsSync(absolute)) {
    return [];
  }
  return walk(absolute, []);
});

let hasError = false;

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "pipe",
    encoding: "utf8"
  });

  if (result.status !== 0) {
    hasError = true;
    process.stdout.write(`\n[lint] Syntax error in ${file}\n`);
    process.stdout.write(result.stderr || result.stdout);
  }
}

if (hasError) {
  process.exitCode = 1;
} else {
  console.log(`[lint] Checked ${jsFiles.length} JS files.`);
}
