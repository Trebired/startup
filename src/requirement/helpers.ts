import { toTrimmedString as toString } from "@trebired/utils";
import type {
  PortRequirementConfig,
  RequirementConditionConfig,
} from "#config-types";
import type { StartupRequirementContext } from "#types";

function matchesCondition(
  condition: RequirementConditionConfig | undefined,
  context: StartupRequirementContext,
): boolean {
  if (!condition) return true;
  const value = condition.env ? toString(context.env[condition.env]) : "";
  if (typeof condition.exists === "boolean" && Boolean(value) !== condition.exists) {
    return false;
  }
  const equals = normalizeStrings(condition.equals);
  if (equals.length > 0 && !equals.includes(value)) return false;
  const notEquals = normalizeStrings(condition.notEquals);
  if (notEquals.length > 0 && notEquals.includes(value)) return false;
  return true;
}

function renderRequirementTemplate(
  template: string,
  context: StartupRequirementContext,
): string {
  return template.replace(/\{([^}]+)\}/gu, (_match, keyInput: string) => {
      const key = toString(keyInput);
      if (key === "cwd") return context.cwd;
      if (key.startsWith("env.")) return toString(context.env[key.slice(4)]);
      return "";
  });
}

function resolvePortHost(
  requirement: PortRequirementConfig,
  context: StartupRequirementContext,
): string | undefined {
  return toString(requirement.host || (requirement.hostEnv ? context.env[requirement.hostEnv] : "")) || undefined;
}

function urlPartValue(url: URL, part: string): string {
  if (part === "database" || part === "pathname") return url.pathname.replace(/^\/+/u, "");
  if (part === "hash") return url.hash;
  if (part === "hostname") return url.hostname;
  if (part === "password") return url.password;
  if (part === "port") return url.port;
  if (part === "protocol") return url.protocol;
  if (part === "search") return url.search;
  if (part === "username" || part === "user") return url.username;
  return "";
}

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.password) url.password = "[redacted]";
    return url.toString();
  } catch {
    return "[invalid-url]";
  }
}

function normalizeStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => toString(entry)).filter(Boolean);
  const text = toString(value);
  return text ? [text] : [];
}

export {
  matchesCondition,
  normalizeStrings,
  redactUrl,
  renderRequirementTemplate,
  resolvePortHost,
  urlPartValue,
};
