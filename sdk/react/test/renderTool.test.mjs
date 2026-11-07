// useRenderTool building blocks: partial-JSON args, status derivation, the
// renderer registry, and rendering through PersonaToolCallView (SSR).
import assert from "node:assert";
import { describe, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PersonaProvider,
  PersonaToolCallView,
  PersonaToolRegistry,
  buildToolRenderProps,
  getToolCallStatus,
  parsePartialJson,
  usePersonaContext,
} from "../dist/index.js";

const h = React.createElement;

describe("parsePartialJson", () => {
  it("returns complete JSON unchanged", () => {
    assert.deepStrictEqual(parsePartialJson('{"a":1,"b":[1,2],"c":"x"}'), {
      a: 1,
      b: [1, 2],
      c: "x",
    });
  });

  it("closes an unterminated string value and object", () => {
    assert.deepStrictEqual(parsePartialJson('{"title":"Shortl'), {
      title: "Shortl",
    });
  });

  it("closes nested arrays/objects", () => {
    assert.deepStrictEqual(
      parsePartialJson('{"fields":[{"name":"gpa","label":"G'),
      {
        fields: [{ name: "gpa", label: "G" }],
      },
    );
  });

  it("drops a half-typed key, a dangling comma, and a cut-off literal", () => {
    assert.deepStrictEqual(parsePartialJson('{"a":1,"ke'), { a: 1 });
    assert.deepStrictEqual(parsePartialJson('{"a":1,'), { a: 1 });
    assert.deepStrictEqual(parsePartialJson('{"a":1,"b":tr'), { a: 1 });
    assert.deepStrictEqual(parsePartialJson('{"a":'), { a: null });
  });

  it("handles truncated numbers and escapes", () => {
    assert.deepStrictEqual(parsePartialJson('{"n":12.'), { n: 12 });
    assert.deepStrictEqual(parsePartialJson('{"s":"a\\'), { s: "a" });
    assert.deepStrictEqual(parsePartialJson('{"s":"say \\"hi'), {
      s: 'say "hi',
    });
  });

  it("returns undefined for nothing usable", () => {
    assert.strictEqual(parsePartialJson(""), undefined);
    assert.strictEqual(parsePartialJson(undefined), undefined);
    assert.deepStrictEqual(parsePartialJson("{"), {});
  });
});

describe("getToolCallStatus / buildToolRenderProps", () => {
  const call = (over) => ({ toolCallId: "c1", toolName: "search", ...over });

  it("inProgress while args are partial, with partial args", () => {
    const tc = call({ args: '{"query":"MIT' });
    assert.strictEqual(getToolCallStatus(tc), "inProgress");
    const props = buildToolRenderProps(tc);
    assert.strictEqual(props.status, "inProgress");
    assert.deepStrictEqual(props.args, { query: "MIT" });
    assert.strictEqual(props.result, undefined);
  });

  it("inProgress before any args arrive", () => {
    assert.strictEqual(getToolCallStatus(call({ args: "" })), "inProgress");
  });

  it("executing once args are complete", () => {
    assert.strictEqual(
      getToolCallStatus(call({ args: '{"query":"MIT"}' })),
      "executing",
    );
  });

  it("complete when a result is present (even empty), carrying isError", () => {
    const tc = call({
      args: "{}",
      result: '{"status":"error"}',
      isError: true,
    });
    const props = buildToolRenderProps(tc);
    assert.strictEqual(props.status, "complete");
    assert.strictEqual(props.result, '{"status":"error"}');
    assert.strictEqual(props.isError, true);
    assert.strictEqual(
      getToolCallStatus(call({ args: "{}", result: "" })),
      "complete",
    );
  });

  it("non-object args become {}", () => {
    assert.deepStrictEqual(
      buildToolRenderProps(call({ args: "[1,2]" })).args,
      {},
    );
  });
});

describe("PersonaToolRegistry", () => {
  it("latest registration wins; unregister only removes its own entry", () => {
    const reg = new PersonaToolRegistry();
    const a = () => "a";
    const b = () => "b";
    const offA = reg.registerRenderer("t", a);
    const offB = reg.registerRenderer("t", b);
    assert.strictEqual(reg.getRenderer("t"), b);
    offA(); // stale unregister must not remove b
    assert.strictEqual(reg.getRenderer("t"), b);
    offB();
    assert.strictEqual(reg.getRenderer("t"), undefined);
  });

  it('falls back to the "*" wildcard', () => {
    const reg = new PersonaToolRegistry();
    const any = () => "any";
    const own = () => "own";
    reg.registerRenderer("*", any);
    reg.registerRenderer("mine", own);
    assert.strictEqual(reg.getRenderer("mine"), own);
    assert.strictEqual(reg.getRenderer("other"), any);
  });

  it("notifies subscribers and bumps the version on change", () => {
    const reg = new PersonaToolRegistry();
    let calls = 0;
    const unsub = reg.subscribe(() => calls++);
    const v0 = reg.getVersion();
    const off = reg.registerRenderer("t", () => null);
    off();
    assert.strictEqual(calls, 2);
    assert.strictEqual(reg.getVersion(), v0 + 2);
    unsub();
    reg.registerRenderer("t", () => null);
    assert.strictEqual(calls, 2);
  });
});

describe("PersonaToolCallView", () => {
  // useRenderTool registers in an effect (which SSR never runs), so register
  // through the provider's registry directly to exercise the render path.
  function RegisterDuringRender({ name, render, children }) {
    const { toolRegistry } = usePersonaContext();
    if (!toolRegistry.hasRenderer(name))
      toolRegistry.registerRenderer(name, render);
    return children;
  }

  const tc = {
    toolCallId: "c1",
    toolName: "search",
    args: '{"query":"MIT"}',
    result: "3 hits",
  };

  it("renders the registered renderer with status/args/result, and allows hooks inside render", () => {
    const render = ({ status, args, result }) => {
      const [label] = React.useState("Results");
      return h("p", null, `${label}:${status}:${args.query}:${result}`);
    };
    const html = renderToStaticMarkup(
      h(
        PersonaProvider,
        { baseUrl: "/api" },
        h(
          RegisterDuringRender,
          { name: "search", render },
          h(PersonaToolCallView, {
            toolCall: tc,
            fallback: h("i", null, "fallback"),
          }),
        ),
      ),
    );
    assert.strictEqual(html, "<p>Results:complete:MIT:3 hits</p>");
  });

  it("shows the fallback when no renderer matches", () => {
    const html = renderToStaticMarkup(
      h(
        PersonaProvider,
        { baseUrl: "/api" },
        h(PersonaToolCallView, {
          toolCall: tc,
          fallback: h("i", null, "fallback"),
        }),
      ),
    );
    assert.strictEqual(html, "<i>fallback</i>");
  });

  it("a renderer returning null suppresses the fallback", () => {
    const html = renderToStaticMarkup(
      h(
        PersonaProvider,
        { baseUrl: "/api" },
        h(
          RegisterDuringRender,
          { name: "search", render: () => null },
          h(PersonaToolCallView, {
            toolCall: tc,
            fallback: h("i", null, "fallback"),
          }),
        ),
      ),
    );
    assert.strictEqual(html, "");
  });
});
