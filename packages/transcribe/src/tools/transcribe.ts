import { z } from "zod";
import { basename, dirname, extname, join, resolve as resolvePath } from "node:path";
import { homedir } from "node:os";
import { normalizeAudio } from "../normalize.js";
import { defaultModel, runWhisper } from "../whisper.js";

function expandHome(p: string): string {
  if (p.startsWith("~/")) return resolvePath(homedir(), p.slice(2));
  if (p === "~") return homedir();
  return resolvePath(p);
}

export const TranscribeInputShape = {
  file_path: z
    .string()
    .min(1)
    .describe(
      "Absolute or ~-relative path to an audio file (wav / mp3 / flac / ogg natively; m4a / mp4 / aac / opus auto-converted via ffmpeg).",
    ),
  model: z
    .string()
    .optional()
    .describe(
      "Whisper model name (e.g. tiny.en, base.en, small.en, medium.en, large-v3, large-v3-turbo). Resolves to $WHISPER_MODELS_DIR/ggml-<model>.bin. Pass an absolute path or a path containing '/' to use a specific model file. Default is set via $WHISPER_DEFAULT_MODEL (currently base.en).",
    ),
  language: z
    .string()
    .optional()
    .describe(
      "Source language code (e.g. en, nl, fr) or 'auto' for auto-detection. Defaults to 'auto'. .en model variants ignore this and assume English.",
    ),
  srt: z
    .boolean()
    .optional()
    .describe(
      "If true, also write an SRT subtitle file next to the input (same basename, .srt extension). Returned in the response under srt_path.",
    ),
};

const InputSchema = z.object(TranscribeInputShape);
type Input = z.infer<typeof InputSchema>;

const TIMEOUT_MS = Number(process.env.TRANSCRIBE_TIMEOUT_MS ?? 600000);

export async function transcribe(input: Input): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const filePath = expandHome(input.file_path);
  const model = input.model ?? defaultModel();
  const language = input.language ?? "auto";
  const srt = input.srt ?? false;

  let cleanup: (() => void) | null = null;
  try {
    const normalized = await normalizeAudio(filePath);
    cleanup = normalized.cleanup;
    const srtDest = srt ? join(dirname(filePath), `${basename(filePath, extname(filePath))}.srt`) : null;
    const result = await runWhisper({
      audioPath: normalized.path,
      model,
      language,
      srt,
      srtOutputPath: srtDest,
      timeoutMs: TIMEOUT_MS,
    });

    const payload = {
      transcript: result.transcript,
      srt_path: result.srtPath,
      model: result.modelUsed,
      language,
      latency_ms: result.latencyMs,
      source_file: filePath,
    };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const payload = { error: msg, source_file: filePath, model, language };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  } finally {
    if (cleanup) cleanup();
  }
}
