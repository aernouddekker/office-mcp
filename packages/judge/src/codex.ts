import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VERDICT_JSON_SCHEMA } from "./verdictSchema.js";

export interface CodexCallResult {
  raw: string;
  tokensUsed: number | null;
  latencyMs: number;
}

export interface CodexCallOptions {
  systemPrompt: string;
  userPrompt: string;
  model: string | null;
  reasoningEffort: string;
  timeoutMs: number;
}

const TOKENS_USED_RE = /tokens used\s+([\d,]+)/i;

export async function callCodexJudge(opts: CodexCallOptions): Promise<CodexCallResult> {
  const work = mkdtempSync(join(tmpdir(), "judge-mcp-"));
  const schemaPath = join(work, "schema.json");
  const outPath = join(work, "out.json");
  writeFileSync(schemaPath, JSON.stringify(VERDICT_JSON_SCHEMA), "utf8");

  const args = [
    "exec",
    "--skip-git-repo-check",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "--sandbox", "read-only",
    "-c", `model_reasoning_effort="${opts.reasoningEffort}"`,
    "--output-schema", schemaPath,
    "--output-last-message", outPath,
  ];
  if (opts.model) {
    args.push("--model", opts.model);
  }
  args.push("-");

  const fullPrompt = `${opts.systemPrompt}\n\n--- PROPOSAL TO JUDGE ---\n${opts.userPrompt}\n`;
  const started = Date.now();

  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn("codex", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`codex exec timed out after ${opts.timeoutMs}ms`));
    }, opts.timeoutMs);
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (err) => { clearTimeout(timer); reject(err); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    child.stdin.write(fullPrompt);
    child.stdin.end();
  });

  const latencyMs = Date.now() - started;
  let raw = "";
  try { raw = readFileSync(outPath, "utf8").trim(); } catch { raw = ""; }
  try { rmSync(work, { recursive: true, force: true }); } catch { /* ignore */ }

  if (result.code !== 0) {
    throw new Error(`codex exec exited with code ${result.code}: ${result.stderr.slice(-400) || result.stdout.slice(-400)}`);
  }
  if (!raw) {
    throw new Error("codex exec produced no output");
  }

  const combined = `${result.stderr}\n${result.stdout}`;
  const m = TOKENS_USED_RE.exec(combined);
  const tokensUsed = m ? Number(m[1].replace(/,/g, "")) : null;

  return { raw, tokensUsed: Number.isFinite(tokensUsed) ? tokensUsed : null, latencyMs };
}
