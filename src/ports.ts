import net from "node:net";

import {
  toNumber,
  toTrimmedString as toString,
} from "@trebired/utils";
import type { NormalizedConfig, PortRequirementConfig } from "#config-types";
import type { StartupEnv } from "#types";

function parsePort(value: unknown, label = "port"): number {
  const port = toNumber(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${label} must be an integer between 1 and 65535`);
  }
  return port;
}

function resolvePort(
  requirement: PortRequirementConfig,
  env: StartupEnv = process.env,
): number {
  const raw = requirement.value ?? envValue(requirement, env) ?? requirement.defaultValue;
  return parsePort(raw, requirement.env || "port");
}

function resolvePrimaryPort(
  config: NormalizedConfig,
  env: StartupEnv = process.env,
): number | null {
  const [first] = config.requirements.ports;
  if (!first) return null;
  return resolvePort(first, env);
}

async function isPortInUse(port: number, host?: string): Promise<boolean> {
  return new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(true));
      server.once("listening", () => {
          server.close(() => resolve(false));
      });
      server.listen(port, host);
  });
}

function envValue(
  requirement: PortRequirementConfig,
  env: StartupEnv,
): string | undefined {
  const key = toString(requirement.env);
  return key ? env[key] : undefined;
}

export {
  isPortInUse,
  parsePort,
  resolvePort,
  resolvePrimaryPort,
};
