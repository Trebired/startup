import { STARTUP_LOG_GROUP } from "#constants";

function formatStartupDuration(ms: unknown): string {
  const totalMs =
  Number.isFinite(ms as number) && Number(ms) >= 0
  ? Math.round(Number(ms))
  : 0;
  if (totalMs < 1000) return `${totalMs}ms`;

  const seconds = totalMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds >= 10 ? 1 : 2)}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds - minutes * 60;
  return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
}

function startupMark(
  logger: { info?: (group: string, message: string, meta?: unknown) => void },
  label: string,
) {
  const started = Date.now();
  return function done(extra: Record<string, unknown> = {}) {
    logger.info?.(`${STARTUP_LOG_GROUP}.runtime`, "operation completed", {
        took_ms: Date.now() - started,
        ...extra,
        label,
    });
  };
}

export {
  formatStartupDuration,
  startupMark,
};
