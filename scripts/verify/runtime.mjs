import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import packageJson from "../../package.json" with { type: "json" };

const FIXTURE_FOR_VERSION = packageJson.version;

import {
  checkRequirements,
  createLifecycleFailureController,
  createStartupRuntime,
  createStartupStateFlag,
  createStartupTaskManager,
  emitStartupMessage,
  hasAnyTokenFlag,
  listenStrict,
  loadConfig,
  parsePortStrict,
  parseTokenFlags,
  readPairedEnvValues,
  runStartup,
  runStartupSteps,
} from "#index";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempRoot = path.join(rootDir, ".tmp", "verify-runtime");

async function main() {
  await resetTemp();
  await verifyConfigLoading();
  await verifyRequirements();
  await verifyMessages();
  await verifyMessagePresets();
  await verifyGenericHelpers();
  await verifyRuntime();
  await verifyShutdownSignals();
  console.log("Runtime verification succeeded.");
}

async function resetTemp() {
  await fs.rm(tempRoot, { force: true, recursive: true });
  await fs.mkdir(tempRoot, { recursive: true });
}

async function verifyConfigLoading() {
  const projectRoot = path.join(tempRoot, "config");
  await writeStartupConfig(projectRoot, FIXTURE_FOR_VERSION);
  const loaded = await loadConfig(projectRoot);
  assert.equal(loaded.config.product.name, "Verify");

  await writeRawConfig(projectRoot, "export default { product: { name: 'Broken' } };");
  await assert.rejects(() => loadConfig(projectRoot), /missing forVersion/u);

  await writeRawConfig(projectRoot, "export default { forVersion: '1.0.0' };");
  await assert.rejects(() => loadConfig(projectRoot), /targets 1.0.0/u);
}

async function writeStartupConfig(projectRoot, forVersion) {
  await writeRawConfig(projectRoot, [
      "export default defineConfig({",
      `  forVersion: ${JSON.stringify(forVersion)},`,
      "  product: { name: 'Verify', version: '9.9.9' },",
      "});",
    ].join("\n"));
}

async function writeRawConfig(projectRoot, source) {
  const configPath = path.join(projectRoot, ".trebired", "startup", "config.ts");
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, source);
}

async function verifyRequirements() {
  const dirPath = path.join(tempRoot, "data");
  const config = requirementConfig(dirPath);
  const okLogs = [];
  const okResult = await checkRequirements(config, requirementContext({}, okLogs));
  assert.equal(okResult.ok, true);
  assert.equal(okResult.data.ports.PORT, 3210);
  assert.ok(okLogs.some((event) => event.group === "trebired.startup.requirements"));

  const standardLogs = [];
  const standardResult = await checkRequirements(config, {
      ...requirementContext({}, standardLogs),
      logger: standardLogger(standardLogs),
  });
  assert.equal(standardResult.ok, true);
  assert.ok(standardLogs.some((event) => event.level === "success"));

  const failed = await checkRequirements(config, requirementContext({ DATA_DIR: "" }));
  assert.equal(failed.ok, false);
  assert.ok(failed.data.failures.some((item) => item.status_code === "startup-env-missing"));

  const rootRequired = requirementConfig(path.join(tempRoot, "root-data"));
  rootRequired.requirements.process = { root: true };
  const rootFailed = await checkRequirements(rootRequired, {
      ...requirementContext(),
      process: { gid: 1000, uid: 1000 },
  });
  assert.equal(rootFailed.ok, false);
  assert.ok(rootFailed.data.failures.some((item) => item.status_code === "startup-process-root-required"));

  const rootOk = await checkRequirements(rootRequired, {
      ...requirementContext(),
      process: { gid: 0, uid: 0 },
  });
  assert.equal(rootOk.ok, true);

  const invalidInstance = await checkRequirements(config, requirementContext({ INSTANCE: "D8AC90MWBCHR" }));
  assert.equal(invalidInstance.ok, false);
  assert.ok(invalidInstance.data.failures.some((item) => item.status_code === "startup-value-forbidden"));

  const missingUrlPart = await checkRequirements(config, requirementContext({
        DATABASE_URL: "postgres://localhost",
  }));
  assert.equal(missingUrlPart.ok, false);
  assert.ok(missingUrlPart.data.failures.some((item) => item.status_code === "startup-url-part-missing"));
}

