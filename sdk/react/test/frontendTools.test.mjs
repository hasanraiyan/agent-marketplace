// @vitest-environment happy-dom
// Frontend tools end-to-end through useChat against a fake server: the
// request carries `tools`, a `frontend_tool_request` runs the registered
// tool, its answer lands on the card, and the run resumes silently.
import assert from "node:assert";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import {
  PersonaProvider,
  PersonaToolCallView,
  useChat,
  useComponent,
  useFrontendTool,
  useHumanInTheLoop,
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
            i < chunks.length
              ? { done: false, value: enc.encode(chunks[i++]) }
              : { done: true },
          cancel: async () => {},
        };
      },
    },
  };
}
function jsonResponse(data) {
  const res = {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
  res.clone = () => res;
  return res;
}

let chatBodies;
let chatReplies; // queue of event arrays, one per POST /chat
let history;
beforeEach(() => {
  chatBodies = [];
  chatReplies = [];
  history = { messages: [] };
  globalThis.fetch = vi.fn(async (url, init) => {
    if (String(url).endsWith("/chat")) {
      chatBodies.push(JSON.parse(init.body));
      return sseResponse(chatReplies.shift() ?? [{ type: "RUN_FINISHED" }]);
    }
    if (String(url).includes("/threads/")) return jsonResponse(history);
    throw new Error(`unexpected fetch ${url}`);
  });
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
    root.render(
      h(
        PersonaProvider,
        { baseUrl: "/api", defaultAgentId: "agent-1" },
        children,
      ),
    );
  });
}

// Renders the chat and exposes its API; shows each tool call through
// PersonaToolCallView so registered renderers (and `respond`) are live.
function ChatProbe({ api }) {
  const chat = useChat({ threadId: "t1" });
  api.current = chat;
  return h(
    "div",
    null,
    chat.messages.flatMap((m) =>
      (m.toolCalls ?? []).map((tc) =>
        h(PersonaToolCallView, { key: tc.toolCallId, toolCall: tc }),
      ),
    ),
  );
}

const pauseOn = (name, args, toolCallId = "call_1") => [
  {
    type: "TOOL_CALL_CHUNK",
    toolCallId,
    toolCallName: name,
    delta: JSON.stringify(args),
  },
  {
    type: "CUSTOM",
    name: "frontend_tool_request",
    value: { calls: [{ toolCallId, name, args }] },
  },
  { type: "RUN_FINISHED" },
];
const finishWith = (text) => [
  { type: "TEXT_MESSAGE_CHUNK", messageId: "m2", delta: text },
  { type: "RUN_FINISHED" },
];

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

