import { errorMessage } from "@trebired/utils";

import { STARTUP_LOG_GROUP } from "#constants";
import { resolveLogger } from "#logging";
import { startupMark } from "#time";
import type {
  NormalizedStartupLogger,
  StartupLogger,
  StartupLoggerAdapter,
} from "#types";

type StartupCleanup = () => void |Promise<void>;

type StartupTaskManagerOptions = {
  logger?: StartupLogger;
  loggerAdapter?: StartupLoggerAdapter;
  unrefTimers?: boolean;
};

type StartupScheduledTaskOptions = {
  delayMs?: number;
  label: string;
  metadata?: Record<string, unknown>;
  run: () => void |Promise<void>;
};

type StartupServiceOptions = {
  label: string;
  metadata?: Record<string, unknown>;
  start: () => unknown;
  stop?: StartupCleanup;
};

type StartupStep = {
  id: string;
  label?: string;
  metadata?: Record<string, unknown>;
  run: () => unknown | Promise<unknown>;
};

type StartupStepRunOptions = {
  continueOnError?: boolean;
  logger?: StartupLogger;
  loggerAdapter?: StartupLoggerAdapter;
};

type StartupTaskManager = {
  logger: NormalizedStartupLogger;
  own: (cleanup: StartupCleanup | { stop?: StartupCleanup } | null | undefined) => void;
  schedule: (options: StartupScheduledTaskOptions) => ReturnType<typeof setTimeout>;
  startService: (options: StartupServiceOptions) => void;
  stop: () => void;
};

function createStartupTaskManager(
  options: StartupTaskManagerOptions = {},
): StartupTaskManager {
  const logger = resolveLogger(options.logger, options.loggerAdapter);
  const cleanup: StartupCleanup[] = [];
  return {
    logger,
    own: (target) => ownCleanup(cleanup, target),
    schedule: (task) => scheduleStartupTask(cleanup, logger, options, task),
    startService: (service) => startStartupService(cleanup, logger, service),
    stop: () => stopStartupCleanups(cleanup, logger),
  };
}

async function runStartupSteps(
  steps: StartupStep[],
  options: StartupStepRunOptions = {},
): Promise<void> {
  const logger = resolveLogger(options.logger, options.loggerAdapter);
  for (const step of steps) await runStartupStep(step, logger, options);
}

async function runStartupStep(
  step: StartupStep,
  logger: NormalizedStartupLogger,
  options: StartupStepRunOptions,
) {
  const metadata = taskMetadata(step.label || step.id, step.metadata);
  const done = startupMark(logger, step.label || step.id);
  try {
    await step.run();
    done(step.metadata || {});
  } catch (error) {
    logger.warn(taskLogGroup(), "step failed", {
        error: errorMessage(error),
        step_id: step.id,
        ...metadata,
    });
    if (options.continueOnError === false) throw error;
  }
}

function scheduleStartupTask(
  cleanup: StartupCleanup[],
  logger: NormalizedStartupLogger,
  managerOptions: StartupTaskManagerOptions,
  task: StartupScheduledTaskOptions,
) {
  const delayMs = Number.isFinite(Number(task.delayMs)) ? Number(task.delayMs) : 0;
  const metadata = taskMetadata(task.label, { delay_ms: delayMs, ...(task.metadata || {}) });
  const timer = setTimeout(() => runScheduledTask(logger, task, metadata), delayMs);
  if (managerOptions.unrefTimers !== false && typeof timer.unref === "function") timer.unref();
  cleanup.push(() => clearTimeout(timer));
  return timer;
}

function runScheduledTask(
  logger: NormalizedStartupLogger,
  task: StartupScheduledTaskOptions,
  metadata: Record<string, unknown>,
) {
  Promise.resolve()
  .then(() => task.run())
  .catch ((error) => {
      logger.warn(taskLogGroup(), "task failed", {
          error: errorMessage(error),
          ...metadata,
      });
  });
}

function startStartupService(
  cleanup: StartupCleanup[],
  logger: NormalizedStartupLogger,
  service: StartupServiceOptions,
) {
  const metadata = taskMetadata(service.label, service.metadata);
  try {
    const handle = service.start();
    ownCleanup(cleanup, service.stop || handle);
    logger.info(taskLogGroup(), "service started", metadata);
  } catch (error) {
    logger.warn(taskLogGroup(), "service failed", {
        error: errorMessage(error),
        ...metadata,
    });
  }
}

function ownCleanup(
  cleanup: StartupCleanup[],
  target: StartupCleanup | { stop?: StartupCleanup } | null | undefined | unknown,
) {
  if (typeof target === "function") cleanup.push(target as StartupCleanup);
  else if (target && typeof target === "object" && typeof(target as { stop?: unknown }).stop === "function") {
    cleanup.push(() => (target as { stop: StartupCleanup }).stop());
  }
}

function stopStartupCleanups(
  cleanup: StartupCleanup[],
  logger: NormalizedStartupLogger,
) {
  for (const run of cleanup.splice(0).reverse()) {
    try {
      Promise.resolve(run()).catch ((error) => logCleanupFailure(logger, error));
    } catch (error) {
      logCleanupFailure(logger, error);
    }
  }
}

function logCleanupFailure(
  logger: NormalizedStartupLogger,
  error: unknown,
) {
  logger.warn(taskLogGroup(), "cleanup failed", { error: errorMessage(error) });
}

function taskMetadata(label: string, metadata?: Record<string, unknown>): Record<string, unknown> {
  return {
    ...(metadata || {}),
    label,
  };
}

function taskLogGroup(): string {
  return `${STARTUP_LOG_GROUP}.tasks`;
}

export {
  createStartupTaskManager,
  runStartupSteps,
};

export type {
  StartupCleanup,
  StartupScheduledTaskOptions,
  StartupServiceOptions,
  StartupStep,
  StartupStepRunOptions,
  StartupTaskManager,
  StartupTaskManagerOptions,
};
