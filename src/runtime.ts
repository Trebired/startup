import {
  createBootstrap,
  createBootstrapShutdownController,
} from "@package/bootstrap";
import { noop, ok, unavailable } from "@package/result";

import { loadConfig, normalizeConfig } from "#config";
import { resolveLogger } from "#logging";
import { emitStartupMessage } from "#messages";
import { resolvePrimaryPort } from "#ports";
import { checkRequirements } from "#requirements";
import { formatStartupDuration } from "#time";
import { PACKAGE_VERSION } from "#metadata";
import type {
  BootstrapOptions,
  BootstrapRunReport,
} from "@package/bootstrap";
import type { NormalizedStartupConfig, StartupConfig } from "#config-types";
import type {
  StartupContext,
  StartupEarlyBootAction,
  StartupEarlyBootDecision,
  StartupRunResult,
  StartupRuntimeHandle,
  StartupRuntimeOptions,
  StartupRequirementData,
} from "#types";

async function createStartupRuntime(
  options: StartupRuntimeOptions = {},
): Promise<StartupRuntimeHandle> {
  const config = await resolveStartupConfig(options);
  const logger = resolveLogger(options.logger, options.loggerAdapter);
  const context = createContext(options, config, logger);
  const bootstrapOptions = resolveBootstrapOptions(options, context);
  const runtime = createBootstrap(bootstrapOptions);
  const shutdownController = createBootstrapShutdownController(runtime, {
      ...options.shutdown,
      logger: options.logger,
      loggerAdapter: options.loggerAdapter,
      terminate: options.terminate,
      timeoutMs: config.lifecycle.shutdownTimeoutMs,
  });
  const cleanupSignals = bindShutdownSignals(shutdownController, options, config);
  return { config, cleanupSignals, logger, runtime, shutdownController };
}

async function runStartup(options: StartupRuntimeOptions = {}): Promise<StartupRunResult> {
  const handle = await createStartupRuntime(options);
  const context = createContext(options, handle.config, handle.logger);
  const earlyBoot = await runEarlyBoot(options.earlyBoot, context);
  if (earlyBoot?.handled) return await finishEarlyBoot(options, earlyBoot);
  const requirements = await checkRequirements(handle.config, {
      checks: options.checks,
      cwd: context.projectRoot,
      env: context.env,
      isPortUsed: options.isPortUsed,
      logger: handle.logger,
      postgresConnector: options.postgresConnector,
  });
  if (!requirements.ok) return await finishRequirementFailure(options, requirements.data);
  const bootstrap = await runBootstrap(handle, context);
  emitConfiguredMessages(handle, context, options, bootstrap);
  return ok("startup-complete", { data: { bootstrap, requirements: requirements.data } });
}

async function resolveStartupConfig(
  options: StartupRuntimeOptions,
): Promise<NormalizedStartupConfig> {
  if (options.config) {
    return normalizeConfig(options.config as StartupConfig, {
        requireForVersion: true,
    });
  }
  return (await loadConfig(options.projectRoot || process.cwd())).config;
}

function createContext(
  options: StartupRuntimeOptions,
  config: NormalizedStartupConfig,
  logger: StartupRuntimeHandle["logger"],
): StartupContext {
  return {
    config,
    env: options.env || process.env,
    logger,
    projectRoot: options.projectRoot || process.cwd(),
    startedAt: options.startedAt || Date.now(),
  };
}

function resolveBootstrapOptions(
  options: StartupRuntimeOptions,
  context: StartupContext,
): BootstrapOptions {
  const provided = typeof options.bootstrap === "function"
  ? options.bootstrap(context)
  : options.bootstrap || {};
  return {
    ...context.config.bootstrap,
    ...provided,
    lifecycle: {
      ...provided.lifecycle,
      shutdownTimeoutMs: context.config.lifecycle.shutdownTimeoutMs,
    },
    logger: options.logger,
    loggerAdapter: options.loggerAdapter,
  };
}

function bindShutdownSignals(
  controller: StartupRuntimeHandle["shutdownController"],
  options: StartupRuntimeOptions,
  config: NormalizedStartupConfig,
): (() => void) | null {
  if (options.bindSignals === false) return null;
  return controller.bindSignals({
      once: options.onceProcessEvent || onceProcessEvent,
      reason: (signal) => `signal:${signal}`,
      signals: config.lifecycle.shutdownSignals,
  });
}

function onceProcessEvent(signal: string, handler: () => void): () => void {
  process.once(signal, handler);
  return () => process.off(signal, handler);
}

async function runEarlyBoot(
  earlyBoot: StartupRuntimeOptions["earlyBoot"],
  context: StartupContext,
): Promise<StartupEarlyBootDecision|null> {
  const actions = Array.isArray(earlyBoot) ? earlyBoot : earlyBoot ? [earlyBoot] : [];
  for (const action of actions) {
    const decision = await runEarlyBootAction(action, context);
    if (decision?.handled) return decision;
  }
  return null;
}

async function runEarlyBootAction(
  action: StartupEarlyBootAction,
  context: StartupContext,
): Promise<StartupEarlyBootDecision|null> {
  const decision = await action(context);
  if (!decision) return null;
  return decision.handled ? decision : null;
}

async function finishEarlyBoot(
  options: StartupRuntimeOptions,
  decision: StartupEarlyBootDecision,
): Promise<StartupRunResult> {
  if (typeof decision.exitCode === "number" && options.terminate) {
    await options.terminate(decision.exitCode);
  }
  return noop("startup-early-boot-handled", { data: { earlyBoot: decision } });
}

async function finishRequirementFailure(
  options: StartupRuntimeOptions,
  data: StartupRequirementData | null,
): Promise<StartupRunResult> {
  if (options.terminateOnFailure !== false && options.terminate) await options.terminate(1);
  return unavailable("startup-requirements-failed", {
      data: { requirements: data },
      message: false,
  });
}

async function runBootstrap(
  handle: StartupRuntimeHandle,
  context: StartupContext,
): Promise<BootstrapRunReport> {
  const started = Date.now();
  context.logger.info("runtime", "bootstrap:start");
  const report = await handle.runtime.bootstrap();
  context.logger.info("runtime", "bootstrap:finish", {
      took_ms: Date.now() - started,
  });
  return report;
}

function emitConfiguredMessages(
  handle: StartupRuntimeHandle,
  context: StartupContext,
  options: StartupRuntimeOptions,
  bootstrap: BootstrapRunReport,
): void {
  const startupMs = Date.now() - context.startedAt;
  const port = options.messageData?.port ?? resolvePrimaryPort(handle.config, context.env);
  const data = {
    duration: formatStartupDuration(startupMs),
    port: port ?? undefined,
    product: handle.config.product,
    startupMs,
    ...options.messageData,
    bootstrap,
    packageVersion: PACKAGE_VERSION,
  };
  emitStartupMessage(handle, "welcome", data);
  emitStartupMessage(handle, "ready", data);
}

export {
  createStartupRuntime,
  runStartup,
};
