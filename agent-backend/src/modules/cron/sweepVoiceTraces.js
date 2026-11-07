import { loggerService } from '../../utils/index.js';
import { traceService } from '../traces/index.js';

const logger = loggerService.getLogger();

/**
 * Voice-trace housekeeping (hourly by default):
 *  - MongoDB's TTL removes old trace documents but not their recording
 *    files, so recordings past TRACE_RETENTION_DAYS (or whose trace is gone)
 *    are deleted here;
 *  - temp .pcm files older than a day are deleted;
 *  - voice traces still `running` long after any call could have ended
 *    (server restart mid-call) are marked cancelled.
 */
export default async function sweepVoiceTraces() {
  const result = await traceService.sweepVoice();
  if (result.staleTraces || result.deletedFiles) {
    logger.info('[Traces] voice sweep', result);
  }
  return result;
}
