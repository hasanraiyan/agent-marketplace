/**
 * Runner — Single Responsibility: stream the agent and dispatch render events.
 * Collects the full response, then renders it as markdown via the Renderer.
 */
import ora from "ora";
import chalk from "chalk";
import { log, renderMarkdown, renderToolCall, renderToolResult, renderSubagent, renderHITL } from "./renderer.js";

/**
 * Run the agent and render output.
 *
 * @param {object|import("@langchain/langgraph").Command} agentInput
 * @param {object} agentInstance - the compiled agent graph
 * @param {Function} getConfig - () => { configurable: { thread_id } }
 * @param {{ onHITL: () => void }} hooks
 */
export async function runAgent(agentInput, agentInstance, getConfig, hooks = {}) {
  const spinner = ora({
    text: chalk.dim("Agent thinking…"),
    color: "cyan",
    spinner: "dots2",
  }).start();

  let fullResponse = "";  // accumulates AI text for markdown render
  let spinnerStopped = false;

  const stopSpinner = () => {
    if (!spinnerStopped) { spinner.stop(); spinnerStopped = true; }
  };

  try {
    const stream = agentInstance.streamEvents(agentInput, {
      ...getConfig(),
      version: "v2",
    });

    for await (const event of stream) {
      const { event: evtName, data, name } = event;

      // ── Collect AI response tokens ──────────────────────────────────────
      if (evtName === "on_chat_model_stream") {
        const chunk = data?.chunk?.content;
        if (typeof chunk === "string" && chunk) {
          stopSpinner(); // first token → UI is live
          fullResponse += chunk;
          // Show a live "typing" indicator without printing raw text
          // We'll render cleanly as markdown at the end
          process.stdout.write(chalk.dim("."));
        }
      }

      // ── Tool call ───────────────────────────────────────────────────────
      if (evtName === "on_tool_start") {
        stopSpinner();
        // Clear the dot-trail line
        process.stdout.write("\r" + " ".repeat(50) + "\r");

        const toolName = name || data?.name || "tool";
        const isTask   = toolName === "task";

        if (isTask) {
          renderSubagent(
            data?.input?.subagent_type ?? "?",
            data?.input?.description   ?? ""
          );
        } else {
          renderToolCall(toolName, data?.input);
        }
      }

      // ── Tool result ─────────────────────────────────────────────────────
      if (evtName === "on_tool_end") {
        renderToolResult(data?.output);
      }

      // ── HITL interrupt ──────────────────────────────────────────────────
      if (evtName === "on_custom_event" && data?.type === "interrupt") {
        stopSpinner();
        renderHITL(data?.tool ?? "write_file", data?.args);
        hooks.onHITL?.();
      }
    }

    stopSpinner();
    // Clear the dot trail
    process.stdout.write("\r" + " ".repeat(60) + "\r");

    // ── Render full response as markdown ────────────────────────────────
    if (fullResponse.trim()) {
      console.log(`\n${chalk.green.bold("🤖 Agent")}`);
      renderMarkdown(fullResponse);
    }

  } catch (e) {
    stopSpinner();
    process.stdout.write("\r" + " ".repeat(60) + "\r");

    if (e?.name === "GraphInterrupt" || e?.message?.includes("interrupt")) {
      log.warn("Agent paused — use /approve or /reject [feedback]");
      hooks.onHITL?.();
    } else {
      log.err(e.message);
    }
  }
}
