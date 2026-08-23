import type { StartupLogLevel } from "#types";

type MessagePreset = {
  level: StartupLogLevel;
  text: string[];
};

type MessagePresetRegistry = Record<string, Record<string, MessagePreset>>;

const DEFAULT_PRESET_NAME = "prose";

/**
 * Presets are grouped by message key so a `ready` style cannot be selected for
 * `welcome`. `prose` is the default for every key and carries the text this
 * package has always emitted, so an app that sets no preset is unaffected.
 */
const MESSAGE_PRESETS: MessagePresetRegistry = {
  ready: {
    minimal: {
      level: "info",
      text: ["Ready :: {port}"],
    },
    prose: {
      level: "success",
      text: ["Server is ready on port {port}. Startup took {duration}."],
    },
    raw: {
      level: "success",
      text: ["Server ready :: {origin}"],
    },
    timed: {
      level: "success",
      text: ["Server ready :: {origin} ({duration})"],
    },
  },
  welcome: {
    banner: {
      level: "success",
      text: ["{product.name} {product.version}", "Starting…"],
    },
    minimal: {
      level: "info",
      text: ["{product.name} {product.version}"],
    },
    prose: {
      level: "success",
      text: ["Welcome to {product.name} {product.version}"],
    },
  },
};

function messagePresetNames(key: string): string[] {
  return Object.keys(MESSAGE_PRESETS[key] || {}).sort();
}

function hasMessagePresets(key: string): boolean {
  return Boolean(MESSAGE_PRESETS[key]);
}

/**
 * An unknown preset throws rather than falling back, so a typo cannot silently
 * produce different output than the config asked for.
 */
function resolveMessagePreset(key: string, name?: string): MessagePreset | null {
  const presets = MESSAGE_PRESETS[key];
  if (!presets) {
    if (name) {
      throw new Error(`startup message "${key}" has no presets, but preset "${name}" was requested`);
    }
    return null;
  }
  const requested = String(name || "").trim();
  if (!requested) return presets[DEFAULT_PRESET_NAME] || null;
  const preset = presets[requested];
  if (!preset) {
    throw new Error(
      `startup message "${key}" has no preset "${requested}" :: available: ${messagePresetNames(key).join(", ")}`,
    );
  }
  return preset;
}

export {
  DEFAULT_PRESET_NAME,
  MESSAGE_PRESETS,
  hasMessagePresets,
  messagePresetNames,
  resolveMessagePreset,
};
export type { MessagePreset, MessagePresetRegistry };
