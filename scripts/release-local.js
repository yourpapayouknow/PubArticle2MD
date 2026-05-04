const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, "dist-desktop");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    ...options
  });

  if (result.status !== 0) {
    const text = `${command} ${args.join(" ")}`;
    throw new Error(`Command failed: ${text}`);
  }
}

function runCapture(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8"
  });

  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  let tag = "";
  let prerelease = false;

  for (let i = 0; i < args.length; i += 1) {
    const value = args[i];
    if (value === "--tag" && args[i + 1]) {
      tag = String(args[i + 1]).trim();
      i += 1;
      continue;
    }
    if (value === "--prerelease") {
      prerelease = true;
      continue;
    }
    if (!value.startsWith("--") && !tag) {
      tag = value.trim();
    }
  }

  if (!tag) {
    throw new Error("Missing tag. Usage: npm run release:local -- --tag v0.2.0 [--prerelease]");
  }

  return { tag, prerelease };
}

function ensureGhCli() {
  const check = runCapture("gh", ["--version"]);
  if (check.status !== 0) {
    throw new Error("GitHub CLI (gh) is required. Please install it and run `gh auth login` first.");
  }
}

function listExeFiles() {
  if (!fs.existsSync(DIST_DIR)) {
    return [];
  }

  return fs
    .readdirSync(DIST_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".exe"))
    .map((entry) => path.join(DIST_DIR, entry.name));
}

function releaseExists(tag) {
  const check = runCapture("gh", ["release", "view", tag]);
  return check.status === 0;
}

function main() {
  const { tag, prerelease } = parseArgs();
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

  ensureGhCli();
  run(npmCommand, ["run", "desktop:dist"]);

  const exes = listExeFiles();
  if (exes.length === 0) {
    throw new Error("No EXE found under dist-desktop/. Build may have failed.");
  }

  if (releaseExists(tag)) {
    process.stdout.write(`[release] Release ${tag} exists. Uploading assets with --clobber...\n`);
    run("gh", ["release", "upload", tag, ...exes, "--clobber"]);
  } else {
    process.stdout.write(`[release] Creating release ${tag}...\n`);
    const args = ["release", "create", tag, ...exes, "--generate-notes"];
    if (prerelease) {
      args.push("--prerelease");
    }
    run("gh", args);
  }

  process.stdout.write(`[release] Done: ${tag}\n`);
}

main();
