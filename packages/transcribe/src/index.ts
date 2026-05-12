#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TranscribeInputShape, transcribe } from "./tools/transcribe.js";
import { TranscribeSubmitInputShape, transcribeSubmit } from "./tools/transcribeSubmit.js";
import { TranscribeStatusInputShape, transcribeStatus } from "./tools/transcribeStatus.js";
import { TranscribeJobsListInputShape, transcribeJobsList } from "./tools/transcribeJobsList.js";

const server = new McpServer({
  name: "transcribemcp",
  version: "0.2.0",
});

server.tool(
  "transcribe",
  "Synchronously transcribe an audio file to text using whisper.cpp. Use for short clips (typically < 5 minutes) where the result is needed in the same response. Accepts wav/mp3/flac/ogg natively and auto-converts m4a/mp4/aac/opus via ffmpeg. Optionally writes an SRT next to the input. For longer recordings, use transcribe_submit + transcribe_status — the synchronous tool will hit the MCP client request timeout (~60-120s) on long audio.",
  TranscribeInputShape,
  async (input) => transcribe(input as Parameters<typeof transcribe>[0]),
);

server.tool(
  "transcribe_submit",
  "Submit a transcription job asynchronously and return a job_id immediately. Spawns a detached worker that survives MCP server restarts; the job runs to completion in the background. Use for long recordings (interviews, meetings, podcasts) where a synchronous call would time out. Poll with transcribe_status to retrieve the result. Same input as transcribe.",
  TranscribeSubmitInputShape,
  async (input) => transcribeSubmit(input as Parameters<typeof transcribeSubmit>[0]),
);

server.tool(
  "transcribe_status",
  "Poll the status of an async transcription job. Returns one of queued | running | done | failed. When status=done, the response includes transcript, srt_path, and latency_ms. When status=failed, includes error. The started_at field doubles as running_since — use it with model + audio duration to estimate ETA. Poll every few seconds for short jobs, every 30-60s for long-form recordings.",
  TranscribeStatusInputShape,
  async (input) => transcribeStatus(input as Parameters<typeof transcribeStatus>[0]),
);

server.tool(
  "transcribe_jobs_list",
  "List async transcription jobs known to the server. Use to (a) rediscover in-flight jobs after a session restart — when you've lost track of job_ids; (b) drive folder-of-recordings workflows: list → status (done) → fetch transcripts. Returns summaries only (no transcript bodies); call transcribe_status with a job_id for the full result. Sorted most-recent-first. Supports status filter, limit, and since timestamp.",
  TranscribeJobsListInputShape,
  async (input) => transcribeJobsList(input as Parameters<typeof transcribeJobsList>[0]),
);

const transport = new StdioServerTransport();
await server.connect(transport);
