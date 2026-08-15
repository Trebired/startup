import { DEFAULT_SHUTDOWN_SIGNALS } from "#constants";
import { assertCompatibleForVersion } from "#version";
import {
  cleanProtocol,
  isRecord,
  pickDefined,
  toNumber,
  toString,
  uniqueStrings,
} from "#values";
import { PACKAGE_VERSION } from "#metadata";
import type {
  NormalizedStartupConfig,
  StartupConfig,
  StartupLifecycleConfig,
  StartupMessageConfig,
  StartupMessagesConfig,
  StartupPathRequirementConfig,
  StartupPortRequirementConfig,
  StartupPostgresRequirementConfig,
  StartupUrlRequirementConfig,
} from "./types.js";
import type { StartupLogLevel } from "#types";

type NormalizeOptions = {
  configPath?: string;
  requireForVersion?: boolean;
};

const DEFAULT_MESSAGES: StartupMessagesConfig = {
  ready: {
    enabled: true,
    level: "success",
    text: "Server is ready on port {port}. Startup took {duration}.",
  },
  welcome: {
    enabled: true,
    level: "success",
    text: "Welcome to {product.name} {product.version}",
  },
};

function defineConfig<TConfig extends StartupConfig>(config: TConfig): TConfig {
  return config;
}

function normalizeConfig(
  config: StartupConfig = {},
  options: NormalizeOptions = {},
): NormalizedStartupConfig {
  if (!isRecord(config)) throw new Error("startup config must be an object");
  const forVersion = normalizeForVersion(config, options);
  return {
    forVersion,
    product: normalizeProduct(config.product),
    requirements: normalizeRequirements(config.requirements),
    lifecycle: normalizeLifecycle(config.lifecycle),
    messages: normalizeMessages(config.messages),
    bootstrap: isRecord(config.bootstrap) ? config.bootstrap : {},
  };
}

function normalizeForVersion(
  config: StartupConfig,
  options: NormalizeOptions,
): string {
  const forVersion = toString(config.forVersion);
  if (!forVersion && options.requireForVersion !== false) {
    throw new Error(`startup config is missing forVersion: ${options.configPath || "inline"}`);
  }
  const resolved = forVersion || PACKAGE_VERSION;
  assertCompatibleForVersion(resolved, options.configPath || "inline");
  return resolved;
}

function normalizeProduct(input: StartupConfig["product"]) {
  return {
    name: toString(input?.name) || "App",
    version: toString(input?.version) || "0.1.0",
  };
}

function normalizeRequirements(input: StartupConfig["requirements"]) {
  const value = isRecord(input) ? input : {};
  return {
    env: {
      required: uniqueStrings(isRecord(value.env) ? value.env.required : []),
    },
    paths: normalizePathRequirements(value.paths),
    urls: normalizeUrlRequirements(value.urls),
    postgres: normalizePostgresRequirements(value.postgres),
    ports: normalizePortRequirements(value.ports),
  };
}

function normalizePathRequirements(input: unknown): StartupPathRequirementConfig[] {
  return normalizeArray(input).map((item) => pickDefined({
        create: item.create === true,
        env: toString(item.env) || undefined,
        kind: item.kind === "file" ? "file" : "dir",
        path: toString(item.path) || undefined,
        writable: item.writable === true,
  }));
}

function normalizeUrlRequirements(input: unknown) {
  return normalizeArray(input).map((item): StartupUrlRequirementConfig& { protocols: string[] } => ({
        env: toString(item.env) || undefined,
        value: toString(item.value) || undefined,
        protocols: uniqueStrings(item.protocols).map(cleanProtocol),
  }));
}

function normalizePostgresRequirements(input: unknown) {
  return normalizeArray(input).map((item): Required<StartupPostgresRequirementConfig> => ({
        env: toString(item.env),
        value: toString(item.value),
        timeoutMs: toNumber(item.timeoutMs) ?? 3000,
  }));
}

function normalizePortRequirements(input: unknown): StartupPortRequirementConfig[] {
  return normalizeArray(input).map((item): StartupPortRequirementConfig => {
      const value = normalizePortValue(item.value);
      const defaultValue = normalizePortValue(item.defaultValue);
      return pickDefined({
          checkAvailable: item.checkAvailable === false ? false : undefined,
          defaultValue,
          env: toString(item.env) || undefined,
          host: toString(item.host) || undefined,
          value,
      }) as StartupPortRequirementConfig;
  });
}

function normalizePortValue(value: unknown): number | string | undefined {
  return typeof value === "number" || typeof value === "string" ? value : undefined;
}

function normalizeLifecycle(input: StartupLifecycleConfig | undefined) {
  return {
    shutdownSignals: uniqueStrings(input?.shutdownSignals).length > 0
    ? uniqueStrings(input?.shutdownSignals)
    : Array.from(DEFAULT_SHUTDOWN_SIGNALS),
    shutdownTimeoutMs: toNumber(input?.shutdownTimeoutMs) ?? 8000,
  };
}

function normalizeMessages(input: StartupMessagesConfig | undefined) {
  const messages: NormalizedStartupConfig["messages"] = {};
  const merged = { ...DEFAULT_MESSAGES, ...(isRecord(input) ? input : {}) };
  for (const [key, value] of Object.entries(merged)) {
    if (!isRecord(value)) continue;
    messages[key] = normalizeMessage(value);
  }
  return messages;
}

function normalizeMessage(input: StartupMessageConfig) {
  return {
    enabled: input.enabled !== false,
    level: normalizeLevel(input.level),
    text: uniqueStrings(input.text),
    metadata: isRecord(input.metadata) ? { ...input.metadata } : {},
  };
}

function normalizeLevel(level: unknown): StartupLogLevel {
  const value = toString(level);
  if (["debug", "info", "success", "warn", "error", "fail"].includes(value)) {
    return value as StartupLogLevel;
  }
  return "info";
}

function normalizeArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export {
  defineConfig,
  normalizeConfig,
};
