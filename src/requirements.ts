import { constants as fsConstants, type Stats } from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";

import { ok, unavailable } from "@package/result";

import { normalizeConfig } from "#config-normalize";
import { STARTUP_LOG_GROUP } from "#constants";
import { isPortInUse, parsePort, resolvePort } from "#ports";
import {
  matchesCondition,
  redactUrl,
  renderRequirementTemplate,
  resolvePortHost,
  urlPartValue,
} from "./requirement/helpers.js";
import { checkValues } from "./requirement/values.js";
import { toTrimmedString as toString } from "@trebired/utils";
import type { NormalizedConfig, Config } from "#config-types";
import type {
  StartupRequirementContext,
  StartupRequirementData,
  StartupRequirementFailure,
  StartupRequirementsResult,
} from "#types";

async function checkRequirements(
  config: NormalizedConfig | Config,
  context: Omit<StartupRequirementContext, "config">,
): Promise<StartupRequirementsResult> {
  const fullContext: StartupRequirementContext = {
    ...context,
    config: normalizeConfig(config, { requireForVersion: true }),
  };
  const failures = [
    ...checkRequiredEnv(fullContext),
    ...checkValues(fullContext),
    ...await checkPaths(fullContext),
    ...checkUrls(fullContext),
    ...await checkPorts(fullContext),
    ...await checkPostgres(fullContext),
    ...await checkCustom(fullContext),
  ];
  return requirementResult(fullContext, failures);
}

function checkRequiredEnv(context: StartupRequirementContext): StartupRequirementFailure[] {
  return context.config.requirements.env.required
  .filter((key) => !toString(context.env[key]))
  .map((key) => failure("env", "startup-env-missing", `Missing required env ${key}`, { key }));
}

async function checkPaths(context: StartupRequirementContext): Promise<StartupRequirementFailure[]> {
  const failures: StartupRequirementFailure[] = [];
  for (const requirement of context.config.requirements.paths) {
    if (!matchesCondition(requirement.when, context)) continue;
    const target = resolvePathRequirement(requirement, context);
    if (!target) {
      failures.push(failure("path", "startup-path-missing", "Path requirement has no path", requirement));
      continue;
    }
    const found = await checkPathTarget(target, requirement, context.cwd);
    if (found) failures.push(found);
  }
  return failures;
}

function resolvePathRequirement(
  requirement: NormalizedConfig["requirements"]["paths"][number],
  context: StartupRequirementContext,
): string {
  const envPath = requirement.env ? context.env[requirement.env] : "";
  return renderRequirementTemplate(toString(requirement.path || envPath), context);
}

async function checkPathTarget(
  target: string,
  requirement: NormalizedConfig["requirements"]["paths"][number],
  cwd: string,
): Promise<StartupRequirementFailure|null> {
  const absolutePath = path.resolve(cwd, target);
  try {
    if (requirement.create && requirement.kind !== "file") await fsPromises.mkdir(absolutePath, { recursive: true });
    const stat = await fsPromises.stat(absolutePath);
    const kindFailure = checkPathKind(stat, requirement.kind || "dir", absolutePath);
    if (kindFailure) return kindFailure;
    if (requirement.writable) await fsPromises.access(absolutePath, fsConstants.W_OK);
    return null;
  } catch (error) {
    return failure("path", "startup-path-invalid", "Path requirement failed", {
        error,
        path: absolutePath,
    });
  }
}

function checkPathKind(stat: Stats, kind: "dir" | "file", filePath: string) {
  if (kind === "dir" && !stat.isDirectory()) {
    return failure("path", "startup-path-not-dir", "Path is not a directory", { path: filePath });
  }
  if (kind === "file" && !stat.isFile()) {
    return failure("path", "startup-path-not-file", "Path is not a file", { path: filePath });
  }
  return null;
}

async function checkCustom(context: StartupRequirementContext): Promise<StartupRequirementFailure[]> {
  const failures: StartupRequirementFailure[] = [];
  for (const check of context.checks || []) {
    const result = await check(context);
    if (Array.isArray(result)) failures.push(...result);
    else if (result) failures.push(result);
  }
  return failures;
}

function checkUrls(context: StartupRequirementContext): StartupRequirementFailure[] {
  return context.config.requirements.urls.flatMap((requirement) => {
      if (!matchesCondition(requirement.when, context)) return [];
      const value = toString(requirement.value || (requirement.env ? context.env[requirement.env] : ""));
      if (!value) return [failure("url", "startup-url-missing", "URL requirement has no value", requirement)];
      return validateUrl(value, requirement.protocols, requirement.requiredParts);
  });
}

