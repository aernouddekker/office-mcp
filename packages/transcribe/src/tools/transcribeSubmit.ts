import { z } from "zod";
import { spawn } from "node:child_process";
import { existsSync, openSync } from "node:fs";
import { basename, dirname, extname, join, resolve as resolvePath } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { createJob, jobDir } from "../jobs.js";
import { defaultModel, resolveModelPath } from "../whisper.js";

function expandHome(p: string): string {
  if (p.startsWith("~/")) return resolvePath(homedir(), p.slice(2));
  if (p === "~") return homedir();
  return resolvePath(p);
}

export const TranscribeSubmitInputShape = {
  file_path: z.string().min(1).describe(
    "Absolute or ~-relative path to an audio file (wav / mp3 / flac / ogg natively; m4a / mp4 / aac / opus auto-converted via ffmpeg).",
  ),
  model: z.string().optional().describe(
    "Whisper model name (e.g. large-v3, large-v3-turbo, medium.en). Resolves to $WHISPER_MODELS_DIR/ggml-<model>.bin.",
  ),
  language: z.string().optional().describe(
    "Source language code (e.g. en, nl, fr) or 'auto'. Defaults to 'auto'.",
  ),
  srt: z.boolean().optional().describe(
    "If true, also write an SRT subtitle file next to the input file.",
  ),
};

const InputSchema = z.object(TranscribeSubmitInputShape);
type Input = z.infer<typeof InputSchema>;

// Resolve the worker script path at import time. dist/worker.js sits next to dist/index.js.
const WORKER_PATH = fileURLToPath(new URL("../worker.js", import.meta.url));

export async function transcribeSubmit(input: Input): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const filePath = expandHome(input.file_path);
  const model = input.model ?? defaultModel();
  const language = input.language ?? "auto";
  const srt = input.srt ?? false;

  if (!existsSync(filePath)) {
    return errorResponse({ error: `audio file not found: ${filePath}`, source_file: filePath, model, language });
  }
  try {
    resolveModelPath(model);
  } catch (err) {
    return errorResponse({ error: err instanceof Error ? err.message : String(err), source_file: filePath, model, language });
  }

  const srtDest = srt ? join(dirname(filePath), `${basename(filePath, extname(filePath))}.srt`) : null;
  const meta = createJob({
    source_file: filePath,
    model,
    language,
    srt,
    srt_destination: srtDest,
  });

  const logFd = openSync(join(jobDir(meta.job_id), "stdout.log"), "a");
  const errFd = openSync(join(jobDir(meta.job_id), "stderr.log"), "a");
  const child = spawn(process.execPath, [WORKER_PATH, meta.job_id], {
    detached: true,
    stdio: ["ignore", logFd, errFd],
    env: { ...process.env },
  });
  child.unref();

  const payload = {
    job_id: meta.job_id,
    status: "queued" as const,
    source_file: filePath,
    model,
    language,
    srt,
    srt_destination: srtDest,
    submitted_at: meta.submitted_at,
    worker_pid: child.pid ?? null,
    hint: "Poll with transcribe_status. Typical large-v3 throughput on Apple Silicon: ~10-20x realtime.",
  };
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

function errorResponse(payload: Record<string, unknown>): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}
