import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync } from "node:fs";
import { cpus, homedir, tmpdir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";

const WHISPER_BIN = process.env.WHISPER_BIN ?? "whisper-cli";
const MODELS_DIR = process.env.WHISPER_MODELS_DIR ?? join(homedir(), ".whisper-models");
const DEFAULT_MODEL = process.env.WHISPER_DEFAULT_MODEL ?? "base.en";
const DEFAULT_THREADS = process.env.WHISPER_THREADS ?? String(Math.max(1, Math.min(8, cpus().length - 1)));

export interface WhisperOptions {
  audioPath: string;
  model: string;
  language: string;
  srt: boolean;
  srtOutputPath: string | null;
  timeoutMs: number;
}

export interface WhisperResult {
  transcript: string;
  srtPath: string | null;
  modelUsed: string;
  latencyMs: number;
}

export function resolveModelPath(model: string): string {
  if (model.includes("/") || isAbsolute(model)) {
    const abs = resolve(model);
    if (!existsSync(abs)) throw new Error(`model file not found: ${abs}`);
    return abs;
  }
  const candidate = join(MODELS_DIR, `ggml-${model}.bin`);
  if (!existsSync(candidate)) {
    throw new Error(
      `model not found: ${candidate}. Download with:\n  curl -L -o "${candidate}" https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${model}.bin`,
    );
  }
  return candidate;
}

export function defaultModel(): string {
  return DEFAULT_MODEL;
}

export async function runWhisper(opts: WhisperOptions): Promise<WhisperResult> {
  const modelPath = resolveModelPath(opts.model);
  const work = mkdtempSync(join(tmpdir(), "transcribe-mcp-out-"));
  const outPrefix = join(work, "out");

  const args = [
    "-m", modelPath,
    "-f", opts.audioPath,
    "-of", outPrefix,
    "-otxt",
    "-l", opts.language,
    "-t", DEFAULT_THREADS,
    "-np",
  ];
  if (opts.srt) args.push("-osrt");

  const started = Date.now();
  const result = await new Promise<{ code: number | null; stderr: string }>((resolveP, rejectP) => {
    const child = spawn(WHISPER_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rejectP(new Error(`whisper-cli timed out after ${opts.timeoutMs}ms`));
    }, opts.timeoutMs);
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (err) => { clearTimeout(timer); rejectP(err); });
    child.on("close", (code) => { clearTimeout(timer); resolveP({ code, stderr }); });
  });
  const latencyMs = Date.now() - started;

  if (result.code !== 0) {
    try { rmSync(work, { recursive: true, force: true }); } catch { /* ignore */ }
    throw new Error(`whisper-cli exited with code ${result.code}: ${result.stderr.slice(-500)}`);
  }

  const txtPath = `${outPrefix}.txt`;
  const srtTmpPath = `${outPrefix}.srt`;
  let transcript = "";
  try {
    transcript = readFileSync(txtPath, "utf8").trim();
  } catch (err) {
    try { rmSync(work, { recursive: true, force: true }); } catch { /* ignore */ }
    throw new Error(`whisper-cli produced no transcript file at ${txtPath}`);
  }

  let finalSrtPath: string | null = null;
  if (opts.srt) {
    if (!existsSync(srtTmpPath)) {
      try { rmSync(work, { recursive: true, force: true }); } catch { /* ignore */ }
      throw new Error(`whisper-cli did not produce expected SRT at ${srtTmpPath}`);
    }
    const dest = opts.srtOutputPath ?? join(dirname(opts.audioPath), `${basename(opts.audioPath, extname(opts.audioPath))}.srt`);
    renameSync(srtTmpPath, dest);
    finalSrtPath = dest;
  }

  try { rmSync(work, { recursive: true, force: true }); } catch { /* ignore */ }
  return { transcript, srtPath: finalSrtPath, modelUsed: opts.model, latencyMs };
}
