// @vitest-environment happy-dom
// Image attachments: useAttachments (check + upload + previews), useChat
// sending them (incl. image-only turns, reload, history), useAttachmentUrl.
import assert from "node:assert";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import {
  ATTACHMENT_LIMITS,
  PersonaProvider,
  useAttachmentUrl,
  useAttachments,
  useChat,
} from "../dist/index.js";

const h = React.createElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ── fake server ────────────────────────────────────────────────────────────
const enc = new TextEncoder();
function sseResponse(events) {
  const chunks = events.map((e) => `data: ${JSON.stringify(e)}\n\n`);
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    body: {
      getReader() {
        let i = 0;
        return {
          read: async () =>
            i < chunks.length ? { done: false, value: enc.encode(chunks[i++]) } : { done: true },
          cancel: async () => {},
        };
      },
    },
  };
}
function jsonResponse(data, status = 200) {
  const res = {
    ok: status < 400,
    status,
    headers: { get: () => null },
    json: async () => data,
    text: async () => JSON.stringify(data),
    blob: async () => new Blob(["img"], { type: "image/png" }),
  };
  res.clone = () => res;
  return res;
}

let chatBodies;
let uploads;
let downloads;
let history;
let uploadGate;
beforeEach(() => {
  chatBodies = [];
  uploads = [];
  downloads = [];
  history = { messages: [] };
  uploadGate = null;
  let seq = 0;
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith("/chat")) {
      chatBodies.push(JSON.parse(init.body));
      return sseResponse([{ type: "RUN_FINISHED" }]);
    }
    if (u.endsWith("/files") && init.method === "POST") {
      uploads.push(init.body.get("file"));
      if (uploadGate) await uploadGate;
      if (init.signal?.aborted) throw new DOMException("aborted", "AbortError");
      return jsonResponse({ id: `file-${++seq}` }, 201);
    }
    if (u.includes("/files/")) {
      downloads.push(u);
      return jsonResponse({});
    }
    if (u.includes("/threads/")) return jsonResponse(history);
    throw new Error(`unexpected fetch ${u}`);
  });
  let urlSeq = 0;
  URL.createObjectURL = vi.fn(() => `blob:test-${++urlSeq}`);
  URL.revokeObjectURL = vi.fn();
});

let root;
let container;
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = undefined;
});

async function mount(children) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(PersonaProvider, { baseUrl: "/api", defaultAgentId: "agent-1" }, children));
  });
}

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

const png = (name = "a.png", size = 10) =>
  new File([new Uint8Array(size)], name, { type: "image/png" });

function Probe({ api, threadId = "t1" }) {
  const chat = useChat({ threadId });
  const att = useAttachments();
  api.current = { chat, att };
  return null;
}

describe("useAttachments", () => {
  it("uploads picked images and exposes them as ready", async () => {
    const api = { current: null };
    await mount(h(Probe, { api }));
    await act(async () => api.current.att.add([png("a.png"), png("b.png")]));
    await flush();

    assert.strictEqual(uploads.length, 2);
    assert.deepStrictEqual(
      api.current.att.ready,
      [
        { fileId: "file-1", mimeType: "image/png", name: "a.png" },
        { fileId: "file-2", mimeType: "image/png", name: "b.png" },
      ],
    );
    assert.strictEqual(api.current.att.isUploading, false);
    assert.strictEqual(api.current.att.attachments[0].previewUrl, "blob:test-1");
    assert.strictEqual(api.current.att.accept, ATTACHMENT_LIMITS.mimeTypes.join(","));
  });

  it("rejects wrong types, oversized files and more than 4, without uploading them", async () => {
    const api = { current: null };
    await mount(h(Probe, { api }));
    await act(async () =>
      api.current.att.add([
        new File(["x"], "doc.pdf", { type: "application/pdf" }),
        png("huge.png", ATTACHMENT_LIMITS.maxBytes + 1),
        png("1.png"),
        png("2.png"),
        png("3.png"),
        png("4.png"),
        png("5.png"),
      ]),
    );
    await flush();
    assert.strictEqual(uploads.length, 4);
    assert.match(api.current.att.error, /doc\.pdf: only PNG/);
    assert.match(api.current.att.error, /huge\.png: larger than 5 MB/);
    assert.match(api.current.att.error, /At most 4 images/);
  });

  it("remove/clear cancel uploads and release previews", async () => {
    let release;
    uploadGate = new Promise((r) => (release = r));
    const api = { current: null };
    await mount(h(Probe, { api }));
    await act(async () => api.current.att.add([png("a.png"), png("b.png")]));
    assert.strictEqual(api.current.att.isUploading, true);

    const firstId = api.current.att.attachments[0].id;
    await act(async () => api.current.att.remove(firstId));
    assert.strictEqual(api.current.att.attachments.length, 1);
    assert.ok(URL.revokeObjectURL.mock.calls.some(([u]) => u === "blob:test-1"));

    await act(async () => api.current.att.clear());
    release();
    await flush();
    assert.strictEqual(api.current.att.attachments.length, 0);
    assert.deepStrictEqual(api.current.att.ready, []);
  });

  it("a failed upload is marked as an error, not ready", async () => {
    const api = { current: null };
    await mount(h(Probe, { api }));
    await flush();
    globalThis.fetch.mockImplementationOnce(async () => jsonResponse({ message: "nope" }, 413));
    await act(async () => api.current.att.add([png()]));
    await flush();
    assert.strictEqual(api.current.att.attachments[0].status, "error");
    assert.match(api.current.att.attachments[0].error, /Upload failed \(413\)/);
    assert.deepStrictEqual(api.current.att.ready, []);
  });
});

