# office-mcp

MCP servers for office workflows — gives [Claude Desktop](https://claude.ai/download), [Claude Code](https://claude.ai/code), and any MCP client tools that need external APIs, file I/O, or services beyond what the sandboxed skill runtime allows.

Runs as host-side Node processes connected to the MCP client over stdio, so network calls (e.g. OpenAI's Images API) work even when the client's sandbox blocks egress.

## Servers

### Imagegen (`@aernoud/imagegenmcp`)

Generate PNG images from text prompts via OpenAI's Images API.

| Tool | Description |
|------|-------------|
| `generate-image` | Generate one or more images from a prompt. Saves to disk and returns them inline. Supports `gpt-image-1.5` / `gpt-image-2` (default), `gpt-image-1`, `gpt-image-1-mini`, `dall-e-3`, `dall-e-2`. |

**Auth:** reads `OPENAI_API_KEY` from env, falling back to `~/.config/openai/api_key` (single-line, `chmod 600`).

**Billing:** calls hit the OpenAI Platform wallet — *not* ChatGPT Plus/Pro.

### Print (`@aernoud/printmcp`)

Wraps the macOS CUPS print system (`lp`, `lpstat`, `lpoptions`, `cancel`). Discovers any printer the Mac knows about — local USB, network, AirPrint, shared from another Mac. No AppleScript involved; runs as a shell wrapper.

| Tool | Description |
|------|-------------|
| `list-printers` | List all CUPS printers with status, location, default flag |
| `get-printer-options` | List supported PPD options for a printer (sides, media size, color mode, …) with current defaults |
| `print-file` | Print a local file (PDF, plain text, JPEG/PNG, PostScript) with copies, duplex, paper size, page ranges, fit-to-page, and arbitrary `lp` options |
| `list-print-jobs` | List active print jobs (optionally filtered to a printer) |
| `cancel-print-job` | Cancel a queued or printing job by id |

Composes naturally with the `mailappmcp` server in [osx-mcp](https://github.com/aernouddekker/osx-mcp): e.g. *"print the attachment of the latest email from Hadi"* — search the message, `save-attachment` to a temp dir, then `print-file`.

## Install

```bash
npm install
npm run build
```

## Claude Desktop configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "imagegen": {
      "command": "node",
      "args": ["/Users/aernouddekker/Development/office-mcp/packages/imagegen/dist/index.js"]
    },
    "printmcp": {
      "command": "node",
      "args": ["/Users/aernouddekker/Development/office-mcp/packages/print/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop. The new tools will appear in the tool list.

## Claude Code configuration

```bash
claude mcp add imagegen node /Users/aernouddekker/Development/office-mcp/packages/imagegen/dist/index.js
claude mcp add printmcp node /Users/aernouddekker/Development/office-mcp/packages/print/dist/index.js
```
