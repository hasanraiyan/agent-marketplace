import database from '../../config/database.js';

/**
 * REQ-8 (OnlyFounders): stated goals, not measured SLIs — informal, not a
 * contractual SLA. No latency-percentile/uptime-tracking system exists yet;
 * these are the numbers we're currently designing/operating against.
 */
const STATED_TARGETS = {
  latencyTargets: { chatTimeToFirstTokenMsP95: 2000 },
  uptimeTargetPct: 99.9,
};

/**
 * `status` reflects live database connectivity — the one real, checkable
 * signal available today (mirrors health.controller.js's own DB check).
 * `incidents` is always empty until an incident-tracking system exists;
 * this is not a placeholder pretending to be live data, it's honestly
 * "we don't track this yet."
 */
function getStatus() {
  const isDbConnected = database.getConnectionStatus();
  return {
    status: isDbConnected ? 'operational' : 'degraded',
    ...STATED_TARGETS,
    incidents: [],
  };
}

export default { getStatus };
