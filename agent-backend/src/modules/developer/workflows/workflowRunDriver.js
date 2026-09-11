import { EventType } from '@ag-ui/core';
import workflowRunRepository from './workflowRun.repository.js';
import workflowRepository from './workflow.repository.js';

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
    WorkflowRunDriver.#activeDrivers.delete(String(runId));
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
    }

    for (const res of this.subscribers) {
      try {
        res.write(raw);
      } catch (err) {
        // Handled by close listener
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

    // Replay missed frames
    for (const frame of this.frames) {
      if (frame.seq > sinceSeq) {
        try {
          res.write(frame.raw);
        } catch {
          return;
        }
      }
    }

    if (this.isCompleted || this.isCancelled) {
      res.end();
      return;
    }

    this.subscribers.add(res);
    res.on('close', () => {
      this.subscribers.delete(res);
    });
  }

  /**
   * Cancels in-flight execution mid-stream.
   */
  async abort(reason = 'Workflow execution cancelled by user') {
    if (this.isCompleted || this.isCancelled) return;

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
    } catch {
      // Ignore cleanup error
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

    for (const res of this.subscribers) {
      try {
        res.end();
      } catch {}
    }
    this.subscribers.clear();

    // Decrement concurrency counter
    workflowRepository.decrementActiveRuns(this.workflowId).catch(() => {});

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

    workflowRepository.decrementActiveRuns(this.workflowId).catch(() => {});

    setTimeout(() => {
      WorkflowRunDriver.unregister(this.runId);
    }, 300000);
  }
}
