import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function resolveApiKey(): string {
  const env = process.env.OPENAI_API_KEY;
  if (env && env.trim()) return env.trim();
  const keyFile = path.join(os.homedir(), ".config/openai/api_key");
  if (fs.existsSync(keyFile)) {
    return fs.readFileSync(keyFile, "utf8").trim();
  }
  throw new Error(
    "OPENAI_API_KEY not set and ~/.config/openai/api_key does not exist. " +
      "Set the env var or create the key file (chmod 600).",
  );
}

function resolveOutputDir(requested?: string): string {
  const dir = requested
    ? requested.replace(/^~(?=$|\/)/, os.homedir())
    : path.join(os.homedir(), "Downloads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function timestampName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `imagegen-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export type GenerateImageArgs = {
  prompt: string;
  model: string;
  size: string;
  quality: string;
  n: number;
  outputDir?: string;
};

type ImageItem = { b64_json?: string; url?: string };
type ApiResponse = { data?: ImageItem[] };
type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

export async function generateImage(args: GenerateImageArgs) {
  const key = resolveApiKey();
  const outDir = resolveOutputDir(args.outputDir);
  const outName = timestampName();

  const body = {
    model: args.model,
    prompt: args.prompt,
    n: args.n,
    size: args.size,
    quality: args.quality,
  };

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    return {
      content: [
        {
          type: "text" as const,
          text: `OpenAI API error (HTTP ${res.status}):\n${errText}`,
        },
      ],
      isError: true,
    };
  }

  const data = (await res.json()) as ApiResponse;
  const items = data.data ?? [];
  if (items.length === 0) {
    return {
      content: [{ type: "text" as const, text: "No images in response." }],
      isError: true,
    };
  }

  const multi = items.length > 1;
  const content: ContentBlock[] = [];
  const paths: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const suffix = multi ? `-${i + 1}` : "";
    const outPath = path.join(outDir, `${outName}${suffix}.png`);
    let base64: string | undefined;

    if (item.b64_json) {
      base64 = item.b64_json;
    } else if (item.url) {
      const imgRes = await fetch(item.url);
      if (!imgRes.ok) continue;
      base64 = Buffer.from(await imgRes.arrayBuffer()).toString("base64");
    }

    if (!base64) continue;

    fs.writeFileSync(outPath, Buffer.from(base64, "base64"));
    paths.push(outPath);
    content.push({ type: "image", data: base64, mimeType: "image/png" });
  }

  if (paths.length === 0) {
    return {
      content: [{ type: "text" as const, text: "No images could be decoded." }],
      isError: true,
    };
  }

  content.unshift({
    type: "text",
    text:
      `Generated ${paths.length} image(s) with ${args.model} ` +
      `(${args.size}, quality=${args.quality}). Saved to:\n` +
      paths.map((p) => `- ${p}`).join("\n"),
  });

  return { content };
}
