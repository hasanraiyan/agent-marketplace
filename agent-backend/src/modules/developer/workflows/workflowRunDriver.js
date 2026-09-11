import { EventType } from '@ag-ui/core';
import workflowRunRepository from './workflowRun.repository.js';
import workflowRepository from './workflow.repository.js';
import { loggerService } from '../../../utils/index.js';

const logger = loggerService.getLogger();

/**
 * WorkflowRunDriver manages the lifecycle and real-time SSE streaming
 * of a workflow execution, completely decoupled from client HTTP connections.
 * Survives client disconnects, buffers frames monotonically, and allows re-attachment.
 */
export class WorkflowRunDriver {
  static #activeDrivers = new Map();

  static get(runId) {
    return WorkflowRunDriver.#activeDrivers.get(String(runId));
  }

  static register(runId, driver) {
    WorkflowRunDriver.#activeDrivers.set(String(runId), driver);
  }

  static unregister(runId) {
    const existed = WorkflowRunDriver.#activeDrivers.delete(String(runId));
    if (existed) {
      logger.debug('[WorkflowRunDriver] unregistered', { runId: String(runId), remaining: WorkflowRunDriver.#activeDrivers.size });
    }
  }

  constructor({ runId, workflowId, projectId, threadId }) {
    this.runId = String(runId);
    this.workflowId = String(workflowId);
    this.projectId = String(projectId);
    this.threadId = threadId;

    this.seq = 0;
    this.frames = []; // [{ seq, event, raw }]
    this.subscribers = new Set(); // Set<express.Response>
    this.abortController = new AbortController();

    this.isCompleted = false;
    this.isCancelled = false;
    this.error = null;

    WorkflowRunDriver.register(this.runId, this);
    logger.debug('[WorkflowRunDriver] registered', { runId: this.runId, workflowId: this.workflowId, threadId: this.threadId });
  }

  get signal() {
    return this.abortController.signal;
  }

  /**
   * Serializes an event, assigns a monotonic seq, buffers it, and broadcasts to active subscribers.
   */
  pushEvent(event) {
    const seq = ++this.seq;
    const enrichedEvent = { ...event, seq };
    const raw = `data: ${JSON.stringify(enrichedEvent)}\n\n`;

    this.frames.push({ seq, event: enrichedEvent, raw });
    if (this.frames.length > 10000) {
      this.frames.shift();
      logger.warn('[WorkflowRunDriver] frame buffer overflow, evicting oldest frame', { runId: this.runId, seq });
    }

    logger.debug('[WorkflowRunDriver] event pushed', { runId: this.runId, seq, type: event?.type, subscriberCount: this.subscribers.size });

    for (const res of this.subscribers) {
      try {
        res.write(raw);
      } catch (err) {
        logger.warn(`[WorkflowRunDriver] failed to write event to subscriber: ${err?.message}`, { runId: this.runId, seq });
      }
    }
  }

  /**
   * Attaches an Express response stream to this driver.
   * Replays missed frames starting after `sinceSeq`.
   */
  subscribe(res, sinceSeq = 0) {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
    }

    const replayCount = this.frames.filter((frame) => frame.seq > sinceSeq).length;
    logger.info('[WorkflowRunDriver] subscriber attached', { runId: this.runId, sinceSeq, replayCount });

    // Replay missed frames
    for (const frame of this.frames) {
      if (frame.seq > sinceSeq) {
        try {
          res.write(frame.raw);
        } catch (err) {
          logger.warn(`[WorkflowRunDriver] failed to replay frame to subscriber: ${err?.message}`, { runId: this.runId });
          return;
        }
      }
    }

    if (this.isCompleted || this.isCancelled) {
      logger.debug('[WorkflowRunDriver] run already finished, closing subscriber stream immediately', { runId: this.runId });
      res.end();
      return;
    }

    this.subscribers.add(res);
    res.on('close', () => {
      this.subscribers.delete(res);
      logger.debug('[WorkflowRunDriver] subscriber disconnected', { runId: this.runId, remaining: this.subscribers.size });
    });
  }

  /**
   * Cancels in-flight execution mid-stream.
   */
  async abort(reason = 'Workflow execution cancelled by user') {
    if (this.isCompleted || this.isCancelled) {
      logger.debug('[WorkflowRunDriver] abort() called on already-finished run, ignoring', { runId: this.runId });
      return;
    }

    logger.info('[WorkflowRunDriver] aborting run', { runId: this.runId, reason });

    this.isCancelled = true;
    this.abortController.abort();

    this.pushEvent({
      type: EventType.RUN_ERROR,
      code: 'EXECUTION_CANCELLED',
      message: reason,
    });

    try {
      await workflowRunRepository.cancelRun(this.runId);
      await workflowRepository.decrementActiveRuns(this.workflowId);
    } catch (err) {
      logger.warn(`[WorkflowRunDriver] cleanup after abort failed: ${err?.message}`, { runId: this.runId });
    }

    for (const res of this.subscribers) {
      try {
        res.end();
      } catch {}
    }
    this.subscribers.clear();

    // Evict after brief buffer window
    setTimeout(() => {
      WorkflowRunDriver.unregister(this.runId);
    }, 60000);
  }

  /**
   * Marks driver completed and gracefully ends all active streams.
   */
  finish() {
    this.isCompleted = true;
    logger.debug('[WorkflowRunDriver] finishing run, closing subscriber streams', { runId: this.runId, subscriberCount: this.subscribers.size });

    for (const res of this.subscribers) {
      try {
        res.end();
      } catch {}
    }
    this.subscribers.clear();

    // Decrement concurrency counter
    workflowRepository.decrementActiveRuns(this.workflowId).catch((err) => {
      logger.warn(`[WorkflowRunDriver] failed to decrement active runs on finish: ${err?.message}`, { runId: this.runId, workflowId: this.workflowId });
    });

    // Retain buffered frames for 5 minutes so late resumes can inspect final frames
    setTimeout(() => {
      WorkflowRunDriver.unregister(this.runId);
    }, 300000);
  }

  /**
   * Marks driver failed with an error.
   */
  fail(error) {
    this.error = error;
    this.isCompleted = true;

    logger.error(`[WorkflowRunDriver] run failed: ${error?.message}`, error);

    this.pushEvent({
      type: EventType.RUN_ERROR,
      code: error.code || 'RUN_FAILED',
      message: error.message || 'Workflow execution encountered an unhandled error',
    });

    for (const res of this.subscribers) {
      try {
        res.end();
      } catch {}
    }
    this.subscribers.clear();

    workflowRepository.decrementActiveRuns(this.workflowId).catch((err) => {
      logger.warn(`[WorkflowRunDriver] failed to decrement active runs on fail: ${err?.message}`, { runId: this.runId, workflowId: this.workflowId });
    });

    setTimeout(() => {
      WorkflowRunDriver.unregister(this.runId);
    }, 300000);
  }
}
