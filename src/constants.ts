import { buildPackageLogGroup, PACKAGE_NAME } from "#metadata";

const STARTUP_LOG_GROUP = buildPackageLogGroup();
const STARTUP_PACKAGE_NAME = PACKAGE_NAME;
const STARTUP_PROJECT_CONFIG_PATH = ".trebired/startup/config.ts";
const DEFAULT_SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

export {
  DEFAULT_SHUTDOWN_SIGNALS,
  STARTUP_LOG_GROUP,
  STARTUP_PACKAGE_NAME,
  STARTUP_PROJECT_CONFIG_PATH,
};