function requirementConfig(dirPath) {
  return {
    forVersion: FIXTURE_FOR_VERSION,
    product: { name: "Verify", version: "9.9.9" },
    requirements: {
      env: { required: ["DATA_DIR", "INSTANCE"] },
      paths: [
        { create: true, kind: "dir", path: dirPath, writable: true },
        { create: true, kind: "dir", path: "{env.DATA_DIR}/updates", writable: true },
      ],
      postgres: [{ env: "DATABASE_URL", timeoutMs: 5, value: "postgres://localhost/db" }],
      ports: [{ defaultValue: 3210, env: "PORT" }],
      urls: [{ env: "DATABASE_URL", protocols: ["postgres"], requiredParts: ["hostname", "database", "username"] }],
      values: [
        { env: "INSTANCE", pattern: "^[A-Z0-9]{12}$", forbidden: ["D8AC90MWBCHR"] },
      ],
    },
    lifecycle: { shutdownSignals: ["SIGINT"], shutdownTimeoutMs: 200 },
    messages: { welcome: { enabled: false } },
    bootstrap: {},
  };
}

function requirementContext(env = {}, logs = []) {
  return {
    cwd: tempRoot,
    env: {
      DATABASE_URL: "postgres://user@localhost/db",
      DATA_DIR: path.join(tempRoot, "data"),
      INSTANCE: "ABC123XYZ789",
      ...env,
    },
    isPortUsed: async() => false,
    logger: captureLogger(logs),
    postgresConnector: async() => undefined,
  };
}

async function verifyMessages() {
  const logs = [];
  const config = requirementConfig(path.join(tempRoot, "message-data"));
  config.messages.ready = {
    enabled: true,
    level: "success",
    metadata: { static: true },
    text: ["Ready {product.name}", "Port {port}"],
  };
  emitStartupMessage({ config, logger: captureLogger(logs) }, "ready", { port: 42, startupMs: 1250 });
  assert.deepEqual(logs.map((event) => event.message), ["Ready Verify", "Port 42"]);
  assert.equal(logs[0].metadata.static, true);
}

async function verifyMessagePresets() {
  const { normalizeConfig } = await import("../../dist/config/index.js");
  const { resolvePrimaryOrigins } = await import("../../dist/ports.js");

  // purpose-built: requirementConfig() disables `welcome`, which these cases need
  const base = () => ({
    forVersion: FIXTURE_FOR_VERSION,
    product: { name: "Verify", version: "9.9.9" },
    requirements: { ports: [{ defaultValue: 3210, env: "PORT" }] },
  });
  const emit = (config, key, data = {}) => {
    const logs = [];
    emitStartupMessage({ config, logger: captureLogger(logs) }, key, data);
    return logs;
  };
  const env = { PORT: "3000" };

  // an app that sets no preset must emit exactly what it always has
  const untouched = normalizeConfig(base());
  assert.deepEqual(
    emit(untouched, "welcome", { startupMs: 1250 }).map((e) => e.message),
    ["Welcome to Verify 9.9.9"],
  );
  assert.deepEqual(
    emit(untouched, "ready", { port: 42, startupMs: 1250 }).map((e) => e.message),
    ["Server is ready on port 42. Startup took 1.25s."],
  );
  assert.equal(untouched.messages.ready.level, "success");

  // origins are derived from the port requirement, not supplied by the caller
  const origins = resolvePrimaryOrigins(untouched, env);
  assert.equal(origins.origin, "http://localhost:3000");
  assert.equal(origins.loopbackOrigin, "http://localhost:3000");

  // named presets
  const raw = base();
  raw.messages = { ready: { preset: "raw" }, welcome: { preset: "minimal" } };
  const rawConfig = normalizeConfig(raw);
  assert.deepEqual(
    emit(rawConfig, "ready", origins).map((e) => e.message),
    ["Server ready :: http://localhost:3000"],
  );
  assert.deepEqual(emit(rawConfig, "welcome").map((e) => e.message), ["Verify 9.9.9"]);
  assert.equal(rawConfig.messages.welcome.level, "info", "preset carries its own level");

  // multi-line preset
  const banner = base();
  banner.messages = { welcome: { preset: "banner" } };
  assert.deepEqual(
    emit(normalizeConfig(banner), "welcome").map((e) => e.message),
    ["Verify 9.9.9", "Starting…"],
  );

  // explicit text and level beat the preset
  const overridden = base();
  overridden.messages = { ready: { level: "warn", preset: "raw", text: ["Custom {port}"] } };
  const overriddenConfig = normalizeConfig(overridden);
  assert.deepEqual(emit(overriddenConfig, "ready", { port: 9 }).map((e) => e.message), ["Custom 9"]);
  assert.equal(overriddenConfig.messages.ready.level, "warn");

  // an unknown preset is a config error, not a silent fallback
  const bogus = base();
  bogus.messages = { ready: { preset: "nope" } };
  assert.throws(() => normalizeConfig(bogus), /has no preset "nope"/u);

  // a line whose placeholders cannot resolve is dropped, not half-rendered
  assert.deepEqual(emit(rawConfig, "ready", {}).map((e) => e.message), []);
}

