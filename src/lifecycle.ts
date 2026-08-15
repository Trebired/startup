import { errorMessage, toTrimmedString as toString } from "@trebired/utils";

import { STARTUP_LOG_GROUP } from "#constants";
import { resolveLogger } from "#logging";
import type {
  StartupLogger,
  StartupLoggerAdapter,
} from "#types";

type LifecycleFailureInput = {
  exitCode?: number;
  message?: string;
  meta?: Record<string, unknown>|null;
  reason?: string;
  statusCode?: string;
};

type LifecycleFailureHandler = (
  input: Required<Omit<LifecycleFailureInput, "meta">>& {
    meta: Record<string, unknown>;
  },
) => void |Promise<void>;

type LifecycleFailureController = {
  request: (input?: LifecycleFailureInput) => Promise<void|null>;
  setHandler: (handler: LifecycleFailureHandler | null) => void;
};

type LifecycleFailureControllerOptions = {
  defaultExitCode?: number;
  defaultMessage?: string;
  defaultReason?: string;
  defaultStatusCode?: string;
  group?: string;
  logger?: StartupLogger;
  loggerAdapter?: StartupLoggerAdapter;
};

function createLifecycleFailureController(
  options: LifecycleFailureControllerOptions = {},
): LifecycleFailureController {
  const state = createLifecycleFailureState(options);
  return {
    request(input = {}) {
      return requestLifecycleFailure(state, input);
    },
    setHandler(handler) {
      state.handler = typeof handler === "function" ? handler : null;
    },
  };
}

function createLifecycleFailureState(options: LifecycleFailureControllerOptions) {
  return {
    defaultExitCode: validExitCode(options.defaultExitCode, 1),
    defaultMessage: toString(options.defaultMessage) || "startup-lifecycle-failure-requested",
    defaultReason: toString(options.defaultReason) || "startup-unavailable",
    defaultStatusCode: toString(options.defaultStatusCode) || "startup-unavailable",
    group: toString(options.group) || `${STARTUP_LOG_GROUP}.lifecycle`,
    handler: null as LifecycleFailureHandler | null,
    logger: resolveLogger(options.logger, options.loggerAdapter),
    promise: null as Promise<void>|null,
  };
}

async function requestLifecycleFailure(
  state: ReturnType<typeof createLifecycleFailureState>,
  input: LifecycleFailureInput,
): Promise<void|null> {
  if (state.promise) return state.promise;
  if (!state.handler) return null;

  const failure = normalizeLifecycleFailure(state, input);
  state.logger.fail(state.group, "lifecycle failure requested", {
      reason: failure.reason,
      status_code: failure.statusCode,
      message: failure.message,
      exit_code: failure.exitCode,
      ...failure.meta,
  });

  state.promise = Promise.resolve(state.handler(failure))
  .catch ((error) => {
      state.promise = null;
      state.logger.fail(state.group, "lifecycle failure handler failed", {
          error: errorMessage(error),
      });
      throw error;
  });

  return state.promise;
}

function normalizeLifecycleFailure(
  state: ReturnType<typeof createLifecycleFailureState>,
  input: LifecycleFailureInput,
) {
  return {
    exitCode: validExitCode(input.exitCode, state.defaultExitCode),
    message: toString(input.message) || state.defaultMessage,
    meta: input.meta && typeof input.meta === "object" ? input.meta : {},
    reason: toString(input.reason) || state.defaultReason,
    statusCode: toString(input.statusCode) || state.defaultStatusCode,
  };
}

function validExitCode(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export { createLifecycleFailureController };

export type {
  LifecycleFailureController,
  LifecycleFailureControllerOptions,
  LifecycleFailureHandler,
  LifecycleFailureInput,
};
