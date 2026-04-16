/**
 * SessionService — Single Responsibility: manage thread/session lifecycle.
 *
 * Persistence strategy: JSON file at .deep-agent/sessions.json
 * Zero native dependencies — works on any Node 18+ without compilation.
 *
 * Upgrade path: swap the JSON adapter for a proper DB (SQLite/Postgres)
 * once the environment has native build tools.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR  = join(process.cwd(), ".deep-agent");
const STORE_PATH = join(DATA_DIR, "sessions.json");

mkdirSync(DATA_DIR, { recursive: true });

// ── JSON file adapter ─────────────────────────────────────────────────────────
function load() {
  if (!existsSync(STORE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function save(data) {
  writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
}

// ── SessionService ────────────────────────────────────────────────────────────
class SessionService {
  /**
   * Create a new session.
   * @param {string} [label] - Human-friendly label (defaults to short UUID)
   * @returns {{ id, label, createdAt, updatedAt }}
   */
  create(label = "") {
    const data = load();
    const id   = randomUUID();
    const now  = new Date().toISOString();
    data[id]   = { id, label: label || id.slice(0, 8), createdAt: now, updatedAt: now };
    save(data);
    return data[id];
  }

  /**
   * Get a session by id (returns null if not found).
   */
  get(id) {
    return load()[id] ?? null;
  }

  /**
   * List all sessions, newest-first (by updatedAt).
   * @returns {Array<{ id, label, createdAt, updatedAt }>}
   */
  list() {
    const data = load();
    return Object.values(data).sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  }

  /**
   * Mark a session as recently active (touch updatedAt).
   */
  touch(id) {
    const data = load();
    if (data[id]) {
      data[id].updatedAt = new Date().toISOString();
      save(data);
    }
  }

  /**
   * Delete a session by id.
   */
  delete(id) {
    const data = load();
    delete data[id];
    save(data);
  }
}

// Singleton export
export const sessionService = new SessionService();
