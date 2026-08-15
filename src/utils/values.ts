function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function uniqueStrings(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return Array.from(new Set(values.map(toString).filter(Boolean)));
}

function pickDefined<TValue extends Record<string, unknown>>(input: TValue): Partial<TValue> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<TValue>;
}

function cleanProtocol(value: unknown): string {
  return toString(value).toLowerCase().replace(/:$/u, "");
}

export {
  cleanProtocol,
  isRecord,
  pickDefined,
  toNumber,
  toString,
  uniqueStrings,
};
