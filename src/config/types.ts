import type { BootstrapOptions } from "@package/bootstrap";
import type { StartupLogLevel } from "#types";

type ProductConfig = {
  name?: string;
  version?: string;
};

type EnvRequirementsConfig = {
  required?: string[] | string;
};

type RequirementConditionConfig = {
  env?: string;
  equals?: string | string[];
  notEquals?: string | string[];
  exists?: boolean;
};

type ValueRequirementConfig = {
  env?: string;
  value?: string | number | boolean;
  required?: boolean;
  allowed?: string[] | string;
  forbidden?: string[] | string;
  pattern?: string;
  notPattern?: string;
  statusCode?: string;
  message?: string;
  when?: RequirementConditionConfig;
};

type PathRequirementConfig = {
  env?: string;
  path?: string;
  kind?: "dir" | "file";
  create?: boolean;
  writable?: boolean;
  when?: RequirementConditionConfig;
};

type UrlRequirementConfig = {
  env?: string;
  value?: string;
  protocols?: string[] | string;
  requiredParts?: string[] | string;
  when?: RequirementConditionConfig;
};

type PostgresRequirementConfig = {
  env?: string;
  value?: string;
  timeoutMs?: number;
  when?: RequirementConditionConfig;
};

type PortRequirementConfig = {
  env?: string;
  value?: number | string;
  defaultValue?: number | string;
  host?: string;
  hostEnv?: string;
  checkAvailable?: boolean;
  when?: RequirementConditionConfig;
};

type ProcessRequirementConfig = {
  root?: boolean;
  uid?: number | string;
  gid?: number | string;
  statusCode?: string;
  message?: string;
  when?: RequirementConditionConfig;
};

type RequirementsConfig = {
  env?: EnvRequirementsConfig;
  values?: ValueRequirementConfig[];
  paths?: PathRequirementConfig[];
  urls?: UrlRequirementConfig[];
  postgres?: PostgresRequirementConfig[];
  ports?: PortRequirementConfig[];
  process?: ProcessRequirementConfig;
};

type LifecycleConfig = {
  shutdownSignals?: string[] | string;
  shutdownTimeoutMs?: number;
};

type MessageConfig = {
  enabled?: boolean;
  level?: StartupLogLevel;
  preset?: string;
  text?: string | string[];
  metadata?: Record<string, unknown>;
};

type MessagesConfig = Record<string, MessageConfig|undefined>;

type Config = {
  forVersion?: string;
  product?: ProductConfig;
  requirements?: RequirementsConfig;
  lifecycle?: LifecycleConfig;
  messages?: MessagesConfig;
  bootstrap?: Pick<BootstrapOptions, "dir"|"scan"|"verbose">;
};

type NormalizedMessageConfig = {
  enabled: boolean;
  level: StartupLogLevel;
  text: string[];
  metadata: Record<string, unknown>;
};

type NormalizedConfig = {
  forVersion: string;
  product: Required<ProductConfig>;
  requirements: {
    env: {
      required: string[];
    };
    values: ValueRequirementConfig[];
    paths: PathRequirementConfig[];
    urls: Array<UrlRequirementConfig& {
      protocols: string[];
      requiredParts: string[];
    }>;
    postgres: Required<PostgresRequirementConfig>[];
    ports: PortRequirementConfig[];
    process: ProcessRequirementConfig;
  };
  lifecycle: {
    shutdownSignals: string[];
    shutdownTimeoutMs: number;
  };
  messages: Record<string, NormalizedMessageConfig>;
  bootstrap: Pick<BootstrapOptions, "dir"|"scan"|"verbose">;
};

type LoadedConfig = {
  config: NormalizedConfig;
  configPath: string | null;
  dependencies: string[];
};

type LoadConfigOptions = {
  configPath?: string;
  defaultIfMissing?: boolean;
  searchFrom?: string;
};

export type {
  LoadedConfig,
  LoadConfigOptions,
  NormalizedConfig,
  NormalizedMessageConfig,
  Config,
  EnvRequirementsConfig,
  LifecycleConfig,
  MessageConfig,
  MessagesConfig,
  PathRequirementConfig,
  PortRequirementConfig,
  PostgresRequirementConfig,
  ProcessRequirementConfig,
  ProductConfig,
  RequirementConditionConfig,
  RequirementsConfig,
  UrlRequirementConfig,
  ValueRequirementConfig,
};
