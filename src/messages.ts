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

function resolveTemplateValue(data: StartupMessageData, key: string): unknown {
  if (key === "product.name") return data.product?.name;
  if (key === "product.version") return data.product?.version;
  if (key === "duration") return data.duration;
  if (key === "loopbackOrigin") return data.loopbackOrigin;
  if (key === "origin") return data.origin;
  if (key === "port") return data.port;
  if (key === "startupMs") return data.startupMs;
  return data[key];
}

function runtimeMetadata(data: StartupMessageData): Record<string, unknown> {
  return {
    duration: data.duration,
    loopback_origin: data.loopbackOrigin,
    origin: data.origin,
    port: data.port,
    product_name: data.product?.name,
    product_version: data.product?.version,
    startup_ms: data.startupMs,
  };
}

export {
  emitStartupMessage,
  renderTemplate,
};
