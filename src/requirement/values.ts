import {
  matchesCondition,
  normalizeStrings,
  renderRequirementTemplate,
} from "./helpers.js";
import { toTrimmedString as toString } from "@trebired/utils";
import type { NormalizedStartupConfig } from "#config-types";
import type {
  StartupRequirementContext,
  StartupRequirementFailure,
} from "#types";

function checkValues(context: StartupRequirementContext): StartupRequirementFailure[] {
  const failures: StartupRequirementFailure[] = [];
  for (const requirement of context.config.requirements.values) {
    if (!matchesCondition(requirement.when, context)) continue;
    const label = requirement.env || "value";
    const value = resolveRequirementValue(requirement, context);
    if (!value) {
      if (requirement.required === false) continue;
      failures.push(valueFailure(
          requirement,
          "startup-value-missing",
          `Missing required value ${label}`,
          { key: requirement.env },
      ));
      continue;
    }
    failures.push(...validateRequirementValue(requirement, value, label));
  }
  return failures;
}

function validateRequirementValue(
  requirement: NormalizedStartupConfig["requirements"]["values"][number],
  value: string,
  label: string,
): StartupRequirementFailure[] {
  const failures: StartupRequirementFailure[] = [];
  const base = {
    key: requirement.env,
    value: redactedRequirementValue(label, value),
  };
  const allowed = normalizeStrings(requirement.allowed);
  const forbidden = normalizeStrings(requirement.forbidden);
  if (allowed.length > 0 && !allowed.includes(value)) {
    failures.push(valueFailure(
        requirement,
        "startup-value-not-allowed",
        `${label} is not allowed`,
        base,
    ));
  }
  if (forbidden.includes(value)) {
    failures.push(valueFailure(
        requirement,
        "startup-value-forbidden",
        `${label} is forbidden`,
        base,
    ));
  }
  if (requirement.pattern && !matchesPattern(value, requirement.pattern)) {
    failures.push(valueFailure(
        requirement,
        "startup-value-pattern-mismatch",
        `${label} format is invalid`,
        base,
    ));
  }
  if (requirement.notPattern && matchesPattern(value, requirement.notPattern)) {
    failures.push(valueFailure(
        requirement,
        "startup-value-pattern-forbidden",
        `${label} format is forbidden`,
        base,
    ));
  }
  return failures;
}

function valueFailure(
  requirement: NormalizedStartupConfig["requirements"]["values"][number],
  fallbackStatus: string,
  fallbackMessage: string,
  extra: Partial<StartupRequirementFailure>,
): StartupRequirementFailure {
  return {
    check: "value",
    message: requirement.message || fallbackMessage,
    status_code: requirement.statusCode || fallbackStatus,
    ...extra,
  };
}

function resolveRequirementValue(
  requirement: NormalizedStartupConfig["requirements"]["values"][number],
  context: StartupRequirementContext,
): string {
  const raw = requirement.value ?? (requirement.env ? context.env[requirement.env] : "");
  return renderRequirementTemplate(toString(raw), context);
}

function matchesPattern(value: string, pattern: string): boolean {
  try {
    return new RegExp(pattern, "u").test(value);
  } catch {
    return false;
  }
}

function redactedRequirementValue(label: string, value: string): string {
  return /(secret|token|password|private|key|database_url)/iu.test(label)
  ? "[redacted]"
  : value;
}

export {
  checkValues,
};
