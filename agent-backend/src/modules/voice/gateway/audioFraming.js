/**
 * Server→client audio frames carry a 4-byte little-endian `turnSeq` header
 * before the raw PCM16 payload, so the client can discard buffered audio
 * from a superseded agent utterance without ambiguity after a barge-in
 * (voice-agent-plan.md §5, §11). Client→server frames carry no header —
 * uplink is a single continuous mic stream with no turn multiplexing.
 */

const HEADER_BYTES = 4;

/** @param {number} turnSeq @param {Buffer} pcmBuffer @returns {Buffer} */
export function frameAudioForClient(turnSeq, pcmBuffer) {
  const header = Buffer.alloc(HEADER_BYTES);
  header.writeUInt32LE(turnSeq >>> 0, 0);
  return Buffer.concat([header, pcmBuffer]);
}

export default { frameAudioForClient };
