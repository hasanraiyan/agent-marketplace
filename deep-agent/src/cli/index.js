/**
 * CLI entry point — Single Responsibility: the REPL loop only.
 * Assembles the context, prints the banner, routes /commands and chat.
 */
import "dotenv/config";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

import chalk from "chalk";
import figlet from "figlet";
import gradient from "gradient-string";
import boxen from "boxen";
import ora from "ora";

import { agent }                from "../index.js";
import { store }                from "../memory.js";
import { SkillService }         from "../services/SkillService.js";
import { MemoryService }        from "../services/MemoryService.js";
import { sessionService }       from "./sessions.js";
import { runAgent }             from "./runner.js";
import { makeTable, log }       from "./renderer.js";

import {
  cmdHelp,
  cmdNew,
  cmdSessions,
  cmdSwitch,
  cmdDelete,
  cmdSkills,
  cmdSkillAdd,
  cmdSkillRemove,
  cmdMemory,
  cmdApprove,
  cmdReject,
  cmdState,
} from "./commands.js";

// ─── Banner ───────────────────────────────────────────────────────────────────
function printBanner() {
  const title = figlet.textSync("Deep-Agent", { font: "Small", horizontalLayout: "fitted" });
  console.log("\n" + gradient.teen(title));
  console.log(
    boxen(
      [
        `${chalk.white.bold("✦ Backend")}     deepagents · OpenAI · SQLite`,
        `${chalk.white.bold("✦ Tools")}       search_web (Tavily)`,
        `${chalk.white.bold("✦ Sub-agents")}  researcher`,
        `${chalk.white.bold("✦ Features")}    skills · memory · HITL · sessions`,
        "",
        chalk.dim("Type ") + chalk.yellow("/help") + chalk.dim(" for all commands"),
      ].join("\n"),
      {
        padding: 1,
        margin: { top: 0, bottom: 1 },
        borderStyle: "round",
        borderColor: "cyan",
      }
    )
  );
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap() {
  // Create or restore the most-recent session
  const sessions = sessionService.list();
  let session = sessions[0];
  if (!session) {
    session = sessionService.create("default");
  }

  return {
    // Mutable shared state — passed as `ctx.state` to all commands
    state: {
      threadId:    session.id,
      pendingHITL: false,
    },
    // Services
    agent,
    store,
    skillService:  new SkillService(store),
    memoryService: new MemoryService(agent),
    // Renderer helper passthrough for commands that build tables
    renderer: { makeTable },
  };
}

// ─── Command router ───────────────────────────────────────────────────────────
async function handleCommand(cmdRaw, args, ctx) {
  const cmd = cmdRaw.toLowerCase();
  switch (cmd) {
    case "/help":       cmdHelp(ctx);                        break;
    case "/new":        await cmdNew(ctx, args);             break;
    case "/sessions":   cmdSessions(ctx);                    break;
    case "/switch":     await cmdSwitch(ctx);                break;
    case "/delete":     await cmdDelete(ctx);                break;
    case "/skills":     await cmdSkills(ctx);                break;
    case "/skill-add":  await cmdSkillAdd(ctx, args);        break;
    case "/skill-rm":   await cmdSkillRemove(ctx, args);     break;
    case "/memory":     await cmdMemory(ctx);                break;
    case "/approve":    await cmdApprove(ctx);               break;
    case "/reject":     await cmdReject(ctx, args);          break;
    case "/state":      await cmdState(ctx);                 break;
    case "/clear":      console.clear();                     break;
    case "/exit":
    case "/quit":
      console.log(chalk.dim("\nBye! 👋"));
      process.exit(0);
    default:
      log.err(`Unknown command: ${cmdRaw} — type /help`);
  }
}

// ─── REPL ─────────────────────────────────────────────────────────────────────
async function main() {
  printBanner();

  const spinner = ora({ text: chalk.dim("Initialising agent…"), color: "cyan" }).start();
  const ctx = await bootstrap();
  spinner.succeed(chalk.dim(`Session restored: ${chalk.cyan(ctx.state.threadId.slice(0, 12))}…`));

  const rl = readline.createInterface({ input: stdin, output: stdout, terminal: true });
  rl.on("SIGINT", () => { console.log(chalk.dim("\nBye! 👋")); process.exit(0); });

  while (true) {
    // Dynamic prompt shows current thread identifier
    const session = sessionService.get(ctx.state.threadId);
    const label   = session?.label ?? ctx.state.threadId.slice(0, 8);
    const hitl    = ctx.state.pendingHITL ? chalk.red(" [HITL]") : "";

    const prompt =
      chalk.dim("[") + chalk.cyan(label) + chalk.dim("]") +
      hitl + " " +
      chalk.cyan.bold("you") + " " +
      chalk.dim("›") + " ";

    let line;
    try {
      line = await rl.question(prompt);
    } catch {
      break; // EOF
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    // ── Slash commands ──────────────────────────────────────────────────────
    if (trimmed.startsWith("/")) {
      const spaceIdx = trimmed.indexOf(" ");
      const cmd  = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
      const args = spaceIdx === -1 ? ""      : trimmed.slice(spaceIdx + 1);
      await handleCommand(cmd, args, ctx);
      continue;
    }

    // ── Chat ─────────────────────────────────────────────────────────────────
    sessionService.touch(ctx.state.threadId);
    ctx.state.pendingHITL = false;

    await runAgent(
      { messages: [{ role: "user", content: trimmed }] },
      ctx.agent,
      () => ({ configurable: { thread_id: ctx.state.threadId } }),
      { onHITL: () => { ctx.state.pendingHITL = true; } }
    );
  }

  rl.close();
}

main().catch((e) => {
  console.error(chalk.red(`Fatal: ${e.message}`));
  process.exit(1);
});
