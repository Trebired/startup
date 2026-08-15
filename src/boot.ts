import {
  isRecord,
  toTrimmedString as toString,
} from "@trebired/utils";

type ParsedTokenFlags<TFlag extends string> = Record<TFlag, boolean>;

type PairedEnvValues = {
  enabled: boolean;
  missingKeys: string[];
  values: Record<string, string>;
};

function parseTokenSet(value: unknown): Set<string> {
  return new Set(
    toString(value)
    .toLowerCase()
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean),
  );
}

function parseTokenFlags<TFlag extends string>(
  value: unknown,
  flags: readonly TFlag[],
): ParsedTokenFlags<TFlag> {
  const tokens = parseTokenSet(value);
  const parsed = {} as ParsedTokenFlags<TFlag>;
  for (const flag of flags) parsed[flag] = tokens.has(flag);
  return Object.freeze(parsed);
}

function hasAnyTokenFlag<TFlag extends string>(
  flags: Partial<Record<TFlag, boolean>>,
  keys?: readonly TFlag[],
): boolean {
  const entries = keys || Object.keys(flags) as TFlag[];
  return entries.some((key) => flags[key] === true);
}

function readPairedEnvValues(
  env: unknown,
  keys: readonly string[],
): PairedEnvValues {
  const values: Record<string, string> = {};
  const missingKeys: string[] = [];
  const source = isRecord(env) ? env : {};

  for (const key of keys) {
    const value = toString(source[key]);
    values[key] = value;
    if (!value) missingKeys.push(key);
  }

  const somePresent = missingKeys.length > 0 && missingKeys.length < keys.length;
  if (somePresent) {
    throw new Error(`startup-paired-env-incomplete:${missingKeys.join(",")}`);
  }

  return {
    enabled: keys.length > 0 && missingKeys.length === 0,
    missingKeys,
    values,
  };
}

export {
  hasAnyTokenFlag,
  parseTokenFlags,
  parseTokenSet,
  readPairedEnvValues,
};

export type {
  PairedEnvValues,
  ParsedTokenFlags,
};