async function verifyGenericHelpers() {
  verifyBootHelpers();
  await verifyLifecycleController();
  verifyStateFlag();
  await verifyTaskHelpers();
  await verifyListenHelpers();
}

function verifyBootHelpers() {
  const flags = parseTokenFlags("platform,force", ["platform", "host_agent", "force"]);
  assert.equal(flags.platform, true);
  assert.equal(flags.host_agent, false);
  assert.equal(hasAnyTokenFlag(flags, ["host_agent", "force"]), true);
  const pair = readPairedEnvValues({ USER: "admin", PASSWORD: "secret" }, ["USER", "PASSWORD"]);
  assert.equal(pair.enabled, true);
  assert.throws(() => readPairedEnvValues({ USER: "admin" }, ["USER", "PASSWORD"]), /startup-paired-env-incomplete/u);
}

async function verifyLifecycleController() {
  const logs = [];
  let handled = null;
  const controller = createLifecycleFailureController({
      logger: standardLogger(logs),
  });
  controller.setHandler((input) => {
      handled = input;
  });
  await controller.request({ reason: "verify", statusCode: "verify-failed" });
  assert.equal(handled.reason, "verify");
  assert.equal(handled.statusCode, "verify-failed");
  assert.ok(logs.some((event) => event.group === "trebired.startup.lifecycle"));
}

function verifyStateFlag() {
  const flag = createStartupStateFlag();
  assert.equal(flag.isSet(), false);
  flag.set();
  assert.equal(flag.isSet(), true);
  flag.clear();
  assert.equal(flag.isSet(), false);
}

async function verifyTaskHelpers() {
  const logs = [];
  const manager = createStartupTaskManager({ logger: standardLogger(logs) });
  let stopped = false;
  manager.startService({
      label: "verify service",
      start: () => ({ stop: () => { stopped = true; } }),
  });
  manager.schedule({
      label: "verify scheduled",
      delayMs: 1,
      run: () => logs.push({ group: "verify", level: "info", message: "scheduled" }),
  });
  await waitFor(() => logs.some((event) => event.message === "scheduled"));
  await runStartupSteps([
      { id: "verify-step", run: () => undefined },
      { id: "verify-failing-step", run: () => { throw new Error("expected"); } },
    ], { logger: standardLogger(logs) });
  manager.stop();
  assert.equal(stopped, true);
  assert.ok(logs.some((event) =>
      event.group === "trebired.startup.tasks" &&
        event.message === "service started" &&
        event.metadata?.label === "verify service"));
  assert.equal(logs.some((event) => event.message === "task completed"), false);
  assert.ok(logs.some((event) =>
      event.group === "trebired.startup.tasks" &&
        event.message === "step failed" &&
        event.metadata?.step_id === "verify-failing-step"));
}

