import { resolveLogger as resolveSharedLogger } from "@package/logger-adapter";
import { STARTUP_PACKAGE_NAME } from "#constants";
import type {
  NormalizedStartupLogger,
  StartupLogger,
  StartupLoggerAdapter,
} from "#types";

function resolveLogger(
  logger?: StartupLogger,
  adapter?: StartupLoggerAdapter,
): NormalizedStartupLogger {
  return resolveSharedLogger({
      adapter,
      fallback: "console",
      logger,
      source: STARTUP_PACKAGE_NAME,
  }) as NormalizedStartupLogger;
}

export { resolveLogger };
