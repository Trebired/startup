import { formatStartupDuration } from "#time";
import {
  isRecord,
  toTrimmedString as toString,
} from "@trebired/utils";
import type { NormalizedStartupConfig } from "#config-types";
import type {
  NormalizedStartupLogger,
  StartupMessageData,
} from "#types";

type StartupMessageContext = {
  config: NormalizedStartupConfig;
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
    context.logger.log(message.level, "messages", renderTemplate(text, templateData), metadata);
  }
}

function renderTemplate(template: string, data: StartupMessageData): string {
  return template.replace(/\{([^}]+)\}/gu, (_match, key: string) => {
      const value = resolveTemplateValue(data, key);
      return value === undefined || value === null ? "" : String(value);
  });
}

function createTemplateData(
  config: NormalizedStartupConfig,
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
