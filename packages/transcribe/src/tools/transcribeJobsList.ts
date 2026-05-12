import { z } from "zod";
import { existsSync, readdirSync } from "node:fs";
import { JOBS_ROOT, deriveLiveStatus, readMeta, type JobStatus } from "../jobs.js";

export const TranscribeJobsListInputShape = {
  status: z
    .enum(["queued", "running", "done", "failed"])
    .optional()
    .describe(
      "Optional status filter. Omit to return jobs in any state. Useful values: 'running' to recover in-flight work after a session restart; 'done' to scan a folder-of-recordings workflow for which transcripts are ready.",
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(200)
    .optional()
    .describe("Maximum number of jobs to return. Default 50, max 200. Most-recently-submitted jobs first."),
  since: z
    .string()
    .optional()
    .describe(
      "ISO 8601 timestamp. Only return jobs submitted at or after this instant. Useful for incremental polling.",
    ),
};

const InputSchema = z.object(TranscribeJobsListInputShape);
type Input = z.infer<typeof InputSchema>;

interface JobSummary {
  job_id: string;
  status: JobStatus;
  source_file: string;
  model: string;
  language: string;
  srt: boolean;
  submitted_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
}

export async function transcribeJobsList(input: Input): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const limit = input.limit ?? 50;
  const since = input.since ? Date.parse(input.since) : null;
  if (input.since && (since === null || Number.isNaN(since))) {
    return wrap({ error: `invalid 'since' timestamp: ${input.since}` });
  }

  if (!existsSync(JOBS_ROOT)) {
    return wrap({ jobs: [], total: 0, limit, jobs_dir: JOBS_ROOT });
  }

  const entries = readdirSync(JOBS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const summaries: JobSummary[] = [];
  for (const id of entries) {
    const meta = readMeta(id);
    if (!meta) continue;
    const live = deriveLiveStatus(meta);
    if (input.status && live.status !== input.status) continue;
    if (since !== null && Date.parse(live.submitted_at) < since) continue;
    summaries.push({
      job_id: live.job_id,
      status: live.status,
      source_file: live.args.source_file,
      model: live.args.model,
      language: live.args.language,
      srt: live.args.srt,
      submitted_at: live.submitted_at,
      started_at: live.started_at,
      finished_at: live.finished_at,
      error: live.error,
    });
  }

  summaries.sort((a, b) => Date.parse(b.submitted_at) - Date.parse(a.submitted_at));
  const totalMatched = summaries.length;
  const truncated = summaries.slice(0, limit);

  return wrap({
    jobs: truncated,
    total: totalMatched,
    returned: truncated.length,
    limit,
    jobs_dir: JOBS_ROOT,
  });
}

function wrap(payload: Record<string, unknown>): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}
