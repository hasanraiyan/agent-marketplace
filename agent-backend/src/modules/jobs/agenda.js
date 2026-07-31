import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';
import config from '../../config/index.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

/**
 * Developer Platform (blueprint Phase 10, PR-53, AD-08 §28). The durable,
 * retry-capable task-execution mechanism §28 identified as required for
 * Project-deletion cleanup — a single `node-cron` tick is insufficient for
 * a multi-storage-type purge that may span minutes and must survive a
 * process restart mid-cleanup. MongoDB-backed (its own `agendaJobs`
 * collection on the existing Mongo deployment) rather than Redis-backed —
 * this stack has no Redis anywhere, and this capability only needs to work
 * reliably for one Project at a time until general release (blueprint §40).
 *
 * `node-cron` remains the *trigger* only (see
 * `cron/discoverExpiredDeletions.js`) — it discovers Projects past their
 * deletion grace period and enqueues a job here; Agenda is the actual
 * executor, with its own persistence and retry semantics.
 */
const agenda = new Agenda({
  backend: new MongoBackend({ address: config.mongodbUri, collection: 'agendaJobs' }),
  processEvery: '1 minute',
});

agenda.on('ready', () => logger.info('[Agenda] job queue ready'));
agenda.on('error', (err) => logger.error('[Agenda] connection error:', err));

export async function startAgenda() {
  await agenda.start();
  logger.info('[Agenda] started');
}

export async function stopAgenda() {
  await agenda.stop();
  logger.info('[Agenda] stopped');
}

export default agenda;