describe("frontend tools through useChat", () => {
  it("runs a useFrontendTool handler and resumes silently with its result", async () => {
    const handler = vi.fn(async ({ path }) => ({ opened: path }));
    function Tools() {
      useFrontendTool({
        name: "open_page",
        description: "Open a page.",
        parameters: {
          type: "object",
          properties: { path: { type: "string" } },
        },
        handler,
      });
      return null;
    }
    const api = { current: null };
    await mount([h(Tools, { key: "t" }), h(ChatProbe, { key: "c", api })]);

    chatReplies.push(
      pauseOn("open_page", { path: "/x" }),
      finishWith("Opened it."),
    );
    await act(async () => {
      await api.current.sendMessage("open x");
    });
    await vi.waitFor(() => assert.strictEqual(chatBodies.length, 2));
    await flush();

    // 1st request: the registered tool is offered to the agent.
    assert.deepStrictEqual(chatBodies[0].tools, [
      {
        name: "open_page",
        description: "Open a page.",
        parameters: {
          type: "object",
          properties: { path: { type: "string" } },
        },
      },
    ]);
    assert.deepStrictEqual(handler.mock.calls[0][0], { path: "/x" });
    assert.deepStrictEqual(handler.mock.calls[0][1], { toolCallId: "call_1" });

    // 2nd request: silent resume — no messages, the result, tools again.
    assert.deepStrictEqual(chatBodies[1].messages, []);
    assert.deepStrictEqual(chatBodies[1].resume, {
      toolResults: [{ toolCallId: "call_1", result: { opened: "/x" } }],
    });
    assert.ok(Array.isArray(chatBodies[1].tools));

    const msgs = api.current.messages;
    assert.strictEqual(msgs.filter((m) => m.role === "user").length, 1); // no fake bubble
    const card = msgs
      .flatMap((m) => m.toolCalls ?? [])
      .find((tc) => tc.toolCallId === "call_1");
    assert.strictEqual(card.result, '{"opened":"/x"}');
    assert.strictEqual(card.isError, false);
    assert.ok(
      msgs.some((m) => m.role === "assistant" && m.content === "Opened it."),
    );
    assert.strictEqual(api.current.pendingFrontendTools, null);
  });

  it("a throwing handler is reported as an error result", async () => {
    function Tools() {
      useFrontendTool({
        name: "open_page",
        description: "Open a page.",
        handler: () => {
          throw new Error("Navigation blocked");
        },
      });
      return null;
    }
    const api = { current: null };
    await mount([h(Tools, { key: "t" }), h(ChatProbe, { key: "c", api })]);
    chatReplies.push(pauseOn("open_page", {}), finishWith("ok"));
    await act(async () => {
      await api.current.sendMessage("go");
    });
    await vi.waitFor(() => assert.strictEqual(chatBodies.length, 2));
    assert.deepStrictEqual(chatBodies[1].resume, {
      toolResults: [{ toolCallId: "call_1", error: "Navigation blocked" }],
    });
  });

  it("useHumanInTheLoop waits for respond() from its rendered UI", async () => {
    let respondFn = null;
    let seenStatus = null;
    function Tools() {
      useHumanInTheLoop({
        name: "confirm_apply",
        description: "Ask before applying.",
        parameters: {
          type: "object",
          properties: { university: { type: "string" } },
        },
        render: ({ args, status, respond }) => {
          seenStatus = status;
          respondFn = respond ?? null;
          return h("p", null, `Apply to ${args.university}?`);
        },
      });
      return null;
    }
    const api = { current: null };
    await mount([h(Tools, { key: "t" }), h(ChatProbe, { key: "c", api })]);
    chatReplies.push(
      pauseOn("confirm_apply", { university: "MIT" }),
      finishWith("Submitted."),
    );
    await act(async () => {
      await api.current.sendMessage("apply");
    });
    await vi.waitFor(() =>
      assert.ok(respondFn, "respond should be offered while waiting"),
    );
    assert.strictEqual(seenStatus, "executing");
    assert.match(container.textContent, /Apply to MIT\?/);
    assert.strictEqual(chatBodies.length, 1); // still waiting on the user

    await act(async () => respondFn({ confirmed: true }));
    await vi.waitFor(() => assert.strictEqual(chatBodies.length, 2));
    assert.deepStrictEqual(chatBodies[1].resume, {
      toolResults: [{ toolCallId: "call_1", result: { confirmed: true } }],
    });
    await flush();
    assert.strictEqual(seenStatus, "complete");
  });

  it("useComponent renders the args as props and answers immediately", async () => {
    function Tools() {
      useComponent({
        name: "show_card",
        description: "Show a card.",
        render: (args) => h("b", null, `Card: ${args.title}`),
      });
      return null;
    }
    const api = { current: null };
    await mount([h(Tools, { key: "t" }), h(ChatProbe, { key: "c", api })]);
    chatReplies.push(
      pauseOn("show_card", { title: "Shortlist" }),
      finishWith("Here it is."),
    );
    await act(async () => {
      await api.current.sendMessage("show");
    });
    await vi.waitFor(() => assert.strictEqual(chatBodies.length, 2));
    await flush();
    assert.deepStrictEqual(chatBodies[1].resume, {
      toolResults: [{ toolCallId: "call_1", result: "Displayed to the user." }],
    });
    assert.match(container.textContent, /Card: Shortlist/);
  });

  it("an unregistered tool is answered with an error, and no tools → no `tools` field", async () => {
    const api = { current: null };
    await mount(h(ChatProbe, { api }));
    chatReplies.push(pauseOn("ghost_tool", {}), finishWith("ok"));
    await act(async () => {
      await api.current.sendMessage("hi");
    });
    await vi.waitFor(() => assert.strictEqual(chatBodies.length, 2));
    assert.strictEqual("tools" in chatBodies[0], false);
    assert.match(chatBodies[1].resume.toolResults[0].error, /isn't available/);
  });

  it("typing a new message while a call waits sends a normal message, not a resume", async () => {
    let respondFn = null;
    function Tools() {
      useHumanInTheLoop({
        name: "confirm_apply",
        description: "Ask.",
        render: ({ respond }) => {
          respondFn = respond ?? null;
          return null;
        },
      });
      return null;
    }
    const api = { current: null };
    await mount([h(Tools, { key: "t" }), h(ChatProbe, { key: "c", api })]);
    chatReplies.push(
      pauseOn("confirm_apply", {}),
      finishWith("Okay, cancelled."),
    );
    await act(async () => {
      await api.current.sendMessage("apply");
    });
    await vi.waitFor(() => assert.ok(respondFn));

    await act(async () => {
      await api.current.sendMessage("actually, never mind");
    });
    await flush();
    assert.strictEqual(chatBodies.length, 2);
    assert.strictEqual(chatBodies[1].resume, undefined);
    assert.strictEqual(
      chatBodies[1].messages.at(-1).content,
      "actually, never mind",
    );
    // The stale respond() is now a no-op — no extra request.
    await act(async () => respondFn?.({ confirmed: true }));
    await flush();
    assert.strictEqual(chatBodies.length, 2);
  });

  it("a reloaded thread paused on a frontend tool runs it and resumes", async () => {
    const handler = vi.fn(() => "reopened");
    function Tools() {
      useFrontendTool({
        name: "open_page",
        description: "Open a page.",
        handler,
      });
      return null;
    }
    history = {
      messages: [
        { id: "u1", role: "user", content: "open z" },
        {
          id: "a1",
          role: "assistant",
          content: "",
          toolCalls: [
            {
              toolCallId: "call_9",
              toolName: "open_page",
              args: '{"path":"/z"}',
            },
          ],
        },
      ],
      pendingInterrupt: {
        kind: "frontend_tool",
        value: {
          calls: [
            { toolCallId: "call_9", name: "open_page", args: { path: "/z" } },
          ],
        },
      },
    };
    chatReplies.push(finishWith("Reopened."));
    const api = { current: null };
    await mount([h(Tools, { key: "t" }), h(ChatProbe, { key: "c", api })]);

    await vi.waitFor(() => assert.strictEqual(chatBodies.length, 1));
    assert.deepStrictEqual(handler.mock.calls[0][0], { path: "/z" });
    assert.deepStrictEqual(chatBodies[0].resume, {
      toolResults: [{ toolCallId: "call_9", result: "reopened" }],
    });
    assert.deepStrictEqual(chatBodies[0].messages, []);
    assert.strictEqual(api.current.interrupt, null); // never surfaced as an interrupt
  });
});
