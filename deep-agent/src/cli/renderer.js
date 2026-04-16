/**
 * Renderer — Single Responsibility: all terminal output formatting.
 * Uses: chalk, boxen, cli-table3, log-symbols, marked + marked-terminal.
 */
import chalk from "chalk";
import boxen from "boxen";
import Table from "cli-table3";
import logSymbols from "log-symbols";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

// Configure marked to render to terminal
marked.use(markedTerminal());

// ── Symbol shortcuts ──────────────────────────────────────────────────────────
export const sym = {
  ok:   logSymbols.success,
  err:  logSymbols.error,
  info: logSymbols.info,
  warn: logSymbols.warning,
};

// ── Labelled log lines ────────────────────────────────────────────────────────
export const log = {
  ok:   (msg) => console.log(`${sym.ok}  ${chalk.green(msg)}`),
  err:  (msg) => console.log(`${sym.err}  ${chalk.red(msg)}`),
  info: (msg) => console.log(`${sym.info}  ${chalk.cyan(msg)}`),
  warn: (msg) => console.log(`${sym.warn}  ${chalk.yellow(msg)}`),
  dim:  (msg) => console.log(chalk.dim(msg)),
};

// ── Markdown render ───────────────────────────────────────────────────────────
/**
 * Render a markdown string to the terminal inside a styled box.
 * @param {string} md - Raw markdown text from the agent
 */
export function renderMarkdown(md) {
  if (!md?.trim()) return;
  const rendered = marked(md).trimEnd();
  console.log(
    boxen(rendered, {
      padding: { top: 0, bottom: 0, left: 2, right: 2 },
      margin: { top: 0, bottom: 1, left: 0, right: 0 },
      borderStyle: "none",
    })
  );
}

// ── Tool call display ─────────────────────────────────────────────────────────
export function renderToolCall(name, args) {
  const preview = JSON.stringify(args ?? {}).slice(0, 120);
  console.log(`\n  ${sym.info} ${chalk.magenta.bold(name)}  ${chalk.dim(preview)}`);
}

export function renderToolResult(output, isError = false) {
  const str = typeof output === "string" ? output : JSON.stringify(output ?? "", null, 2);
  const maxLen = 500;
  const isTruncated = str.length > maxLen;
  const displayOut = str.slice(0, maxLen) + (isTruncated ? "\n... (output truncated)" : "");

  console.log(
    boxen(
      isError ? chalk.red(displayOut) : chalk.dim(displayOut),
      {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        margin: { top: 0, bottom: 1, left: 2, right: 0 },
        borderStyle: "round",
        borderColor: isError ? "red" : "gray",
        dimBorder: !isError,
        title: isError ? chalk.red("Error Output") : chalk.dim("Output"),
        titleAlignment: "left"
      }
    )
  );
}

// ── Sub-agent spawn box ───────────────────────────────────────────────────────
export function renderSubagent(type, description) {
  console.log(
    "\n" +
    boxen(
      `${chalk.yellow.bold("⚡ Sub-agent")}  ${chalk.yellow(type)}\n` +
      chalk.dim((description || "").slice(0, 100)),
      {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        borderStyle: "single",
        borderColor: "yellow",
      }
    )
  );
}

// ── HITL interrupt box ────────────────────────────────────────────────────────
export function renderHITL(toolName, args) {
  console.log(
    "\n" +
    boxen(
      `${chalk.red.bold("⛔  HITL — Human Approval Required")}\n\n` +
      `Agent wants to call: ${chalk.red.bold(toolName)}\n\n` +
      chalk.dim(JSON.stringify(args ?? {}, null, 2).slice(0, 400)) + "\n\n" +
      chalk.yellow("→ /approve  or  /reject [feedback]"),
      { padding: 1, borderStyle: "double", borderColor: "red" }
    )
  );
}

// ── Table builder ─────────────────────────────────────────────────────────────
export function makeTable(head, colWidths) {
  return new Table({
    head: head.map((h) => chalk.cyan.bold(h)),
    style: { head: [], border: ["dim"] },
    colWidths,
    wordWrap: true,
  });
}

// ── Message history table ─────────────────────────────────────────────────────
export function renderMessages(messages, next = []) {
  if (!messages.length) {
    log.warn("No messages in this thread yet.");
    return;
  }
  const tbl = makeTable(["#", "Role", "Content"], [4, 14, 68]);
  messages.forEach((m, i) => {
    const role = m._getType?.() ?? m.role ?? "?";
    const content = (
      typeof m.content === "string" ? m.content : JSON.stringify(m.content)
    ).slice(0, 130);
    const roleColor =
      role === "human" ? chalk.cyan(role) :
      role === "ai"    ? chalk.green(role) :
      role === "tool"  ? chalk.magenta(role) :
                         chalk.dim(role);
    tbl.push([chalk.dim(String(i)), roleColor, chalk.dim(content)]);
  });
  console.log("\n" + tbl.toString());
  if (next?.length) log.warn(`Next nodes: ${next.join(", ")}`);
  console.log();
}

// ── Skills table ─────────────────────────────────────────────────────────────
export function renderSkills(skillIds) {
  if (!skillIds.length) {
    log.warn("No skills loaded. Use /skill-add to add one.");
    return;
  }
  const tbl = makeTable(["#", "Skill ID"], [4, 40]);
  skillIds.forEach((id, i) => tbl.push([chalk.dim(String(i + 1)), chalk.yellow(id)]));
  console.log("\n" + tbl.toString() + "\n");
}

// ── Sessions table ────────────────────────────────────────────────────────────
export function renderSessions(sessions, activeId) {
  if (!sessions.length) {
    log.warn("No sessions yet.");
    return;
  }
  const tbl = makeTable(["", "Thread ID", "Created"], [3, 36, 26]);
  sessions.forEach(({ id, createdAt }) => {
    const active = id === activeId ? chalk.green("▶") : " ";
    tbl.push([active, id === activeId ? chalk.green.bold(id) : chalk.white(id), chalk.dim(createdAt)]);
  });
  console.log("\n" + tbl.toString() + "\n");
}
