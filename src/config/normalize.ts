import { DEFAULT_SHUTDOWN_SIGNALS } from "#constants";
import {
  compactRecord,
  isRecord,
  toNumber,
  toTrimmedString as toString,
  uniqueStrings as uniqueArrayStrings,
} from "@trebired/utils";
import { resolveForVersion } from "@trebired/utils";
import { PACKAGE_VERSION } from "#metadata";
import type {
  NormalizedConfig,
  Config,
  LifecycleConfig,
  MessageConfig,
  MessagesConfig,
  PathRequirementConfig,
  PortRequirementConfig,
  PostgresRequirementConfig,
  RequirementConditionConfig,
  UrlRequirementConfig,
  ValueRequirementConfig,
} from "./types.js";
import type { StartupLogLevel } from "#types";

type NormalizeOptions = {
  configPath?: string;
  requireForVersion?: boolean;
};

const DEFAULT_MESSAGES: MessagesConfig = {
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

function defineConfig<TConfig extends Config>(config: TConfig): TConfig {
  return config;
}

function normalizeConfig(
  config: Config = {},
  options: NormalizeOptions = {},
): NormalizedConfig {
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
  config: Config,
  options: NormalizeOptions,
): string {
  return resolveForVersion({
      configPath: options.configPath,
      forVersion: config.forVersion,
      label: "startup",
      packageVersion: PACKAGE_VERSION,
      requireForVersion: options.requireForVersion,
  });
}

function normalizeProduct(input: Config["product"]) {
  return {
    name: toString(input?.name) || "App",
    version: toString(input?.version) || "0.1.0",
  };
}

function normalizeRequirements(input: Config["requirements"]) {
  const value = isRecord(input) ? input : {};
  return {
    env: {
      required: uniqueStrings(isRecord(value.env) ? value.env.required : []),
    },
    values: normalizeValueRequirements(value.values),
    paths: normalizePathRequirements(value.paths),
    urls: normalizeUrlRequirements(value.urls),
    postgres: normalizePostgresRequirements(value.postgres),
    ports: normalizePortRequirements(value.ports),
  };
}

function normalizeValueRequirements(input: unknown): ValueRequirementConfig[] {
  return normalizeArray(input).map((item) => compactRecord({
        allowed: uniqueStrings(item.allowed),
        env: toString(item.env) || undefined,
        forbidden: uniqueStrings(item.forbidden),
        message: toString(item.message) || undefined,
        notPattern: toString(item.notPattern) || undefined,
        pattern: toString(item.pattern) || undefined,
        required: item.required === false ? false : undefined,
        statusCode: toString(item.statusCode) || undefined,
        value: normalizeValueRequirementLiteral(item.value),
        when: normalizeCondition(item.when),
    }) as ValueRequirementConfig);
}

function normalizePathRequirements(input: unknown): PathRequirementConfig[] {
  return normalizeArray(input).map((item) => compactRecord({
        create: item.create === true,
        env: toString(item.env) || undefined,
        kind: item.kind === "file" ? "file" : "dir",
        path: toString(item.path) || undefined,
        when: normalizeCondition(item.when),
        writable: item.writable === true,
    }) as PathRequirementConfig);
}

function normalizeUrlRequirements(input: unknown) {
  return normalizeArray(input).map((item): UrlRequirementConfig& { protocols: string[]; requiredParts: string[] } => ({
        env: toString(item.env) || undefined,
        value: toString(item.value) || undefined,
        protocols: uniqueStrings(item.protocols).map(cleanProtocol),
        requiredParts: uniqueStrings(item.requiredParts).map((part) =>
          toString(part).toLowerCase()),
        when: normalizeCondition(item.when),
  }));
}

function normalizePostgresRequirements(input: unknown) {
  return normalizeArray(input).map((item): Required<PostgresRequirementConfig> => ({
        env: toString(item.env),
        value: toString(item.value),
        timeoutMs: normalizeNumber(item.timeoutMs, 3000),
        when: normalizeCondition(item.when) as RequirementConditionConfig,
  }));
}

function normalizePortRequirements(input: unknown): PortRequirementConfig[] {
  return normalizeArray(input).map((item): PortRequirementConfig => {
      const value = normalizePortValue(item.value);
      const defaultValue = normalizePortValue(item.defaultValue);
      return compactRecord({
          checkAvailable: item.checkAvailable === false ? false : undefined,
          defaultValue,
          env: toString(item.env) || undefined,
          host: toString(item.host) || undefined,
          hostEnv: toString(item.hostEnv) || undefined,
          value,
          when: normalizeCondition(item.when),
      }) as PortRequirementConfig;
  });
}

function normalizeValueRequirementLiteral(value: unknown): string | number | boolean | undefined {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
  ? value
  : undefined;
}

function normalizePortValue(value: unknown): number | string | undefined {
  return typeof value === "number" || typeof value === "string" ? value : undefined;
}

function normalizeCondition(input: unknown): RequirementConditionConfig | undefined {
  if (!isRecord(input)) return undefined;
  return compactRecord({
      env: toString(input.env) || undefined,
      equals: normalizeConditionValues(input.equals),
      exists: typeof input.exists === "boolean" ? input.exists : undefined,
      notEquals: normalizeConditionValues(input.notEquals),
  }) as RequirementConditionConfig;
}

function normalizeConditionValues(input: unknown): string[] | string | undefined {
  const values = uniqueStrings(input);
  if (values.length === 0) return undefined;
  return values.length === 1 ? values[0] : values;
}

function normalizeLifecycle(input: LifecycleConfig | undefined) {
  const shutdownSignals = uniqueStrings(input?.shutdownSignals);
  return {
    shutdownSignals: shutdownSignals.length > 0
    ? shutdownSignals
    : Array.from(DEFAULT_SHUTDOWN_SIGNALS),
    shutdownTimeoutMs: normalizeNumber(input?.shutdownTimeoutMs, 8000),
  };
}

function normalizeMessages(input: MessagesConfig | undefined) {
  const messages: NormalizedConfig["messages"] = {};
  const merged = { ...DEFAULT_MESSAGES, ...(isRecord(input) ? input : {}) };
  for (const [key, value] of Object.entries(merged)) {
    if (!isRecord(value)) continue;
    messages[key] = normalizeMessage(value);
  }
  return messages;
}

function normalizeMessage(input: MessageConfig) {
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

function normalizeNumber(value: unknown, fallback: number): number {
  const number = toNumber(value, Number.NaN);
  return Number.isFinite(number) ? number : fallback;
}

function uniqueStrings(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return uniqueArrayStrings(values);
}

function cleanProtocol(value: unknown): string {
  return toString(value).toLowerCase().replace(/:$/u, "");
}

export {
  defineConfig,
  normalizeConfig,
};
