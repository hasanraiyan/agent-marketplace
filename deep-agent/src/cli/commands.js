/**
 * Commands — Single Responsibility: handle all /slash commands.
 * Each export is an async function that receives the CLI context object.
 */
import chalk from "chalk";
import { Command } from "@langchain/langgraph";
import { input, select, confirm, editor } from "@inquirer/prompts";

import {
  log, sym,
  renderMarkdown, renderSessions, renderSkills, renderMessages,
} from "./renderer.js";
import { sessionService } from "./sessions.js";
import { runAgent } from "./runner.js";

// ─── /help ────────────────────────────────────────────────────────────────────
export function cmdHelp(ctx) {
  const { makeTable } = ctx.renderer;
  const tbl = makeTable(["Command", "Description"], [22, 54]);
  [
    ["/help",              "Show this help"],
    ["/new [label]",       "Create a new session (fresh thread)"],
    ["/sessions",          "List all saved sessions"],
    ["/switch",            "Switch to a different session interactively"],
    ["/delete",            "Delete the current session"],
    ["/skills",            "List loaded skills"],
    ["/skill-add [id]",    "Add a skill (opens editor)"],
    ["/skill-rm [id]",     "Remove a skill by id"],
    ["/memory",            "Show last memory for current thread"],
    ["/approve",           "Approve a pending HITL tool call"],
    ["/reject [msg]",      "Reject a pending HITL tool call"],
    ["/state",             "Dump message history for current thread"],
    ["/clear",             "Clear the terminal"],
    ["/exit",              "Quit the CLI"],
  ].forEach(([cmd, desc]) => tbl.push([chalk.yellow(cmd), chalk.dim(desc)]));
  console.log("\n" + tbl.toString() + "\n");
}

// ─── /new ─────────────────────────────────────────────────────────────────────
export async function cmdNew(ctx, args) {
  let label = args.trim();
  if (!label) {
    label = await input({
      message: "Session label (optional, press Enter to skip):",
      default: "",
    });
  }
  const session = sessionService.create(label.trim());
  ctx.state.threadId    = session.id;
  ctx.state.pendingHITL = false;
  log.ok(`New session created: ${chalk.cyan(session.label)} ${chalk.dim("(" + session.id + ")")}`);
}

// ─── /sessions ────────────────────────────────────────────────────────────────
export function cmdSessions(ctx) {
  const sessions = sessionService.list();
  const formatted = sessions.map((s) => ({
    id:        s.id,
    label:     s.label,
    createdAt: new Date(s.createdAt).toLocaleString(),
  }));
  renderSessions(formatted, ctx.state.threadId);
}

// ─── /switch ─────────────────────────────────────────────────────────────────
export async function cmdSwitch(ctx) {
  const sessions = sessionService.list();
  if (!sessions.length) {
    log.warn("No sessions yet. Use /new to create one.");
    return;
  }
  const choices = sessions.map((s) => ({
    name: `${chalk.cyan(s.label)}  ${chalk.dim(s.id.slice(0, 8) + "…")}  ${chalk.dim(new Date(s.createdAt).toLocaleString())}`,
    value: s.id,
  }));
  const chosen = await select({ message: "Switch to session:", choices });
  sessionService.touch(chosen);
  ctx.state.threadId    = chosen;
  ctx.state.pendingHITL = false;
  const s = sessionService.get(chosen);
  log.ok(`Switched to: ${chalk.cyan(s.label)} ${chalk.dim("(" + s.id + ")")}`);
}

// ─── /delete ─────────────────────────────────────────────────────────────────
export async function cmdDelete(ctx) {
  const ok = await confirm({
    message: chalk.red(`Delete session "${ctx.state.threadId}"? This cannot be undone.`),
    default: false,
  });
  if (!ok) { log.dim("Cancelled."); return; }
  sessionService.delete(ctx.state.threadId);
  // create a fresh session automatically
  const session = sessionService.create();
  ctx.state.threadId    = session.id;
  ctx.state.pendingHITL = false;
  log.ok(`Session deleted. New session: ${chalk.cyan(session.id.slice(0, 8))}`);
}

