import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { extname, basename, join } from "node:path";
import { tmpdir } from "node:os";

const WHISPER_NATIVE_FORMATS = new Set([".wav", ".mp3", ".flac", ".ogg"]);
const FFMPEG_BIN = process.env.FFMPEG_BIN ?? "ffmpeg";

export interface NormalizedAudio {
  path: string;
  cleanup: () => void;
}

export async function normalizeAudio(filePath: string): Promise<NormalizedAudio> {
  if (!existsSync(filePath)) {
    throw new Error(`audio file not found: ${filePath}`);
  }
  const ext = extname(filePath).toLowerCase();
  if (WHISPER_NATIVE_FORMATS.has(ext)) {
    return { path: filePath, cleanup: () => {} };
  }

  const work = mkdtempSync(join(tmpdir(), "transcribe-mcp-"));
  const outPath = join(work, `${basename(filePath, ext)}.wav`);

  await new Promise<void>((resolve, reject) => {
    const args = ["-y", "-i", filePath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", outPath];
    const child = spawn(FFMPEG_BIN, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed (exit ${code}): ${stderr.slice(-400)}`));
    });
  });

  return {
    path: outPath,
    cleanup: () => {
      try { rmSync(work, { recursive: true, force: true }); } catch { /* ignore */ }
    },
  };
}
