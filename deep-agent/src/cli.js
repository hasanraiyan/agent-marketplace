#!/usr/bin/env node
import "dotenv/config";

// ─── CLI Libraries ────────────────────────────────────────────────────────────
import chalk from "chalk";
import figlet from "figlet";
import gradient from "gradient-string";
import boxen from "boxen";
import ora from "ora";
import logSymbols from "log-symbols";
import Table from "cli-table3";
import { input, select, confirm, editor } from "@inquirer/prompts";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

// ─── Agent Stack ──────────────────────────────────────────────────────────────
import { Command } from "@langchain/langgraph";
import { agent } from "./index.js";
import { store } from "./memory.js";
import { SkillService } from "./services/SkillService.js";
import { MemoryService } from "./services/MemoryService.js";

// ─── Markdown renderer setup ─────────────────────────────────────────────────
marked.setOptions({ renderer: new TerminalRenderer() });

// ─── Helpers ─────────────────────────────────────────────────────────────────
const dim     = (s) => chalk.dim(s);
const info    = (s) => `${logSymbols.info}  ${chalk.cyan(s)}`;
const success = (s) => `${logSymbols.success}  ${chalk.green(s)}`;
const warn    = (s) => `${logSymbols.warning}  ${chalk.yellow(s)}`;
const err     = (s) => `${logSymbols.error}  ${chalk.red(s)}`;

// ─── Banner ───────────────────────────────────────────────────────────────────
function printBanner() {
  const title = figlet.textSync("Deep-Agent", {
    font: "Small",
    horizontalLayout: "fitted",
  });

  console.log("\n" + gradient.teen(title));

  console.log(
    boxen(
      [
        chalk.bold.white("✦ Powered by")  + "  deepagents · Tavily · OpenAI",
        chalk.bold.white("✦ Sub-agents") + "  researcher (live web search)",
        chalk.bold.white("✦ Features")   + "   skills · memory · HITL · threads",
        "",
        dim("Type ") + chalk.yellow("/help") + dim(" to see all commands"),
      ].join("\n"),
      {
        padding: 1,
        margin: { top: 0, bottom: 1 },
        borderStyle: "round",
        borderColor: "cyan",
        dimBorder: false,
      }
    )
  );
}

// ─── Help table ───────────────────────────────────────────────────────────────
function printHelp() {
  const tbl = new Table({
    head: [chalk.cyan.bold("Command"), chalk.cyan.bold("Description")],
    style: { head: [], border: ["dim"] },
    colWidths: [22, 52],
  });

  const rows = [
    ["/help",             "Show this help"],
    ["/thread [id]",      "Show or switch conversation thread"],
    ["/skills",           "List loaded skills"],
    ["/skill-add [id]",   "Interactively add a skill (opens editor)"],
    ["/skill-rm [id]",    "Remove a skill by id"],
    ["/memory",           "Show last memory for current thread"],
    ["/approve",          "Approve a pending HITL tool call"],
    ["/reject [msg]",     "Reject a pending HITL tool call"],
    ["/state",            "Dump agent message history for thread"],
    ["/clear",            "Clear the terminal screen"],
    ["/exit",             "Quit the CLI"],
  ];

  rows.forEach(([cmd, desc]) =>
    tbl.push([chalk.yellow(cmd), dim(desc)])
  );

  console.log("\n" + tbl.toString() + "\n");
}

// ─── Services ─────────────────────────────────────────────────────────────────
const skillService  = new SkillService(store);
const memoryService = new MemoryService(agent);

// ─── State ────────────────────────────────────────────────────────────────────
let threadId    = process.env.DEFAULT_THREAD_ID || "default-user";
let pendingHITL = false;

const getConfig = () => ({ configurable: { thread_id: threadId } });

