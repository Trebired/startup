import { formatStartupDuration } from "#time";
import { STARTUP_LOG_GROUP } from "#constants";
import {
  isRecord,
  toTrimmedString as toString,
} from "@trebired/utils";
import type { NormalizedConfig } from "#config-types";
import type {
  NormalizedStartupLogger,
  StartupMessageData,
} from "#types";

type StartupMessageContext = {
  config: NormalizedConfig;
  logger: NormalizedStartupLogger;
};

function emitStartupMessage(
  context: StartupMessageContext,
  key: string,
  data: StartupMessageData = {},
): void {
  const message = context.config.messages[key];
  if (!message?.enabled) return;
  const templateData = createTemplateData(context.config, data);
  const metadata = {
    ...message.metadata,
    ...runtimeMetadata(templateData),
  };
  for (const text of message.text) {
    if (!templateIsResolvable(text, templateData)) continue;
    context.logger.log(message.level, `${STARTUP_LOG_GROUP}.messages`, renderTemplate(text, templateData), metadata);
  }
}

/**
* `renderTemplate` substitutes an empty string for anything it cannot resolve,
* which turns a line like "Server ready :: {origin}" into "Server ready :: ".
* A line with an unresolved placeholder is dropped instead; other lines of the
* same message still emit.
*/
function templateIsResolvable(template: string, data: StartupMessageData): boolean {
  const keys = Array.from(template.matchAll(/\{([^}]+)\}/gu)).map((match) => match[1] || "");
  return keys.every((key) => {
      const value = resolveTemplateValue(data, key);
      return value !== undefined && value !== null && String(value).trim() !== "";
  });
}

function renderTemplate(template: string, data: StartupMessageData): string {
  return template.replace(/\{([^}]+)\}/gu, (_match, key: string) => {
      const value = resolveTemplateValue(data, key);
      return value === undefined || value === null ? "" : String(value);
  });
}

function createTemplateData(
  config: NormalizedConfig,
  data: StartupMessageData,
): StartupMessageData {
  const startupMs = typeof data.startupMs === "number" ? data.startupMs : undefined;
  return {
    ...data,
    duration: toString(data.duration) || formatStartupDuration(startupMs),
    product: {
      ...config.product,
      ...(isRecord(data.product) ? data.product : {}),
    },
    startupMs,
  };
}

function joinValues(values: unknown): string {
  if (!Array.isArray(values)) return "";
  return values.filter((value) => value !== undefined && value !== null && value !== "").join(", ");
}

function firstOrAll(single: unknown, many: unknown): unknown {
  const joined = joinValues(many);
  if (joined) return joined;
  return single;
}

function resolveTemplateValue(data: StartupMessageData, key: string): unknown {
  if (key === "product.name") return data.product?.name;
  if (key === "product.version") return data.product?.version;
  if (key === "duration") return data.duration;
  if (key === "loopbackOrigin") return firstOrAll(data.loopbackOrigin, data.loopbackOrigins);
  if (key === "loopbackOrigins") return joinValues(data.loopbackOrigins);
  if (key === "origin") return firstOrAll(data.origin, data.origins);
  if (key === "origins") return joinValues(data.origins);
  if (key === "port") return firstOrAll(data.port, data.ports);
  if (key === "ports") return joinValues(data.ports);
  if (key === "startupMs") return data.startupMs;
  return data[key];
}

function runtimeMetadata(data: StartupMessageData): Record<string, unknown> {
  return {
    duration: data.duration,
    loopback_origin: data.loopbackOrigin,
    loopback_origins: data.loopbackOrigins,
    origin: data.origin,
    origins: data.origins,
    port: data.port,
    ports: data.ports,
    product_name: data.product?.name,
    product_version: data.product?.version,
    startup_ms: data.startupMs,
  };
}

export {
  emitStartupMessage,
  renderTemplate,
};
