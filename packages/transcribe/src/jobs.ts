import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export const JOBS_ROOT = process.env.TRANSCRIBE_JOBS_DIR ?? join(homedir(), ".transcribe-mcp", "jobs");

export type JobStatus = "queued" | "running" | "done" | "failed";

export interface JobArgs {
  source_file: string;
  model: string;
  language: string;
  srt: boolean;
  srt_destination: string | null;
}

export interface JobMeta {
  job_id: string;
  status: JobStatus;
  args: JobArgs;
  pid: number | null;
  submitted_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
}

export interface JobResult {
  transcript: string;
  srt_path: string | null;
  latency_ms: number;
}

export function ensureJobsRoot(): void {
  mkdirSync(JOBS_ROOT, { recursive: true });
}

export function jobDir(jobId: string): string {
  return join(JOBS_ROOT, jobId);
}

export function metaPath(jobId: string): string {
  return join(jobDir(jobId), "meta.json");
}

export function resultPath(jobId: string): string {
  return join(jobDir(jobId), "result.json");
}

export function createJob(args: JobArgs): JobMeta {
  ensureJobsRoot();
  const jobId = randomUUID();
  mkdirSync(jobDir(jobId), { recursive: true });
  const meta: JobMeta = {
    job_id: jobId,
    status: "queued",
    args,
    pid: null,
    submitted_at: new Date().toISOString(),
    started_at: null,
    finished_at: null,
    error: null,
  };
  writeMeta(meta);
  return meta;
}

export function readMeta(jobId: string): JobMeta | null {
  const p = metaPath(jobId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as JobMeta;
  } catch {
    return null;
  }
}

export function writeMeta(meta: JobMeta): void {
  writeFileSync(metaPath(meta.job_id), JSON.stringify(meta, null, 2), "utf8");
}

export function readResult(jobId: string): JobResult | null {
  const p = resultPath(jobId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as JobResult;
  } catch {
    return null;
  }
}

export function writeResult(jobId: string, result: JobResult): void {
  writeFileSync(resultPath(jobId), JSON.stringify(result, null, 2), "utf8");
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err?.code === "EPERM";
  }
}

export function deriveLiveStatus(meta: JobMeta): JobMeta {
  if (meta.status === "done" || meta.status === "failed" || meta.status === "queued") {
    return meta;
  }
  if (meta.pid && !isPidAlive(meta.pid)) {
    const hasResult = readResult(meta.job_id) !== null;
    if (hasResult) {
      const updated: JobMeta = { ...meta, status: "done", finished_at: meta.finished_at ?? new Date().toISOString() };
      writeMeta(updated);
      return updated;
    }
    const updated: JobMeta = {
      ...meta,
      status: "failed",
      finished_at: meta.finished_at ?? new Date().toISOString(),
      error: meta.error ?? "worker process exited without producing a result",
    };
    writeMeta(updated);
    return updated;
  }
  return meta;
}
