# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## What This Is

A monorepo of MCP servers for office workflows that need to escape Claude Desktop's sandbox (network egress, external APIs, etc.). Runs as host-side Node processes connected over stdio. Companion repo to `osx-mcp` (native-app wrappers); this repo focuses on external-service MCPs.

## Build & Run

```bash
npm install               # Install all workspace dependencies
npm run build             # Build all workspace packages
npm run build --workspace=packages/imagegen    # Build a single package
```

Each server runs over stdio. Launch via `node packages/<name>/dist/index.js`.

## Architecture

**Monorepo:** npm workspaces, one server package per subfolder under `packages/`.

**Pattern:** Each server's `src/index.ts` creates an `McpServer`, registers tools with Zod schemas, connects via `StdioServerTransport`. Tool implementations live under `src/tools/<toolName>.ts`. No shared package until a second server justifies one.

## Current servers

| Package | npm name | Purpose |
|---------|----------|---------|
| `packages/imagegen` | `@aernoud/imagegenmcp` | OpenAI Images API (`gpt-image-1.5` / `gpt-image-2`, DALL·E) — text-to-image |

## Key Constraints

- **Node 18+** required (uses native `fetch`).
- **API keys** resolved in order: `$OPENAI_API_KEY` env var → `~/.config/openai/api_key` file. Never hard-code.
- **Image output**: save PNG to `~/Downloads/` by default, return the image inline in the MCP response so Claude Desktop renders it.
- **OpenAI Images API facts** (verified 22 April 2026 against `developers.openai.com`):
  - Canonical model enum: `gpt-image-1.5 | gpt-image-1 | gpt-image-1-mini | dall-e-2 | dall-e-3`. `gpt-image-2` is an alias that resolves to the same model as `gpt-image-1.5`.
  - `size` for GPT models: `1024x1024 | 1536x1024 | 1024x1536 | auto` — long side capped at 1536.
  - `quality`: `low | medium | high | auto` for gpt-image-*; `standard | hd` for dall-e-3.
  - `n`: 1..10 (dall-e-3 is 1 only).
  - No `thinking` / `reasoning` parameter exists on `/v1/images/generations`. Do not add one.
  - `response_format` was removed for GPT image models; they always return base64. DALL·E models may return a URL — handle both.
  - GPT image models always return base64 in `data[].b64_json`. DALL·E may return `data[].url` instead — fetch it with a second HTTP call.
