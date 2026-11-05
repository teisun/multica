#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { accessSync, constants, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const extensionId = "tomcat-agent.tomcat-vscode-ext";
const repository = fileURLToPath(new URL("../", import.meta.url));

function executable(file, platform) {
  try {
    if (!statSync(file).isFile()) return false;
    accessSync(file, platform === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function optionalJSON(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw new Error(`Cannot read ${file}: ${error.message}`);
  }
}

function installedBundles(root, platform) {
  const registry = optionalJSON(path.join(root, "extensions.json"), null);
  const obsolete = optionalJSON(path.join(root, ".obsolete"), {});
  let entries;
  if (registry !== null) {
    if (!Array.isArray(registry)) throw new Error(`Invalid extension registry: ${root}`);
    // A registry is authoritative: old upgrade/uninstall directories are not installs.
    entries = registry.filter((entry) => entry.identifier?.id === extensionId).map((entry) => ({
      directory: entry.relativeLocation
        ? path.resolve(root, entry.relativeLocation)
        : entry.location?.fsPath,
      version: entry.version,
    }));
  } else {
    let names;
    try {
      names = readdirSync(root);
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
    entries = names.filter((name) => name.startsWith(`${extensionId}-`))
      .map((name) => ({ directory: path.join(root, name) }));
  }
  const bundles = [];
  for (const entry of entries) {
    if (!entry.directory || obsolete[path.basename(entry.directory)]) continue;
    const manifest = optionalJSON(path.join(entry.directory, "package.json"), null);
    if (!manifest || `${manifest.publisher}.${manifest.name}` !== extensionId) continue;
    const file = path.join(entry.directory, "bin", platform === "win32" ? "tomcat.exe" : "tomcat");
    if (executable(file, platform)) {
      bundles.push({ file, version: String(entry.version ?? manifest.version ?? "0") });
    }
  }
  return bundles.sort((a, b) => b.version.localeCompare(a.version, "en", { numeric: true }));
}

function standaloneCandidates(name, home, env, platform) {
  const key = Object.keys(env).find((key) => key.toUpperCase() === "PATH");
  const filename = platform === "win32" ? `${name}.exe` : name;
  const directories = (env[key] ?? "").split(platform === "win32" ? ";" : ":")
    .map((directory) => directory.replace(/^"(.*)"$/, "$1")).filter(Boolean);
  directories.push(path.join(home, ".local", "bin"), path.join(home, "bin"));
  return [...new Set(directories)].map((directory) => path.resolve(directory, filename));
}

export function discoverTomcat({ home, env, platform, extensionsDir }) {
  const customRoot = extensionsDir || env.VSCODE_EXTENSIONS;
  const roots = customRoot ? [path.resolve(customRoot)] : [
    path.join(home, ".vscode", "extensions"),
    path.join(home, ".vscode-insiders", "extensions"),
  ];
  for (const root of roots) {
    const bundle = installedBundles(root, platform)[0];
    if (bundle) return { file: bundle.file, source: "VS Code extension" };
  }
  const file = standaloneCandidates("tomcat", home, env, platform)
    .find((candidate) => executable(candidate, platform));
  if (file) return { file, source: "standalone CLI" };
  throw new Error("Tomcat not found. Install the Tomcat VS Code extension or standalone CLI; use --extensions-dir for a custom extension directory.");
}

const help = `Usage: node scripts/start-tomcat.mjs [options]

Reuse a saved Multica profile; prefer VS Code's bundled Tomcat, then standalone.
  --profile NAME        Saved profile (default: local-tomcat; use --profile= for unnamed)
  --multica PATH        Multica executable (default: server/bin/multica, then PATH/user bin)
  --extensions-dir DIR  Custom VS Code extensions directory (or VSCODE_EXTENSIONS)
  --dry-run             Locate files and read daemon status only; never start anything
  --help                Show this help

No login, setup, config rewrite, installation, restart or autostart registration.
Run from your own terminal. Starting the daemon lets it claim eligible queued work.
`;

export function main(argv = process.argv.slice(2), {
  env = process.env, home = homedir(), platform = process.platform,
  repoRoot = repository, run = spawnSync, log = console.log,
} = {}) {
  const { values } = parseArgs({ args: argv, options: {
    profile: { type: "string", default: "local-tomcat" },
    multica: { type: "string" },
    "extensions-dir": { type: "string" },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  } });
  if (values.help) { log(help); return; }
  if (env.TOMCAT_AGENT_ACTIVE === "1" && !values["dry-run"]) {
    throw new Error("Run this script in your own terminal, not inside Tomcat Agent. Use --dry-run for read-only inspection.");
  }
  const profile = values.profile;
  const multica = values.multica ? path.resolve(values.multica) : [
    path.join(repoRoot, "server", "bin", platform === "win32" ? "multica.exe" : "multica"),
    ...standaloneCandidates("multica", home, env, platform),
  ].find((file) => executable(file, platform));
  if (!multica || !executable(multica, platform)) {
    throw new Error("Multica executable not found. Build it with make build, install it, or pass --multica PATH.");
  }
  log(`Multica: ${multica}\nProfile: ${profile || "(unnamed)"}`);
  const statusArgs = ["daemon", "status", "--profile", profile, "--output", "json"];
  const logsHint = `Check: "${multica}" daemon logs --profile=${JSON.stringify(profile)}`;
  function status() {
    const result = run(multica, statusArgs, {
      env, encoding: "utf8", timeout: 10_000, windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.error) throw new Error(`Cannot inspect daemon: ${result.error.message}`);
    let health;
    try { health = JSON.parse(result.stdout); } catch {
      throw new Error(`Cannot inspect daemon (invalid JSON). ${result.stderr || "Update the Multica CLI."}`);
    }
    if (health?.status === "unknown_profile") {
      throw new Error(`Profile ${JSON.stringify(profile)} is not configured. Use --profile with your existing profile, or configure server_url/app_url and run multica login once. See CLI_AND_DAEMON.md#tomcat-launcher.`);
    }
    if (result.status !== 0) throw new Error(`Daemon status failed. ${result.stderr || logsHint}`);
    if (health?.port_conflict) throw new Error(`Daemon port belongs to another profile; leaving it untouched. ${logsHint}`);
    if (!["running", "starting", "stopped"].includes(health?.status)) {
      throw new Error(`Unrecognized daemon status; refusing to start another process. ${logsHint}`);
    }
    if (health.status !== "stopped" && health.profile !== profile) {
      throw new Error("Daemon profile mismatch; leaving it untouched.");
    }
    return health;
  }
  function reportLive(health) {
    log(`Daemon ${health.status} (pid ${health.pid ?? "unknown"}); left untouched. No restart or CLI switch performed.`);
    if (health.status === "starting") log(`Not ready yet. ${logsHint}`);
    else if (!health.agents?.includes("tomcat")) log(`Warning: this daemon does not report Tomcat. ${logsHint}`);
  }

  const before = status();
  if (before.status !== "stopped") { reportLive(before); return; }
  const tomcat = discoverTomcat({ home, env, platform, extensionsDir: values["extensions-dir"] });
  log(`Tomcat (${tomcat.source}): ${tomcat.file}`);
  if (values["dry-run"]) { log("Daemon stopped; dry run only, nothing started."); return; }

  const childEnv = { ...env, MULTICA_TOMCAT_PATH: tomcat.file };
  const version = run(tomcat.file, ["--version"], {
    env: childEnv, encoding: "utf8", timeout: 10_000, windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (version.error || version.status !== 0 || !/^tomcat\s+\d+\.\d+\.\d+/m.test(version.stdout ?? "")) {
    throw new Error(`Selected Tomcat cannot run or is not the Tomcat agent CLI: ${tomcat.file}. Repair this installation before retrying.`);
  }
  log(version.stdout.trim());
  // Multica owns authentication, profile loading, process locking and readiness.
  const started = run(multica, ["daemon", "start", "--profile", profile], {
    env: childEnv, stdio: "inherit", windowsHide: true, timeout: 120_000,
  });
  if (started.error || started.status !== 0) {
    throw new Error(`Daemon start failed${started.error ? `: ${started.error.message}` : ""}. No automatic retry or cleanup. ${logsHint}`);
  }
  // The CLI may exit zero after its readiness deadline; do not call that success.
  const after = status();
  if (after.status !== "running") {
    throw new Error(`Daemon is ${after.status}, not ready. It was not restarted or stopped. ${logsHint}`);
  }
  if (!after.agents?.includes("tomcat")) {
    throw new Error(`Daemon is running but does not report Tomcat; left running for diagnosis. ${logsHint}`);
  }
  log(`Daemon running (pid ${after.pid}); Tomcat discovered. Runtime registration/task execution is not tested by this script.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}
