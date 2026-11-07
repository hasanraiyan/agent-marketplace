// @vitest-environment happy-dom
// useVoice().sendImage: local transcript line, voice.image over the socket,
// accepted / rejected replies, no duplicate echo line, not-connected guard.
import assert from "node:assert";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { PersonaProvider, VOICE_IMAGE_LIMITS, useVoice } from "../dist/index.js";

const h = React.createElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static last = null;
  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.OPEN;
    this.sent = [];
    FakeWebSocket.last = this;
  }
  send(data) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
  /** Simulates a server → client CUSTOM event. */
  emit(name, value) {
    this.onmessage?.({ data: JSON.stringify({ type: "CUSTOM", name, value }) });
  }
}

const realWebSocket = globalThis.WebSocket;
beforeEach(() => {
  globalThis.WebSocket = FakeWebSocket;
  FakeWebSocket.last = null;
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({
      data: { ticket: "t", wsUrl: "wss://persona.test/voice?ticket=t", expiresAt: "", session: {} },
    }),
  }));
  let urlSeq = 0;
  URL.createObjectURL = vi.fn(() => `blob:voice-${++urlSeq}`);
  URL.revokeObjectURL = vi.fn();
});

let root;
let container;
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = undefined;
  globalThis.WebSocket = realWebSocket;
});

let voice;
function Probe() {
  voice = useVoice();
  return null;
}

async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(PersonaProvider, { baseUrl: "/api", defaultAgentId: "agent-1" }, h(Probe)));
  });
}

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

const jpeg = (name = "photo.jpg") =>
  new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], name, { type: "image/jpeg" });

async function waitForSent(ws, count) {
  for (let i = 0; i < 50 && ws.sent.filter((m) => m.type === "voice.image").length < count; i++) {
    await flush();
  }
  return ws.sent.filter((m) => m.type === "voice.image");
}

describe("useVoice().sendImage", () => {
  it("shows the image line at once, sends voice.image, and settles on accept", async () => {
    await mount();
    await act(async () => voice.start());
    const ws = FakeWebSocket.last;
    assert.ok(ws, "socket opened");

    let promise;
    await act(async () => {
      promise = voice.sendImage(jpeg(), { text: " What is this? " });
    });
    const line = voice.transcript.at(-1);
    assert.strictEqual(line.speaker, "user");
    assert.strictEqual(line.text, "What is this?");
    assert.strictEqual(line.attachments[0].status, "sending");

    const [msg] = await waitForSent(ws, 1);
    assert.strictEqual(msg.text, "What is this?");
    assert.strictEqual(msg.name, "photo.jpg");
    assert.strictEqual(msg.id, line.attachments[0].id);
    assert.strictEqual(atob(msg.data).charCodeAt(0), 0xff);
    assert.strictEqual(voice.transcript.at(-1).attachments[0].previewUrl, "blob:voice-1");

    // Server echo of the user line must not add a second line.
    await act(async () => {
      ws.emit("voice_transcript", {
        speaker: "user",
        text: "What is this?",
        isFinal: true,
        attachments: [{ fileId: "f1" }],
      });
      ws.emit("voice_image", {
        id: msg.id,
        status: "accepted",
        attachment: { fileId: "f1", mimeType: "image/jpeg" },
      });
    });
    const settled = await promise;
    assert.strictEqual(settled.status, "accepted");
    assert.strictEqual(settled.fileId, "f1");
    assert.strictEqual(voice.transcript.length, 1);
    assert.strictEqual(voice.transcript[0].attachments[0].status, "accepted");
  });

  it("reports a server rejection and settles pending sends when the call ends", async () => {
    await mount();
    await act(async () => voice.start());
    const ws = FakeWebSocket.last;

    let first;
    await act(async () => {
      first = voice.sendImage(jpeg());
    });
    const [msg] = await waitForSent(ws, 1);
    await act(async () => {
      ws.emit("voice_image", {
        id: msg.id,
        status: "rejected",
        code: "IMAGE_INPUT_DISABLED",
        message: "This agent does not accept images.",
      });
    });
    const rejected = await first;
    assert.strictEqual(rejected.status, "rejected");
    assert.strictEqual(rejected.error.code, "IMAGE_INPUT_DISABLED");

    // Second image is held back by the 1 s spacing; ending the call settles it.
    let second;
    await act(async () => {
      second = voice.sendImage(jpeg());
    });
    await act(async () => voice.stop());
    const ended = await second;
    assert.strictEqual(ended.status, "rejected");
    assert.strictEqual(ended.error.code, "SESSION_CLOSED");
  });

  it("refuses when no call is open, and exposes the limits", async () => {
    await mount();
    const result = await voice.sendImage(jpeg());
    assert.strictEqual(result.status, "rejected");
    assert.strictEqual(result.error.code, "NOT_CONNECTED");
    assert.strictEqual(voice.transcript.length, 0);
    assert.deepStrictEqual([...VOICE_IMAGE_LIMITS.mimeTypes], ["image/jpeg", "image/png"]);
  });
});
