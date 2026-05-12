import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { homedir } from "node:os";

const LOG_PATH = process.env.JUDGE_LOG_PATH ?? `${homedir()}/judge-mcp/log.jsonl`;

let ensured = false;

function ensureDir(): void {
  if (ensured) return;
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  ensured = true;
}

export interface LogEntry {
  ts: string;
  action_type: string;
  proposal: unknown;
  actor_first_pass_verdict: string | null;
  verdict: unknown;
  latency_ms: number;
  model: string | null;
  reasoning_effort: string;
  tokens_used: number | null;
  error: string | null;
}

export function appendLog(entry: LogEntry): void {
  ensureDir();
  appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n", "utf8");
}

export function logPath(): string {
  return LOG_PATH;
}
