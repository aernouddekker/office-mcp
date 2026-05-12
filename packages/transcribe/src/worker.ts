#!/usr/bin/env node
// Detached worker. Spawned by transcribe_submit; survives parent (MCP server) restart.
// argv[2] = job_id

import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { jobDir, readMeta, writeMeta, writeResult } from "./jobs.js";
import { normalizeAudio } from "./normalize.js";
import { runWhisper } from "./whisper.js";

const jobId = process.argv[2];
if (!jobId) {
  console.error("worker: missing job_id argument");
  process.exit(2);
}

const logPath = join(jobDir(jobId), "worker.log");
function log(msg: string): void {
  try {
    appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch { /* ignore */ }
}

async function main(): Promise<void> {
  const meta = readMeta(jobId);
  if (!meta) {
    log(`worker: meta.json not found for job ${jobId}`);
    process.exit(3);
  }
  log(`worker started, pid=${process.pid}, args=${JSON.stringify(meta.args)}`);

  writeMeta({
    ...meta,
    status: "running",
    pid: process.pid,
    started_at: new Date().toISOString(),
  });

  let cleanup: (() => void) | null = null;
  try {
    const normalized = await normalizeAudio(meta.args.source_file);
    cleanup = normalized.cleanup;
    log(`normalized audio at ${normalized.path}`);

    const result = await runWhisper({
      audioPath: normalized.path,
      model: meta.args.model,
      language: meta.args.language,
      srt: meta.args.srt,
      srtOutputPath: meta.args.srt_destination,
      timeoutMs: Number(process.env.TRANSCRIBE_TIMEOUT_MS ?? 3600000),
    });
    log(`whisper completed in ${result.latencyMs}ms`);

    writeResult(jobId, {
      transcript: result.transcript,
      srt_path: result.srtPath,
      latency_ms: result.latencyMs,
    });
    writeMeta({
      ...meta,
      status: "done",
      pid: process.pid,
      started_at: meta.started_at ?? new Date().toISOString(),
      finished_at: new Date().toISOString(),
      error: null,
    });
    log("worker finished successfully");
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`worker failed: ${msg}`);
    writeMeta({
      ...meta,
      status: "failed",
      pid: process.pid,
      started_at: meta.started_at ?? new Date().toISOString(),
      finished_at: new Date().toISOString(),
      error: msg,
    });
    process.exit(1);
  } finally {
    if (cleanup) cleanup();
  }
}

main().catch((err) => {
  log(`worker unhandled: ${err?.message ?? err}`);
  process.exit(1);
});