async function verifyListenHelpers() {
  assert.equal(parsePortStrict("4321"), 4321);
  assert.throws(() => parsePortStrict("nope"), /integer between/u);
  const server = await import("node:http").then((http) => http.createServer((_req, res) => res.end("ok")));
  const address = await listenStrict(server, { host: "127.0.0.1", port: 0 });
  assert.ok(address.port > 0);
  await new Promise((resolve) => server.close(resolve));
}

async function verifyRuntime() {
  const early = await runStartup({
      config: requirementConfig(path.join(tempRoot, "runtime-data")),
      earlyBoot: () => ({ exitCode: 7, handled: true, reason: "verify" }),
      logger: captureLogger([]),
      terminate: (exitCode) => {
        assert.equal(exitCode, 7);
      },
  });
  assert.equal(early.noop, true);

  const logs = [];
  const complete = await runStartup({
      config: requirementConfig(path.join(tempRoot, "runtime-ok")),
      bootstrap: { subsystems: [{ id: "service", bootstrap() {} }] },
      env: {
        DATABASE_URL: "postgres://user@localhost/db",
        DATA_DIR: path.join(tempRoot, "runtime-ok"),
        INSTANCE: "ABC123XYZ789",
      },
      logger: captureLogger(logs),
      isPortUsed: async() => false,
      postgresConnector: async() => undefined,
  });
  assert.equal(complete.ok, true);
  assert.ok(logs.some((event) => event.group.endsWith(".messages")));
}

async function verifyShutdownSignals() {
  const logs = [];
  const handlers = {};
  const terminateCalls = [];
  const handle = await createStartupRuntime({
      config: requirementConfig(path.join(tempRoot, "runtime-signal")),
      bootstrap: { subsystems: [{ id: "service", bootstrap() {} }] },
      logger: captureLogger(logs),
      onceProcessEvent(signal, handler) {
        handlers[signal] = handler;
        return () => delete handlers[signal];
      },
      terminate: (exitCode) => terminateCalls.push(exitCode),
  });
  await handle.runtime.bootstrap();
  handlers.SIGINT();
  await waitFor(() => terminateCalls.length === 1);
  assert.deepEqual(terminateCalls, [0]);
  assert.ok(
    logs.some((event) => event.group === "trebired.bootstrap.shutdown"),
    "shutdown logs should stay under bootstrap",
  );
  assert.equal(
    logs.some((event) => event.group.includes("startup.trebired.bootstrap")),
    false,
    "shutdown logs must not be nested under startup",
  );
  handle.cleanupSignals?.();
}

async function waitFor(condition) {
  for (let index = 0; index < 20; index += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("condition not reached");
}

function captureLogger(logs) {
  return {
    error: (group, message, metadata) => logs.push({ group, level: "error", message, metadata }),
    fail: (group, message, metadata) => logs.push({ group, level: "fail", message, metadata }),
    info: (group, message, metadata) => logs.push({ group, level: "info", message, metadata }),
    log: (level, group, message, metadata) => logs.push({ group, level, message, metadata }),
    warn: (group, message, metadata) => logs.push({ group, level: "warn", message, metadata }),
  };
}

function standardLogger(logs) {
  return {
    error: (group, message, metadata) => logs.push({ group, level: "error", message, metadata }),
    fail: (group, message, metadata) => logs.push({ group, level: "fail", message, metadata }),
    info: (group, message, metadata) => logs.push({ group, level: "info", message, metadata }),
    success: (group, message, metadata) => logs.push({ group, level: "success", message, metadata }),
    warn: (group, message, metadata) => logs.push({ group, level: "warn", message, metadata }),
  };
}

await main();
