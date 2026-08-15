import { bootstrap } from "@package/bootstrap";

import { resolveLogger } from "#logging";
import { startupMark } from "#time";
import type { BootstrapOptions } from "@package/bootstrap";
import type {
  StartupLogger,
  StartupLoggerAdapter,
} from "#types";

type BootstrapDiscoveredFilesOptions = BootstrapOptions& {
  after?: () => unknown | Promise<unknown>;
  label?: string;
  logger?: StartupLogger;
  loggerAdapter?: StartupLoggerAdapter;
};

function bootstrapOptionsFrom(
  options: BootstrapDiscoveredFilesOptions,
): BootstrapOptions {
  const copied = { ...options } as Record<string, unknown>;
  delete copied.after;
  delete copied.label;
  delete copied.logger;
  delete copied.loggerAdapter;
  return copied as BootstrapOptions;
}

async function bootstrapDiscoveredFiles(
  options: BootstrapDiscoveredFilesOptions,
): Promise<void> {
  const after = options.after;
  const label = options.label || "bootstrap files";
  const logger = options.logger;
  const loggerAdapter = options.loggerAdapter;
  const bootstrapOptions = bootstrapOptionsFrom(options);
  const normalizedLogger = resolveLogger(logger, loggerAdapter);
  const done = startupMark(normalizedLogger, label);
  const bootstrapLogger = (bootstrapOptions.logger || logger) as BootstrapOptions["logger"];
  const bootstrapLoggerAdapter =
  (bootstrapOptions.loggerAdapter || loggerAdapter) as BootstrapOptions["loggerAdapter"];
  await bootstrap({
      ...bootstrapOptions,
      log: bootstrapOptions.log || logger,
      logger: bootstrapLogger,
      loggerAdapter: bootstrapLoggerAdapter,
  });
  done();
  await after?.();
}

export { bootstrapDiscoveredFiles };
export type { BootstrapDiscoveredFilesOptions };
