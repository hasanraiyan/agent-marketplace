import type { RunDriver } from './runDriver.js';

/** How long a finished run stays resumable before it's evicted. */
export const DEFAULT_RUN_GRACE_MS = 5 * 60 * 1000;
/** Safety valve against unbounded growth from many short-lived runs whose clients never reconnect. */
export const DEFAULT_MAX_TRACKED_RUNS = 1000;

/**
 * Removes finished runs older than `graceMs`, then (if still over
 * `maxTracked`) evicts the oldest-finished runs until back under the cap.
 * Still-in-flight runs are never evicted by the cap — only completed ones.
 * Pure function over the registry Map so it's directly unit-testable
 * without waiting on a real timer.
 */
export function evictStaleRuns(
  runs: Map<string, RunDriver>,
  now: number,
  graceMs: number = DEFAULT_RUN_GRACE_MS,
  maxTracked: number = DEFAULT_MAX_TRACKED_RUNS
): void {
  for (const [id, driver] of runs) {
    if (
      driver.isFinished() &&
      driver.finishedAt !== undefined &&
      now - driver.finishedAt > graceMs
    ) {
      runs.delete(id);
    }
  }

  const overBy = runs.size - maxTracked;
  if (overBy <= 0) return;

  const finished = [...runs.entries()]
    .filter(([, driver]) => driver.isFinished())
    .sort((a, b) => (a[1].finishedAt ?? 0) - (b[1].finishedAt ?? 0));

  let remaining = overBy;
  for (const [id] of finished) {
    if (remaining <= 0) break;
    runs.delete(id);
    remaining -= 1;
  }
}