// ─── Agent runner ─────────────────────────────────────────────────────────────
async function runAgent(agentInput) {
  pendingHITL = false;

  // Spinner for the initial model "thinking" phase
  const spinner = ora({
    text: dim("Agent thinking…"),
    color: "cyan",
    spinner: "dots",
  }).start();

  let firstToken = true;

  try {
    const stream = agent.streamEvents(agentInput, {
      ...getConfig(),
      version: "v2",
    });

    let buffer = "";   // accumulate full response for markdown render
    let inStream = false;

    for await (const event of stream) {
      const { event: evtName, data, name } = event;

      // ── First token → stop spinner, start printing ──────────────────────
      if (evtName === "on_chat_model_stream") {
        const chunk = data?.chunk?.content;
        if (typeof chunk === "string" && chunk) {
          if (firstToken) {
            spinner.stop();
            firstToken = false;
            inStream = true;
            process.stdout.write(chalk.green.bold("\n 🤖 ") + chalk.green(""));
          }
          process.stdout.write(chalk.greenBright(chunk));
          buffer += chunk;
        }
      }

      // ── Tool call ────────────────────────────────────────────────────────
      if (evtName === "on_tool_start") {
        if (inStream) { process.stdout.write("\n"); inStream = false; }
        const toolName  = chalk.magenta.bold(name || data?.name || "tool");
        const toolArgs  = dim(JSON.stringify(data?.input ?? {}).slice(0, 120));
        const isTask    = (name === "task" || data?.name === "task");

        if (isTask) {
          const type = data?.input?.subagent_type ?? "?";
          const desc = data?.input?.description   ?? "";
          console.log(
            "\n" +
            boxen(
              `${chalk.yellow.bold("⚡ Sub-agent")}  ${chalk.yellow(type)}\n` +
              dim(desc.slice(0, 100)),
              { padding: { top: 0, bottom: 0, left: 1, right: 1 },
                borderStyle: "single", borderColor: "yellow" }
            )
          );
        } else {
          console.log(`\n ${logSymbols.info} ${toolName}  ${toolArgs}`);
        }
      }

      // ── Tool result ──────────────────────────────────────────────────────
      if (evtName === "on_tool_end") {
        const out = typeof data?.output === "string"
          ? data.output
          : JSON.stringify(data?.output ?? "");
        const preview = out.slice(0, 160) + (out.length > 160 ? "…" : "");
        console.log(` ${dim("↳")} ${dim(preview)}`);
      }

      // ── HITL interrupt ───────────────────────────────────────────────────
      if (evtName === "on_custom_event" && data?.type === "interrupt") {
        pendingHITL = true;
        spinner.stop();
        const toolName = data?.tool ?? "write_file";
        const args     = JSON.stringify(data?.args ?? {}, null, 2);

        console.log(
          "\n" +
          boxen(
            `${chalk.red.bold("⛔  HITL Interrupt")}\n\n` +
            `Agent wants to call ${chalk.red.bold(toolName)}\n` +
            dim(args.slice(0, 300)) + "\n\n" +
            chalk.yellow("Use /approve or /reject [feedback] to continue."),
            { padding: 1, borderStyle: "double", borderColor: "red" }
          )
        );
      }
    }

    spinner.stop();
    if (inStream) process.stdout.write("\n");

    // Render the full response as markdown
    if (buffer.trim()) {
      console.log(
        boxen(marked(buffer).trim(), {
          padding: { top: 0, bottom: 0, left: 1, right: 1 },
          margin: { top: 0, bottom: 1, left: 0, right: 0 },
          borderStyle: "none",
        })
      );
    }

  } catch (e) {
    spinner.stop();
    if (e?.name === "GraphInterrupt" || e?.message?.includes("interrupt")) {
      pendingHITL = true;
      console.log(warn("Agent is paused waiting for your decision."));
      console.log(dim("Use /approve or /reject [feedback]"));
    } else {
      console.log(err(e.message));
    }
  }
}

// ─── Slash-command handlers ───────────────────────────────────────────────────

