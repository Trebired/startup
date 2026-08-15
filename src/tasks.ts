import {
  errorMessage,
  toTrimmedString as toString,
} from "@trebired/utils";

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
  group?: string;
  logger?: StartupLogger;
  loggerAdapter?: StartupLoggerAdapter;
  unrefTimers?: boolean;
};

type StartupScheduledTaskOptions = {
  completeMessage?: string;
  delayMs?: number;
  failureGroup?: string;
  failureMessage?: string;
  label: string;
  metadata?: Record<string, unknown>;
  run: () => void |Promise<void>;
  runMessage?: string;
  scheduleMessage?: string;
};

type StartupServiceOptions = {
  failureGroup?: string;
  failureMessage?: string;
  group?: string;
  label: string;
  metadata?: Record<string, unknown>;
  start: () => unknown;
  startMessage?: string;
  startedMessage?: string;
  stop?: StartupCleanup;
};

type StartupStep = {
  failureGroup?: string;
  failureMessage?: string;
  group?: string;
  id: string;
  label?: string;
  metadata?: Record<string, unknown>;
  run: () => unknown | Promise<unknown>;
};

type StartupStepRunOptions = {
  continueOnError?: boolean;
  group?: string;
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
  const group = taskGroup(options.group);
  const cleanup: StartupCleanup[] = [];
  return {
    logger,
    own: (target) => ownCleanup(cleanup, target),
    schedule: (task) => scheduleStartupTask(cleanup, logger, group, options, task),
    startService: (service) => startStartupService(cleanup, logger, group, service),
    stop: () => stopStartupCleanups(cleanup, logger, group),
  };
}

async function runStartupSteps(
  steps: StartupStep[],
  options: StartupStepRunOptions = {},
): Promise<void> {
  const logger = resolveLogger(options.logger, options.loggerAdapter);
  const group = taskGroup(options.group);
  for (const step of steps) await runStartupStep(step, logger, group, options);
}

async function runStartupStep(
  step: StartupStep,
  logger: NormalizedStartupLogger,
  group: string,
  options: StartupStepRunOptions,
) {
  const done = startupMark(logger, step.label || step.id);
  try {
    await step.run();
    done(step.metadata || {});
  } catch (error) {
    logger.warn(step.failureGroup || step.group || group, step.failureMessage || `${step.id} failed`, {
        error: errorMessage(error),
        ...(step.metadata || {}),
    });
    if (options.continueOnError === false) throw error;
  }
}

function scheduleStartupTask(
  cleanup: StartupCleanup[],
  logger: NormalizedStartupLogger,
  group: string,
  managerOptions: StartupTaskManagerOptions,
  task: StartupScheduledTaskOptions,
) {
  const delayMs = Number.isFinite(Number(task.delayMs)) ? Number(task.delayMs) : 0;
  const metadata = { delay_ms: delayMs, ...(task.metadata || {}) };
  if (task.scheduleMessage) logger.info(group, task.scheduleMessage, metadata);
  const timer = setTimeout(() => runScheduledTask(logger, group, task, metadata), delayMs);
  if (managerOptions.unrefTimers !== false && typeof timer.unref === "function") timer.unref();
  cleanup.push(() => clearTimeout(timer));
  return timer;
}

function runScheduledTask(
  logger: NormalizedStartupLogger,
  group: string,
  task: StartupScheduledTaskOptions,
  metadata: Record<string, unknown>,
) {
  Promise.resolve()
  .then(() => {
      if (task.runMessage) logger.info(group, task.runMessage, metadata);
      return task.run();
  })
  .then(() => {
      if (task.completeMessage) logger.info(group, task.completeMessage, metadata);
  })
  .catch ((error) => {
      logger.warn(task.failureGroup || group, task.failureMessage || `${task.label} failed`, {
          error: errorMessage(error),
          ...metadata,
      });
  });
}

function startStartupService(
  cleanup: StartupCleanup[],
  logger: NormalizedStartupLogger,
  defaultGroup: string,
  service: StartupServiceOptions,
) {
  const group = toString(service.group) || defaultGroup;
  const metadata = service.metadata || {};
  try {
    if (service.startMessage) logger.info(group, service.startMessage, metadata);
    const handle = service.start();
    ownCleanup(cleanup, service.stop || handle);
    if (service.startedMessage) logger.info(group, service.startedMessage, metadata);
  } catch (error) {
    logger.warn(service.failureGroup || group, service.failureMessage || `${service.label} failed`, {
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
  group: string,
) {
  for (const run of cleanup.splice(0).reverse()) {
    try {
      Promise.resolve(run()).catch ((error) => logCleanupFailure(logger, group, error));
    } catch (error) {
      logCleanupFailure(logger, group, error);
    }
  }
}

function logCleanupFailure(
  logger: NormalizedStartupLogger,
  group: string,
  error: unknown,
) {
  logger.warn(group, "cleanup failed", { error: errorMessage(error) });
}

function taskGroup(group: unknown): string {
  return toString(group) || `${STARTUP_LOG_GROUP}.tasks`;
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