describe("useChat with attachments", () => {
  it("sends attachment ids and shows them on the user bubble", async () => {
    const api = { current: null };
    await mount(h(Probe, { api }));
    await act(async () => api.current.att.add([png("cat.png")]));
    await flush();

    const ready = api.current.att.ready;
    await act(async () => {
      await api.current.chat.sendMessage("what is this?", { attachments: ready });
    });
    await flush();

    assert.deepStrictEqual(chatBodies[0].attachments, [{ fileId: "file-1" }]);
    assert.deepStrictEqual(chatBodies[0].messages.at(-1), { role: "user", content: "what is this?" });
    const userBubble = api.current.chat.messages.find((m) => m.role === "user");
    assert.deepStrictEqual(userBubble.attachments, [
      { fileId: "file-1", mimeType: "image/png", name: "cat.png" },
    ]);
  });

  it("allows an image-only message; text-only sends carry no attachments key", async () => {
    const api = { current: null };
    await mount(h(Probe, { api }));
    await act(async () => {
      await api.current.chat.sendMessage("", { attachments: [{ fileId: "f9" }] });
    });
    await flush();
    assert.strictEqual(chatBodies.length, 1);
    assert.deepStrictEqual(chatBodies[0].attachments, [{ fileId: "f9" }]);

    await act(async () => {
      await api.current.chat.sendMessage("just text");
    });
    await flush();
    assert.strictEqual("attachments" in chatBodies[1], false);

    // Neither text nor images: nothing is sent.
    await act(async () => {
      await api.current.chat.sendMessage("");
    });
    assert.strictEqual(chatBodies.length, 2);
  });

  it("reload() resends the last message's images", async () => {
    const api = { current: null };
    await mount(h(Probe, { api }));
    await act(async () => {
      await api.current.chat.sendMessage("describe", { attachments: [{ fileId: "f1" }] });
    });
    await flush();
    await act(async () => {
      await api.current.chat.reload();
    });
    await flush();
    assert.deepStrictEqual(chatBodies[1].attachments, [{ fileId: "f1" }]);
  });

  it("loads attachments from thread history", async () => {
    history = {
      messages: [
        {
          id: "u1",
          role: "user",
          content: "see",
          attachments: [{ fileId: "f7", mimeType: "image/jpeg", name: "x.jpg" }],
        },
        { id: "a1", role: "assistant", content: "a cat" },
      ],
    };
    const api = { current: null };
    await mount(h(Probe, { api, threadId: "t-history" }));
    await flush();
    const user = api.current.chat.messages.find((m) => m.id === "u1");
    assert.deepStrictEqual(user.attachments, [{ fileId: "f7", mimeType: "image/jpeg", name: "x.jpg" }]);
    assert.strictEqual(api.current.chat.messages.find((m) => m.id === "a1").attachments, undefined);
  });
});

describe("useAttachmentUrl", () => {
  function Img({ fileId, out }) {
    out.current = useAttachmentUrl(fileId);
    return null;
  }

  it("fetches the image with auth and returns an object URL", async () => {
    const out = { current: null };
    await mount(h(Img, { fileId: "f-remote", out }));
    await flush();
    assert.deepStrictEqual(downloads, ["/api/files/f-remote"]);
    assert.match(out.current.url, /^blob:test-/);
    assert.strictEqual(out.current.isLoading, false);
  });

  it("uses the just-uploaded file without downloading it again", async () => {
    const api = { current: null };
    const out = { current: null };
    function Both() {
      const att = useAttachments();
      api.current = att;
      out.current = useAttachmentUrl(att.ready[0]?.fileId);
      return null;
    }
    await mount(h(Both));
    await act(async () => api.current.add([png()]));
    await flush();
    assert.ok(out.current.url);
    assert.deepStrictEqual(downloads, []);
  });

  it("reports a missing image as an error", async () => {
    globalThis.fetch.mockImplementationOnce(async () => jsonResponse({}, 404));
    const out = { current: null };
    await mount(h(Img, { fileId: "gone", out }));
    await flush();
    assert.strictEqual(out.current.url, null);
    assert.match(out.current.error.message, /Image unavailable \(404\)/);
  });
});
