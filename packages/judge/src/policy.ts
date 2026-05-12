import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";

interface PolicyCacheEntry {
  paths: string[];
  mtimeMsList: number[];
  contents: string;
}

let cache: PolicyCacheEntry | null = null;

function cacheKey(paths: string[]): string {
  return paths.join("\x00");
}

function readAndConcat(paths: string[]): { contents: string; mtimeMsList: number[] } {
  const sections: string[] = [];
  const mtimes: number[] = [];
  for (const p of paths) {
    const stat = statSync(p);
    mtimes.push(stat.mtimeMs);
    const body = readFileSync(p, "utf8");
    const header = paths.length === 1 ? "" : `=== FILE: ${basename(p)} ===\n`;
    sections.push(`${header}${body}`.trimEnd());
  }
  return { contents: sections.join("\n\n"), mtimeMsList: mtimes };
}

export function loadPolicies(paths: string[]): string {
  if (paths.length === 0) {
    throw new Error("loadPolicies called with empty paths array");
  }
  if (
    cache &&
    cacheKey(cache.paths) === cacheKey(paths) &&
    cache.mtimeMsList.length === paths.length
  ) {
    // Check if any file's mtime has changed
    const currentMtimes = paths.map((p) => statSync(p).mtimeMs);
    const unchanged = currentMtimes.every((m, i) => m === cache!.mtimeMsList[i]);
    if (unchanged) return cache.contents;
  }
  const { contents, mtimeMsList } = readAndConcat(paths);
  cache = { paths, mtimeMsList, contents };
  return contents;
}

// Legacy single-path convenience for backward compat with existing callers.
export function loadPolicy(path: string): string {
  return loadPolicies([path]);
}

export function resetPolicyCacheForTests(): void {
  cache = null;
}
