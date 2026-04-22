#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { generateImage } from "./tools/generateImage.js";

const server = new McpServer({
  name: "imagegenmcp",
  version: "0.1.0",
});

server.tool(
  "generate-image",
  "Generate one or more PNG images from a text prompt via OpenAI's Images API (gpt-image-1.5 / gpt-image-2, or DALL·E). Saves each image to disk (defaults to ~/Downloads) and returns them inline in the response so Claude can see them. Use whenever the user asks to generate, create, make, render, or draw an image from a description. Billed to the OpenAI Platform wallet — NOT ChatGPT Plus/Pro. Before n > 1 or quality=high, confirm with the user.",
  {
    prompt: z
      .string()
      .describe(
        "Text description of the image. Be specific: subject, style (photorealistic / watercolour / flat illustration / 3D render), composition (close-up / wide / isometric), lighting, mood, and any text that must appear in the image.",
      ),
    model: z
      .enum([
        "gpt-image-1.5",
        "gpt-image-2",
        "gpt-image-1",
        "gpt-image-1-mini",
        "dall-e-3",
        "dall-e-2",
      ])
      .optional()
      .default("gpt-image-1.5")
      .describe(
        "Model to use. gpt-image-1.5 is the canonical ImageModel enum value for 'GPT Image 2'; gpt-image-2 is an accepted alias.",
      ),
    size: z
      .enum(["1024x1024", "1536x1024", "1024x1536", "auto"])
      .optional()
      .default("1024x1024")
      .describe(
        "Image size for GPT image models. Long side is capped at 1536 by the API.",
      ),
    quality: z
      .enum(["auto", "low", "medium", "high", "standard", "hd"])
      .optional()
      .default("medium")
      .describe(
        "auto / low / medium / high for gpt-image-*; standard / hd for dall-e-3.",
      ),
    n: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .default(1)
      .describe(
        "Number of images to generate (1-10). dall-e-3 only supports n=1.",
      ),
    outputDir: z
      .string()
      .optional()
      .describe(
        "Directory to save PNG files. Defaults to ~/Downloads. Tilde is expanded.",
      ),
  },
  async ({ prompt, model, size, quality, n, outputDir }) => {
    return await generateImage({ prompt, model, size, quality, n, outputDir });
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
