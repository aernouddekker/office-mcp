import { z } from "zod";
import { deriveLiveStatus, readMeta, readResult } from "../jobs.js";

export const TranscribeStatusInputShape = {
  job_id: z.string().uuid().describe(
    "Job id returned by transcribe_submit.",
  ),
};

const InputSchema = z.object(TranscribeStatusInputShape);
type Input = z.infer<typeof InputSchema>;

export async function transcribeStatus(input: Input): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const meta = readMeta(input.job_id);
  if (!meta) {
    return wrap({ error: `job not found: ${input.job_id}`, job_id: input.job_id });
  }
  const live = deriveLiveStatus(meta);
  const base = {
    job_id: live.job_id,
    status: live.status,
    source_file: live.args.source_file,
    model: live.args.model,
    language: live.args.language,
    srt: live.args.srt,
    submitted_at: live.submitted_at,
    started_at: live.started_at,
    finished_at: live.finished_at,
  };

  if (live.status === "done") {
    const result = readResult(live.job_id);
    if (!result) {
      return wrap({ ...base, status: "failed", error: "marked done but result.json missing" });
    }
    return wrap({
      ...base,
      transcript: result.transcript,
      srt_path: result.srt_path,
      latency_ms: result.latency_ms,
    });
  }
  if (live.status === "failed") {
    return wrap({ ...base, error: live.error });
  }
  // queued or running
  const elapsedMs = live.started_at ? Date.now() - new Date(live.started_at).getTime() : Date.now() - new Date(live.submitted_at).getTime();
  return wrap({ ...base, elapsed_ms: elapsedMs, hint: "Not yet complete. Poll again in a few seconds." });
}

function wrap(payload: Record<string, unknown>): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}
