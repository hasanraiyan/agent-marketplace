import { parentPort } from 'worker_threads';
import { mixToStereoWav } from './traceAudioMix.js';

/**
 * Long-lived worker thread for mixing call recordings (see mixInWorker in
 * traceAudioMix.js). It is started once and reused: each `{ id, args }`
 * message mixes one recording and answers `{ id, ok, result | error }`.
 * The per-sample work runs here, never on the main event loop that carries
 * the live voice calls.
 */
parentPort.on('message', ({ id, args }) => {
  mixToStereoWav({ ...args, yieldEvery: 0 })
    .then((result) => parentPort.postMessage({ id, ok: true, result }))
    .catch((err) => parentPort.postMessage({ id, ok: false, error: err?.message || String(err) }));
});
