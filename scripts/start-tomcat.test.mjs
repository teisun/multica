import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { discoverTomcat, main } from "./start-tomcat.mjs";

const id = "tomcat-agent.tomcat-vscode-ext";
function fixture(t, platform = process.platform) {
  const root = mkdtempSync(path.join(tmpdir(), "start-tomcat-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, "home with spaces");
  const bin = path.join(root, "bin with spaces");
  const extensions = path.join(home, ".vscode", "extensions");
  const file = (name, content = "", mode = 0o644) => {
    mkdirSync(path.dirname(name), { recursive: true });
    writeFileSync(name, content, { mode });
    return name;
  };
  const suffix = platform === "win32" ? ".exe" : "";
  const exe = (name) => file(name, "fixture executable, never a real agent\n", 0o755);
  const multica = exe(path.join(root, "server", "bin", `multica${suffix}`));
  const env = { HOME: home, USERPROFILE: home, PATH: bin };
  const options = { home, env, platform, repoRoot: root };
  function bundle(version = "0.2.3", rootDir = extensions) {
    const directory = path.join(rootDir, `${id}-${version}`);
    file(path.join(directory, "package.json"), JSON.stringify({
      publisher: "tomcat-agent", name: "tomcat-vscode-ext", version,
    }));
    return exe(path.join(directory, "bin", `tomcat${suffix}`));
  }
  function standalone(directory = bin) { return exe(path.join(directory, `tomcat${suffix}`)); }
  const calls = [];
  const output = [];
  let current = { status: "stopped" };
  let startExit = 0;
  let after = { status: "running", profile: "local-tomcat", pid: 123, agents: ["tomcat"] };
  const run = (command, args, opts) => {
    calls.push({ command, args, opts });
    if (args[0] === "--version") return { status: 0, stdout: "tomcat 0.1.85\n" };
    assert.equal(command, multica);
    assert.deepEqual(args.slice(0, 1), ["daemon"]);
    if (args[1] === "status") return { status: current.status === "unknown_profile" ? 1 : 0, stdout: JSON.stringify(current) };
    assert.deepEqual(args, ["daemon", "start", "--profile", current.targetProfile ?? "local-tomcat"]);
    current = after;
    return { status: startExit };
  };
  const launch = (args = [], extra = {}) => main(args, { ...options, run, log: (line) => output.push(line), ...extra });
  return {
    root, home, bin, extensions, multica, env, options, file, exe, bundle, standalone, calls, output, launch,
    status: (value) => { current = value; },
    after: (value) => { after = value; },
    startExit: (value) => { startExit = value; },
  };
}

for (const install of ["cli-only", "extension-only", "both"]) {
  test(`${install}: selects the requested priority and starts once using saved profile`, (t) => {
    const f = fixture(t);
    const cli = install !== "extension-only" ? f.standalone() : undefined;
    const bundled = install !== "cli-only" ? f.bundle() : undefined;
    const config = f.file(path.join(f.home, ".multica", "profiles", "local-tomcat", "config.json"), '{"server_url":"http://saved.example","token":"fixture-only"}\n');
    const saved = readFileSync(config, "utf8");
    f.launch();
    const start = f.calls.find((call) => call.args[1] === "start");
    assert.equal(start.opts.env.MULTICA_TOMCAT_PATH, bundled ?? cli);
    assert.equal(start.opts.env.HOME, f.home);
    assert.deepEqual(f.calls.map((call) => call.args.slice(0, 2)), [
      ["daemon", "status"], ["--version"], ["daemon", "start"], ["daemon", "status"],
    ]);
    assert.equal(readFileSync(config, "utf8"), saved);
    f.launch();
    assert.equal(f.calls.filter((call) => call.args[1] === "start").length, 1);
    assert.match(f.output.at(-1), /left untouched/);
  });
}

test("preserves saved environment overrides except the selected Tomcat path", (t) => {
  const f = fixture(t);
  const bundled = f.bundle();
  Object.assign(f.env, {
    MULTICA_TOMCAT_PATH: path.join(f.root, "old-cli"),
    MULTICA_TOMCAT_MODEL: "existing-model",
    MULTICA_DAEMON_MAX_CONCURRENT_TASKS: "2",
  });
  f.launch();
  const childEnv = f.calls.find((call) => call.args[1] === "start").opts.env;
  assert.deepEqual(childEnv, { ...f.env, MULTICA_TOMCAT_PATH: bundled });
  assert.equal(f.env.MULTICA_TOMCAT_PATH, path.join(f.root, "old-cli"));
});

test("Multica can come from PATH and an invalid explicit path fails without commands", (t) => {
  const f = fixture(t);
  const installed = f.exe(path.join(f.bin, process.platform === "win32" ? "multica.exe" : "multica"));
  f.launch([], { repoRoot: path.join(f.root, "no-checkout"), run: (command, args) => {
    assert.equal(command, installed);
    assert.equal(args[1], "status");
    return { status: 0, stdout: JSON.stringify({ status: "running", profile: "local-tomcat", agents: ["tomcat"] }) };
  } });
  assert.throws(() => f.launch(["--multica", path.join(f.root, "missing")]), /Multica executable not found/);
  assert.equal(f.calls.length, 0);
});

test("uses registered version, not leftover upgrade directories", (t) => {
  const f = fixture(t);
  const registered = f.bundle("0.2.3");
  f.bundle("9.9.9");
  f.file(path.join(f.extensions, "extensions.json"), JSON.stringify([
    { identifier: { id }, version: "0.2.3", relativeLocation: path.basename(path.dirname(path.dirname(registered))) },
  ]));
  assert.equal(discoverTomcat(f.options).file, registered);
  f.file(path.join(f.extensions, "extensions.json"), "[]");
  const cli = f.standalone();
  assert.equal(discoverTomcat(f.options).file, cli, "uninstalled extension directories must not win");
});

test("without registry, sorts versions numerically and excludes obsolete installs", (t) => {
  const f = fixture(t);
  f.bundle("0.2.9");
  const latest = f.bundle("0.2.10");
  f.bundle("0.2.11");
  f.file(path.join(f.extensions, ".obsolete"), JSON.stringify({ [`${id}-0.2.11`]: true }));
  assert.equal(discoverTomcat(f.options).file, latest);
});

test("custom extension directory, Insiders, and off-PATH user CLI are discoverable", (t) => {
  const f = fixture(t);
  const userCLI = f.standalone(path.join(f.home, ".local", "bin"));
  assert.equal(discoverTomcat(f.options).file, userCLI);
  const insiders = f.bundle("0.2.3", path.join(f.home, ".vscode-insiders", "extensions"));
  assert.equal(discoverTomcat(f.options).file, insiders);
  const custom = path.join(f.root, "portable extensions");
  const bundled = f.bundle("0.3.0", custom);
  assert.equal(discoverTomcat({ ...f.options, extensionsDir: custom }).file, bundled);
  assert.equal(discoverTomcat({ ...f.options, env: { ...f.env, VSCODE_EXTENSIONS: custom } }).file, bundled);
});

test("Windows discovery uses .exe and case-insensitive PATH name", (t) => {
  const f = fixture(t, "win32");
  const cli = f.standalone();
  const env = { Path: `"${f.bin}";${path.join(f.root, "missing")}` };
  assert.equal(discoverTomcat({ ...f.options, env }).file, cli);
  assert.equal(discoverTomcat({ ...f.options, env }).file.endsWith(".exe"), true);
  const bundled = f.bundle();
  assert.equal(discoverTomcat({ ...f.options, env }).file, bundled);
});

test("missing or non-executable Tomcat does not start anything", (t) => {
  const f = fixture(t);
  assert.throws(() => f.launch(), /Tomcat not found/);
  if (process.platform !== "win32") {
    chmodSync(f.bundle(), 0o644);
    assert.throws(() => f.launch(), /Tomcat not found/);
  }
  assert.ok(f.calls.every((call) => call.args[1] === "status"));
});

test("malformed extension registry is reported, not silently ignored", (t) => {
  const f = fixture(t);
  f.bundle();
  f.standalone();
  f.file(path.join(f.extensions, "extensions.json"), "not json");
  assert.throws(() => f.launch(), /Cannot read.*extensions.json/);
});

for (const status of ["running", "starting"]) {
  test(`${status}: leaves existing daemon untouched even if CLI was removed`, (t) => {
    const f = fixture(t);
    f.status({ status, profile: "local-tomcat", pid: 44, agents: ["tomcat"] });
    f.launch();
    assert.equal(f.calls.length, 1);
    assert.match(f.output.join("\n"), /No restart or CLI switch/);
  });
}

for (const [health, message] of [
  [{ status: "unknown_profile" }, /not configured/],
  [{ status: "stopped", port_conflict: { profile: "other" } }, /another profile/],
  [{ status: "running", profile: "other" }, /profile mismatch/],
  [{ status: "unexpected" }, /Unrecognized/],
]) {
  test(`unsafe status ${JSON.stringify(health)} never starts`, (t) => {
    const f = fixture(t);
    f.status(health);
    assert.throws(() => f.launch(), message);
    assert.equal(f.calls.length, 1);
  });
}

test("status execution failure and malformed output fail closed", (t) => {
  const f = fixture(t);
  for (const result of [
    { error: new Error("timeout") },
    { status: 0, stdout: "not json" },
    { status: 1, stdout: '{"status":"stopped"}', stderr: "read failed" },
  ]) {
    let calls = 0;
    assert.throws(() => f.launch([], { run: () => { calls++; return result; } }), /Cannot inspect|status failed/);
    assert.equal(calls, 1);
  }
});

test("dry run preserves Agent guard and only reads status/files", (t) => {
  const f = fixture(t);
  f.bundle();
  f.env.TOMCAT_AGENT_ACTIVE = "1";
  assert.throws(() => f.launch(), /own terminal/);
  assert.equal(f.calls.length, 0);
  f.launch(["--dry-run"]);
  assert.equal(f.calls.length, 1);
  assert.equal(f.env.TOMCAT_AGENT_ACTIVE, "1");
  assert.match(f.output.at(-1), /nothing started/);
});

test("selected CLI must run as Tomcat before a daemon can start", (t) => {
  const f = fixture(t);
  f.bundle();
  for (const result of [{ status: 1 }, { error: new Error("ENOEXEC") }, { status: 0, stdout: "Apache Tomcat 10" }]) {
    const calls = [];
    assert.throws(() => f.launch([], { run: (cmd, args) => {
      calls.push(args);
      return args[1] === "status" ? { status: 0, stdout: '{"status":"stopped"}' } : result;
    } }), /cannot run/);
    assert.equal(calls.length, 2);
  }
});

test("start failure is surfaced without retry, restart or cleanup", (t) => {
  const f = fixture(t);
  f.bundle();
  f.startExit(1);
  assert.throws(() => f.launch(), /start failed/);
  assert.equal(f.calls.length, 3);
});

for (const after of [{ status: "stopped" }, { status: "starting", profile: "local-tomcat" }, { status: "running", profile: "local-tomcat", agents: ["codex"] }]) {
  test(`zero start exit does not hide incomplete readiness: ${JSON.stringify(after)}`, (t) => {
    const f = fixture(t);
    f.bundle();
    f.after(after);
    assert.throws(() => f.launch(), /not ready|does not report Tomcat/);
    assert.equal(f.calls.filter((call) => call.args[1] === "start").length, 1);
  });
}

test("explicit saved profile is passed through, including unnamed profile", (t) => {
  const f = fixture(t);
  f.standalone();
  for (const profile of ["my-existing-profile", ""]) {
    f.status({ status: "stopped", targetProfile: profile });
    f.after({ status: "running", profile, pid: 1, agents: ["tomcat"] });
    f.launch([`--profile=${profile}`]);
    assert.equal(f.calls.at(-1).args[3], profile);
  }
});

test("actual child invocation preserves paths with spaces and repeats without another start", { skip: process.platform === "win32" }, (t) => {
  const f = fixture(t);
  const tomcat = f.bundle();
  f.file(tomcat, "#!/bin/sh\nprintf 'tomcat 0.1.85\\n'\n", 0o755);
  f.file(f.multica, `#!/bin/sh
case "$1 $2" in
  'daemon status')
    if [ -f "$HOME/started" ]; then
      printf '{"status":"running","profile":"local-tomcat","pid":123,"agents":["tomcat"]}\\n'
    else
      printf '{"status":"stopped"}\\n'
    fi ;;
  'daemon start') printf '%s\\n' "$MULTICA_TOMCAT_PATH" >> "$HOME/started" ;;
  *) exit 99 ;;
esac
`, 0o755);
  const script = fileURLToPath(new URL("./start-tomcat.mjs", import.meta.url));
  for (let i = 0; i < 2; i++) {
    const result = spawnSync(process.execPath, [script, "--multica", f.multica], {
      cwd: f.root, env: f.env, encoding: "utf8", timeout: 10_000,
    });
    assert.equal(result.status, 0, result.stderr);
  }
  assert.equal(readFileSync(path.join(f.home, "started"), "utf8"), `${tomcat}\n`);
});
