import type {
  BootstrapOptions,
  BootstrapRunReport,
  BootstrapRuntime,
  BootstrapShutdownController,
  BootstrapShutdownControllerOptions,
} from "@package/bootstrap";
import type {
  LoggerAdapterLogger,
  LoggerAdapterWriter,
  NormalizedLoggerAdapter,
} from "@package/logger-adapter";
import type { ResultLike } from "@package/result";
import type { NormalizedConfig, Config } from "#config-types";

type StartupLogLevel = "debug" | "info" | "success" | "warn" | "error" | "fail";
type StartupLogger = LoggerAdapterLogger;
type StartupLoggerAdapter = LoggerAdapterWriter;
type NormalizedStartupLogger = NormalizedLoggerAdapter;
type StartupEnv = Record<string, string|undefined>;

type StartupRequirementFailure = {
  check: string;
  status_code: string;
  message: string;
  gid?: number | null;
  key?: string;
  part?: string;
  path?: string;
  uid?: number | null;
  value?: unknown;
  error?: unknown;
};

type StartupRequirementData = {
  failures: StartupRequirementFailure[];
  ports: Record<string, number>;
};

type StartupRequirementsResult = ResultLike<StartupRequirementData>;

type StartupRequirementContext = {
  config: NormalizedConfig;
  cwd: string;
  env: StartupEnv;
  logger: NormalizedStartupLogger;
  checks?: StartupRequirementCheck[];
  isPortUsed?: (port: number, host?: string) => boolean | Promise<boolean>;
  postgresConnector?: (connectionString: string, timeoutMs: number) => Promise<void>;
  process?: StartupProcessInfo;
};

type StartupProcessInfo = {
  gid?: number | null;
  uid?: number | null;
};

type StartupRequirementCheck = (
  context: StartupRequirementContext,
) => void |StartupRequirementFailure | StartupRequirementFailure[] | Promise<void|StartupRequirementFailure|StartupRequirementFailure[]>;

type StartupMessageData = Record<string, unknown>& {
  duration?: string;
  loopbackOrigin?: string;
  origin?: string;
  port?: number | string;
  product?: {
    name?: string;
    version?: string;
  };
  startupMs?: number;
};

type StartupEarlyBootDecision = {
  handled: boolean;
  exitCode?: number;
  reason?: string;
  data?: Record<string, unknown>;
};

type StartupContext = {
  config: NormalizedConfig;
  env: StartupEnv;
  logger: NormalizedStartupLogger;
  projectRoot: string;
  startedAt: number;
};

type StartupEarlyBootAction = (
  context: StartupContext,
) => void |StartupEarlyBootDecision | Promise<void|StartupEarlyBootDecision>;

type StartupRuntimeHandle = {
  config: NormalizedConfig;
  logger: NormalizedStartupLogger;
  runtime: BootstrapRuntime;
  shutdownController: BootstrapShutdownController;
  cleanupSignals: (() => void) | null;
};

type StartupRuntimeOptions = {
  bootstrap?: BootstrapOptions | ((context: StartupContext) => BootstrapOptions);
  bindSignals?: boolean;
  checks?: StartupRequirementCheck[];
  config?: Config | NormalizedConfig;
  earlyBoot?: StartupEarlyBootAction | StartupEarlyBootAction[];
  env?: StartupEnv;
  logger?: StartupLogger;
  loggerAdapter?: StartupLoggerAdapter;
  messageData?: StartupMessageData;
  onceProcessEvent?: (signal: string, handler: () => void) => unknown;
  isPortUsed?: (port: number, host?: string) => boolean | Promise<boolean>;
  postgresConnector?: (connectionString: string, timeoutMs: number) => Promise<void>;
  process?: StartupProcessInfo;
  projectRoot?: string;
  shutdown?: Omit<BootstrapShutdownControllerOptions, "logger"|"terminate">;
  startedAt?: number;
  terminate?: (exitCode: number) => void |Promise<void>;
  terminateOnFailure?: boolean;
};

type StartupRunData = {
  bootstrap?: BootstrapRunReport;
  earlyBoot?: StartupEarlyBootDecision;
  requirements?: StartupRequirementData;
};

type StartupRunResult = ResultLike<StartupRunData>;

export type {
  NormalizedStartupLogger,
  StartupContext,
  StartupEarlyBootAction,
  StartupEarlyBootDecision,
  StartupEnv,
  StartupLogLevel,
  StartupLogger,
  StartupLoggerAdapter,
  StartupMessageData,
  StartupProcessInfo,
  StartupRequirementCheck,
  StartupRequirementContext,
  StartupRequirementData,
  StartupRequirementFailure,
  StartupRequirementsResult,
  StartupRunData,
  StartupRunResult,
  StartupRuntimeHandle,
  StartupRuntimeOptions,
};
