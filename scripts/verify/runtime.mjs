import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkRequirements,
  createStartupRuntime,
  emitStartupMessage,
  loadConfig,
  runStartup,
} from "#index";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempRoot = path.join(rootDir, ".tmp", "verify-runtime");

async function main() {
  await resetTemp();
  await verifyConfigLoading();
  await verifyRequirements();
  await verifyMessages();
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
  await writeStartupConfig(projectRoot, "0.2.99");
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

  const failed = await checkRequirements(config, requirementContext({ DATA_DIR: "" }));
  assert.equal(failed.ok, false);
  assert.ok(failed.data.failures.some((item) => item.status_code === "startup-env-missing"));

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
    forVersion: "0.2.99",
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

await main();
