#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { JudgeActionInputShape, judgeAction } from "./tools/judgeAction.js";

const server = new McpServer({
  name: "judgemcp",
  version: "0.1.0",
});

server.tool(
  "judge_action",
  "Adjudicate a structured action proposal against the configured policy and return a verdict (allow / revise / block / escalate). Calls a frontier reasoning model via the Codex CLI (uses ChatGPT subscription auth). Does NOT execute the action. Designed as a second-opinion guardrail before high-risk actions like outbound email — the actor calls this and honours the verdict. On any failure the judge returns verdict=escalate (fail-closed). Latency 10-60s.",
  JudgeActionInputShape,
  async (input) => {
    return await judgeAction(input as Parameters<typeof judgeAction>[0]);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