// ─── /skills ─────────────────────────────────────────────────────────────────
export async function cmdSkills(ctx) {
  let items = [];
  try { items = await ctx.store.search(["filesystem"]); } catch { /* empty */ }
  const ids = items
    .map((i) => i.key)
    .filter((k) => k.startsWith("/skills/") && k.endsWith("/SKILL.md"))
    .map((k) => k.replace("/skills/", "").replace("/SKILL.md", ""));
  renderSkills(ids);
}

// ─── /skill-add ───────────────────────────────────────────────────────────────
export async function cmdSkillAdd(ctx, args) {
  let id = args.trim();
  if (!id) {
    id = await input({
      message: "Skill ID (e.g. python-expert):",
      validate: (v) => v.trim().length > 0 || "ID is required",
    });
  }
  const content = await editor({
    message: `SKILL.md content for "${id.trim()}":`,
    default: `---\nname: ${id.trim()}\ndescription: Describe what this skill does.\n---\n# ${id.trim()}\n\nInstructions for the agent...\n`,
    waitForUseInput: false,
  });
  await ctx.skillService.loadSkill(id.trim(), content);
  log.ok(`Skill ${chalk.yellow(id)} loaded.`);
}

// ─── /skill-rm ────────────────────────────────────────────────────────────────
export async function cmdSkillRemove(ctx, args) {
  let id = args.trim();
  if (!id) {
    id = await input({
      message: "Skill ID to remove:",
      validate: (v) => v.trim().length > 0 || "ID is required",
    });
  }
  const ok = await confirm({ message: `Remove skill "${id}"?`, default: false });
  if (!ok) { log.dim("Cancelled."); return; }
  await ctx.skillService.removeSkill(id.trim());
  log.ok(`Skill ${chalk.yellow(id)} removed.`);
}

// ─── /memory ──────────────────────────────────────────────────────────────────
export async function cmdMemory(ctx) {
  try {
    const result = await ctx.memoryService.getMemory(ctx.state.threadId, "/memories/user.md");
    console.log(
      `\n${chalk.blue.bold("Memory")} ${chalk.dim("· thread: " + ctx.state.threadId)}`
    );
    renderMarkdown(String(result));
  } catch (e) {
    log.err(e.message);
  }
}

// ─── /approve ─────────────────────────────────────────────────────────────────
export async function cmdApprove(ctx) {
  if (!ctx.state.pendingHITL) { log.warn("No pending action to approve."); return; }
  const ok = await confirm({ message: chalk.green("Approve the pending action?"), default: true });
  if (!ok) { log.dim("Use /reject instead."); return; }
  log.ok("Approving…");
  await runAgent(
    new Command({ resume: { decisions: [{ type: "approve" }] } }),
    ctx.agent,
    () => ({ configurable: { thread_id: ctx.state.threadId } }),
    { onHITL: () => { ctx.state.pendingHITL = true; } }
  );
}

// ─── /reject ──────────────────────────────────────────────────────────────────
export async function cmdReject(ctx, args) {
  if (!ctx.state.pendingHITL) { log.warn("No pending action to reject."); return; }
  let feedback = args.trim();
  if (!feedback) {
    feedback = await input({ message: "Rejection feedback:", default: "Rejected by user." });
  }
  log.warn(`Rejecting: ${chalk.dim(feedback)}`);
  await runAgent(
    new Command({ resume: { decisions: [{ type: "reject", message: feedback }] } }),
    ctx.agent,
    () => ({ configurable: { thread_id: ctx.state.threadId } }),
    { onHITL: () => { ctx.state.pendingHITL = true; } }
  );
}

// ─── /state ───────────────────────────────────────────────────────────────────
export async function cmdState(ctx) {
  try {
    const state = await ctx.agent.getState({ configurable: { thread_id: ctx.state.threadId } });
    renderMessages(state.values?.messages ?? [], state.next ?? []);
  } catch (e) {
    log.err(e.message);
  }
}
