import { PACKAGE_VERSION } from "#metadata";
import { toString } from "#values";

type VersionParts = {
  major: number;
  minor: number;
  patch: number;
};

function parseVersion(value: unknown): VersionParts | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u.exec(toString(value));
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function assertCompatibleForVersion(forVersion: unknown, configPath: string): void {
  const expected = parseVersion(PACKAGE_VERSION);
  const actual = parseVersion(forVersion);
  if (!actual) {
    throw new Error(`startup config forVersion is invalid: ${configPath}`);
  }
  if (!expected) return;
  if (actual.major !== expected.major || actual.minor !== expected.minor) {
    throw new Error(
      `startup config targets ${toString(forVersion)} but package is ${PACKAGE_VERSION}`,
    );
  }
}

export {
  assertCompatibleForVersion,
  parseVersion,
};