function validateUrl(
  value: string,
  protocols: string[],
  requiredParts: string[],
): StartupRequirementFailure[] {
  try {
    const url = new URL(value);
    const protocol = cleanProtocol(url.protocol);
    if (protocols.length > 0 && !protocols.includes(protocol)) {
      return [failure("url", "startup-url-protocol-invalid", "URL protocol is not allowed", { value })];
    }
    const missingPart = requiredParts.find((part) => !urlPartValue(url, part));
    if (missingPart) {
      return [failure("url", "startup-url-part-missing", `URL is missing ${missingPart}`, {
            part: missingPart,
            value: redactUrl(value),
      })];
    }
    return [];
  } catch (error) {
    return [failure("url", "startup-url-invalid", "URL is invalid", { error, value })];
  }
}

async function checkPorts(context: StartupRequirementContext): Promise<StartupRequirementFailure[]> {
  const failures: StartupRequirementFailure[] = [];
  for (const requirement of context.config.requirements.ports) {
    if (!matchesCondition(requirement.when, context)) continue;
    try {
      const port = resolvePort(requirement, context.env);
      const host = resolvePortHost(requirement, context);
      if (requirement.checkAvailable === false) continue;
      const occupied = context.isPortUsed
      ? await context.isPortUsed(port, host)
      : await isPortInUse(port, host);
      if (occupied) failures.push(failure("port", "startup-port-occupied", "Port is already in use", { value: port }));
    } catch (error) {
      failures.push(failure("port", "startup-port-invalid", "Port requirement failed", { error }));
    }
  }
  return failures;
}

async function checkPostgres(context: StartupRequirementContext): Promise<StartupRequirementFailure[]> {
  const failures: StartupRequirementFailure[] = [];
  for (const requirement of context.config.requirements.postgres) {
    if (!matchesCondition(requirement.when, context)) continue;
    const connectionString = toString(requirement.value || context.env[requirement.env]);
    if (!connectionString) {
      failures.push(failure("postgres", "startup-postgres-url-missing", "PostgreSQL URL is missing", requirement));
      continue;
    }
    const found = await checkPostgresConnection(context, connectionString, requirement.timeoutMs);
    if (found) failures.push(found);
  }
  return failures;
}

async function checkPostgresConnection(
  context: StartupRequirementContext,
  connectionString: string,
  timeoutMs: number,
): Promise<StartupRequirementFailure|null> {
  try {
    if (context.postgresConnector) await context.postgresConnector(connectionString, timeoutMs);
    else await connectPostgres(connectionString, timeoutMs);
    return null;
  } catch (error) {
    return failure("postgres", "startup-postgres-unavailable", "PostgreSQL check failed", { error });
  }
}

async function connectPostgres(connectionString: string, timeoutMs: number): Promise<void> {
  const pg = await importOptionalPg();
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: timeoutMs });
  try {
    await client.connect();
    await client.query("select 1");
  } finally {
    await client.end().catch (() => undefined);
  }
}

async function importOptionalPg(): Promise<{Client:new(options:unknown)=>PgClient}> {
  try {
    return await Function("specifier", "return import(specifier)")("pg");
  } catch (error) {
    throw new Error(`pg optional peer dependency is not available: ${error}`);
  }
}

type PgClient = {
  connect: () => Promise<void>;
  query: (sql: string) => Promise<unknown>;
  end: () => Promise<void>;
};

function requirementResult(
  context: StartupRequirementContext,
  failures: StartupRequirementFailure[],
): StartupRequirementsResult {
  const data = { failures, ports: collectPorts(context) };
  if (failures.length === 0) {
    context.logger.log("success", requirementLogGroup(), "requirements:ok", { ports: data.ports });
    return ok<StartupRequirementData>("startup-requirements-ok", { data, message: false });
  }
  context.logger.fail(requirementLogGroup(), "requirements:failed", { failures });
  return unavailable<StartupRequirementData>("startup-requirements-failed", { data, message: false });
}

function collectPorts(context: StartupRequirementContext): Record<string, number> {
  const ports: Record<string, number> = {};
  for (const requirement of context.config.requirements.ports) {
    try {
      const key = requirement.env || "port";
      ports[key] = parsePort(resolvePort(requirement, context.env), key);
    } catch {
      continue;
    }
  }
  return ports;
}

function resolveRequirementValue(
  requirement: NormalizedConfig["requirements"]["values"][number],
  context: StartupRequirementContext,
): string {
  const raw = requirement.value ?? (requirement.env ? context.env[requirement.env] : "");
  return renderRequirementTemplate(toString(raw), context);
}

function requirementLogGroup(): string {
  return `${STARTUP_LOG_GROUP}.requirements`;
}

function failure(
  check: string,
  status_code: string,
  message: string,
  extra: Partial<StartupRequirementFailure> = {},
): StartupRequirementFailure {
  return { check, status_code, message, ...extra };
}

function cleanProtocol(value: unknown): string {
  return toString(value).toLowerCase().replace(/:$/u, "");
}

export {
  checkRequirements,
};