async function cmdThread() {
  const current = chalk.cyan(threadId);
  console.log(info(`Current thread: ${current}`));

  const choice = await select({
    message: "What would you like to do?",
    choices: [
      { name: "Keep current thread", value: "keep" },
      { name: "Enter a new thread ID", value: "new" },
    ],
  });

  if (choice === "new") {
    const newId = await input({
      message: "New thread ID:",
      default: threadId,
      validate: (v) => v.trim().length > 0 || "Thread ID cannot be empty",
    });
    threadId    = newId.trim();
    pendingHITL = false;
    console.log(success(`Switched to thread: ${chalk.cyan(threadId)}`));
  }
}

async function cmdSkills() {
  let items = [];
  try {
    items = await store.search(["filesystem"]);
  } catch { /* empty store */ }

  const skills = items
    .map((i) => i.key)
    .filter((k) => k.startsWith("/skills/") && k.endsWith("/SKILL.md"));

  if (skills.length === 0) {
    console.log(warn("No skills loaded yet. Use /skill-add <id> to add one."));
    return;
  }

  const tbl = new Table({
    head: [chalk.cyan.bold("#"), chalk.cyan.bold("Skill ID"), chalk.cyan.bold("Path")],
    style: { head: [], border: ["dim"] },
  });

  skills.forEach((path, i) => {
    const id = path.replace("/skills/", "").replace("/SKILL.md", "");
    tbl.push([chalk.dim(String(i + 1)), chalk.yellow(id), dim(path)]);
  });

  console.log("\n" + tbl.toString() + "\n");
}

async function cmdSkillAdd(args) {
  let id = args.trim();
  if (!id) {
    id = await input({
      message: "Skill ID (e.g. color-expert):",
      validate: (v) => v.trim().length > 0 || "ID required",
    });
  }

  console.log(dim("An editor will open. Paste your SKILL.md content, save and close."));
  // editor() opens $EDITOR; falls back to a multi-line input prompt
  const content = await editor({
    message: "SKILL.md content:",
    default: `---\nname: ${id.trim()}\ndescription: Describe the skill here.\n---\n# ${id.trim()} Skill\n\nInstructions...`,
    waitForUseInput: false,
  });

  const spinner = ora({ text: dim(`Loading skill "${id}"…`), color: "magenta" }).start();
  await skillService.loadSkill(id.trim(), content);
  spinner.succeed(success(`Skill ${chalk.yellow(id)} loaded!`));
}

async function cmdSkillRemove(args) {
  let id = args.trim();
  if (!id) {
    id = await input({
      message: "Skill ID to remove:",
      validate: (v) => v.trim().length > 0 || "ID required",
    });
  }

  const ok = await confirm({ message: `Remove skill "${id}"?`, default: false });
  if (!ok) { console.log(dim("Cancelled.")); return; }

  await skillService.removeSkill(id.trim());
  console.log(success(`Skill ${chalk.yellow(id)} removed.`));
}

async function cmdMemory() {
  const spinner = ora({ text: dim("Fetching memory…"), color: "blue" }).start();
  try {
    const result = await memoryService.getMemory(threadId, "/memories/user.md");
    spinner.stop();
    console.log(
      boxen(
        `${chalk.blue.bold("Memory")}  ${dim("thread: " + threadId)}\n\n` +
        chalk.white(String(result)),
        { padding: 1, borderStyle: "round", borderColor: "blue" }
      )
    );
  } catch (e) {
    spinner.fail(err(e.message));
  }
}

async function cmdApprove() {
  if (!pendingHITL) {
    console.log(warn("No pending action to approve."));
    return;
  }
  const ok = await confirm({ message: chalk.green("Approve the pending action?"), default: true });
  if (!ok) { console.log(dim("Use /reject to reject instead.")); return; }
  console.log(success("Approving…"));
  await runAgent(new Command({ resume: { decisions: [{ type: "approve" }] } }));
}

