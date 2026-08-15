import type { BootstrapOptions } from "@package/bootstrap";
import type { StartupLogLevel } from "#types";

type StartupProductConfig = {
  name?: string;
  version?: string;
};

type StartupEnvRequirementsConfig = {
  required?: string[] | string;
};

type StartupRequirementConditionConfig = {
  env?: string;
  equals?: string | string[];
  notEquals?: string | string[];
  exists?: boolean;
};

type StartupValueRequirementConfig = {
  env?: string;
  value?: string | number | boolean;
  required?: boolean;
  allowed?: string[] | string;
  forbidden?: string[] | string;
  pattern?: string;
  notPattern?: string;
  statusCode?: string;
  message?: string;
  when?: StartupRequirementConditionConfig;
};

type StartupPathRequirementConfig = {
  env?: string;
  path?: string;
  kind?: "dir" | "file";
  create?: boolean;
  writable?: boolean;
  when?: StartupRequirementConditionConfig;
};

type StartupUrlRequirementConfig = {
  env?: string;
  value?: string;
  protocols?: string[] | string;
  requiredParts?: string[] | string;
  when?: StartupRequirementConditionConfig;
};

type StartupPostgresRequirementConfig = {
  env?: string;
  value?: string;
  timeoutMs?: number;
  when?: StartupRequirementConditionConfig;
};

type StartupPortRequirementConfig = {
  env?: string;
  value?: number | string;
  defaultValue?: number | string;
  host?: string;
  hostEnv?: string;
  checkAvailable?: boolean;
  when?: StartupRequirementConditionConfig;
};

type StartupRequirementsConfig = {
  env?: StartupEnvRequirementsConfig;
  values?: StartupValueRequirementConfig[];
  paths?: StartupPathRequirementConfig[];
  urls?: StartupUrlRequirementConfig[];
  postgres?: StartupPostgresRequirementConfig[];
  ports?: StartupPortRequirementConfig[];
};

type StartupLifecycleConfig = {
  shutdownSignals?: string[] | string;
  shutdownTimeoutMs?: number;
};

type StartupMessageConfig = {
  enabled?: boolean;
  level?: StartupLogLevel;
  text?: string | string[];
  metadata?: Record<string, unknown>;
};

type StartupMessagesConfig = Record<string, StartupMessageConfig|undefined>;

type StartupConfig = {
  forVersion?: string;
  product?: StartupProductConfig;
  requirements?: StartupRequirementsConfig;
  lifecycle?: StartupLifecycleConfig;
  messages?: StartupMessagesConfig;
  bootstrap?: Pick<BootstrapOptions, "dir"|"scan"|"verbose">;
};

type NormalizedStartupMessageConfig = {
  enabled: boolean;
  level: StartupLogLevel;
  text: string[];
  metadata: Record<string, unknown>;
};

type NormalizedStartupConfig = {
  forVersion: string;
  product: Required<StartupProductConfig>;
  requirements: {
    env: {
      required: string[];
    };
    values: StartupValueRequirementConfig[];
    paths: StartupPathRequirementConfig[];
    urls: Array<StartupUrlRequirementConfig& {
      protocols: string[];
      requiredParts: string[];
    }>;
    postgres: Required<StartupPostgresRequirementConfig>[];
    ports: StartupPortRequirementConfig[];
  };
  lifecycle: {
    shutdownSignals: string[];
    shutdownTimeoutMs: number;
  };
  messages: Record<string, NormalizedStartupMessageConfig>;
  bootstrap: Pick<BootstrapOptions, "dir"|"scan"|"verbose">;
};

type LoadedStartupConfig = {
  config: NormalizedStartupConfig;
  configPath: string | null;
  dependencies: string[];
};

type LoadStartupConfigOptions = {
  configPath?: string;
  defaultIfMissing?: boolean;
  searchFrom?: string;
};

export type {
  LoadedStartupConfig,
  LoadStartupConfigOptions,
  NormalizedStartupConfig,
  NormalizedStartupMessageConfig,
  StartupConfig,
  StartupEnvRequirementsConfig,
  StartupLifecycleConfig,
  StartupMessageConfig,
  StartupMessagesConfig,
  StartupPathRequirementConfig,
  StartupPortRequirementConfig,
  StartupPostgresRequirementConfig,
  StartupProductConfig,
  StartupRequirementConditionConfig,
  StartupRequirementsConfig,
  StartupUrlRequirementConfig,
  StartupValueRequirementConfig,
};
