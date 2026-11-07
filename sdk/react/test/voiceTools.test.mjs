// @vitest-environment happy-dom
// Voice frontend tool calls render through the same registered renderers as
// chat tool calls (voiceToolCallToToolCall → PersonaToolCallView).
import assert from "node:assert";
import { afterEach, describe, it } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import {
  PersonaProvider,
  PersonaToolCallView,
  useComponent,
  useHumanInTheLoop,
  voiceToolCallToToolCall,
} from "../dist/index.js";

const h = React.createElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

describe("voiceToolCallToToolCall", () => {
  it("maps running, done and error voice calls", () => {
    assert.deepStrictEqual(
      voiceToolCallToToolCall({ id: "c1", name: "show_chart", status: "running", frontend: true, args: { title: "T" } }),
      { toolCallId: "c1", toolName: "show_chart", args: '{"title":"T"}' },
    );
    assert.deepStrictEqual(
      voiceToolCallToToolCall({ id: "c2", name: "x", status: "done", summary: '{"ok":true}' }),
      { toolCallId: "c2", toolName: "x", args: "{}", result: '{"ok":true}' },
    );
    assert.deepStrictEqual(
      voiceToolCallToToolCall({ id: "c3", name: "x", status: "error", summary: "boom" }),
      { toolCallId: "c3", toolName: "x", args: "{}", result: "boom", isError: true },
    );
  });

  it("renders a voice call with the registered component and HITL renderers", async () => {
    function Tools() {
      useComponent({
        name: "show_title",
        description: "Show a title.",
        parameters: { type: "object", properties: { title: { type: "string" } } },
        render: (args) => h("h2", { id: "title" }, args.title),
      });
      useHumanInTheLoop({
        name: "confirm_action",
        description: "Confirm.",
        parameters: { type: "object", properties: { title: { type: "string" } } },
        render: ({ args, status }) => h("p", { id: "confirm" }, `${args.title}|${status}`),
      });
      return null;
    }
    const calls = [
      { id: "v1", name: "show_title", status: "done", frontend: true, args: { title: "Marks" }, summary: "Displayed to the user." },
      { id: "v2", name: "confirm_action", status: "running", frontend: true, args: { title: "Send it?" } },
    ];
    await mount(
      h(React.Fragment, null,
        h(Tools),
        ...calls.map((c) => h(PersonaToolCallView, { key: c.id, toolCall: voiceToolCallToToolCall(c) })),
      ),
    );
    assert.strictEqual(container.querySelector("#title").textContent, "Marks");
    assert.strictEqual(container.querySelector("#confirm").textContent, "Send it?|executing");
  });
});