async function cmdReject(args) {
  if (!pendingHITL) {
    console.log(warn("No pending action to reject."));
    return;
  }
  let feedback = args.trim();
  if (!feedback) {
    feedback = await input({
      message: "Rejection feedback (optional):",
      default: "Rejected by user.",
    });
  }
  console.log(`${logSymbols.error} Rejecting: ${dim(feedback)}`);
  await runAgent(new Command({ resume: { decisions: [{ type: "reject", message: feedback }] } }));
}

async function cmdState() {
  const spinner = ora({ text: dim("Loading state…"), color: "blue" }).start();
  let state;
  try {
    state = await agent.getState(getConfig());
    spinner.stop();
  } catch (e) {
    spinner.fail(err(e.message));
    return;
  }

  const msgs = state.values?.messages ?? [];
  if (msgs.length === 0) {
    console.log(warn("No messages in this thread yet."));
    return;
  }

  const tbl = new Table({
    head: [chalk.cyan.bold("#"), chalk.cyan.bold("Role"), chalk.cyan.bold("Content")],
    style: { head: [], border: ["dim"] },
    colWidths: [4, 14, 64],
    wordWrap: true,
  });

  msgs.forEach((m, i) => {
    const role    = m._getType?.() ?? m.role ?? "?";
    const content = typeof m.content === "string"
      ? m.content.slice(0, 120)
      : JSON.stringify(m.content).slice(0, 120);
    const roleColor =
      role === "human"     ? chalk.cyan(role)    :
      role === "ai"        ? chalk.green(role)   :
      role === "tool"      ? chalk.magenta(role) :
                             chalk.dim(role);
    tbl.push([chalk.dim(String(i)), roleColor, dim(content)]);
  });

  console.log("\n" + tbl.toString());

  if (state.next?.length) {
    console.log(warn(`Next nodes: ${state.next.join(", ")}`));
  }
  console.log();
}

// ─── Main REPL ────────────────────────────────────────────────────────────────
async function main() {
  printBanner();
  console.log(info(`Active thread: ${chalk.cyan.bold(threadId)}\n`));

  // fallback readline for the prompt (inquirer doesn't give a live prompt loop)
  const rl = readline.createInterface({ input: stdin, output: stdout, terminal: true });
  rl.on("SIGINT", () => { console.log(chalk.dim("\n\nBye! 👋")); process.exit(0); });

  while (true) {
    const prompt =
      chalk.dim(`[${threadId}]`) + " " +
      chalk.cyan.bold("you") + " " +
      chalk.dim("›") + " ";

    let line;
    try {
      line = await rl.question(prompt);
    } catch { break; }

    const trimmed = line.trim();
    if (!trimmed) continue;

    // ── Slash commands ──────────────────────────────────────────────────────
    if (trimmed.startsWith("/")) {
      const spaceIdx = trimmed.indexOf(" ");
      const cmd  = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toLowerCase();
      const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1);

      switch (cmd) {
        case "/help":       printHelp();                  break;
        case "/thread":     await cmdThread();            break;
        case "/skills":     await cmdSkills();            break;
        case "/skill-add":  await cmdSkillAdd(args);      break;
        case "/skill-rm":   await cmdSkillRemove(args);   break;
        case "/memory":     await cmdMemory();            break;
        case "/approve":    await cmdApprove();           break;
        case "/reject":     await cmdReject(args);        break;
        case "/state":      await cmdState();             break;
        case "/clear":      console.clear();              break;
        case "/exit":
        case "/quit":
          console.log(chalk.dim("Bye! 👋"));
          process.exit(0);
        default:
          console.log(err(`Unknown command: ${cmd} — type /help`));
      }
      continue;
    }

    // ── Chat ─────────────────────────────────────────────────────────────────
    await runAgent({ messages: [{ role: "user", content: trimmed }] });
  }

  rl.close();
}

main().catch((e) => {
  console.error(err(`Fatal: ${e.message}`));
  process.exit(1);
});
