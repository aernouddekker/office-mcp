#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SERVER_ENTRY = join(ROOT, "dist", "index.js");
const POLICY_PATH = join(__dirname, "policy.md");
const FIXTURES_DIR = join(__dirname, "fixtures");

function sendRpc(child, msg) {
  child.stdin.write(JSON.stringify(msg) + "\n");
}

function readJsonLines(buffer) {
  const lines = buffer.split("\n").filter((l) => l.trim());
  return lines.map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

async function runOne(fixture) {
  const policyPath = fixture.policy_path
    ? resolve(__dirname, fixture.policy_path)
    : POLICY_PATH;
  const env = {
    ...process.env,
    JUDGE_POLICY_PATH: policyPath,
    JUDGE_REASONING_EFFORT: process.env.JUDGE_REASONING_EFFORT ?? "low",
    JUDGE_TIMEOUT_MS: process.env.JUDGE_TIMEOUT_MS ?? "120000",
  };
  const child = spawn("node", [SERVER_ENTRY], { stdio: ["pipe", "pipe", "inherit"], env });
  let stdout = "";
  child.stdout.on("data", (d) => { stdout += d.toString(); });

  sendRpc(child, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "fixture-runner", version: "0.0.1" } } });
  sendRpc(child, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });
  sendRpc(child, {
    jsonrpc: "2.0", id: 2, method: "tools/call",
    params: { name: "judge_action", arguments: fixture.input },
  });

  return await new Promise((resolveP) => {
    const timer = setTimeout(() => { child.kill(); resolveP({ ok: false, error: "rpc timeout" }); }, 180000);
    const onData = () => {
      const msgs = readJsonLines(stdout);
      const reply = msgs.find((m) => m.id === 2);
      if (!reply) return;
      clearTimeout(timer);
      child.kill();
      if (reply.error) return resolveP({ ok: false, error: JSON.stringify(reply.error) });
      try {
        const text = reply.result.content[0].text;
        const verdict = JSON.parse(text);
        resolveP({ ok: true, verdict });
      } catch (e) {
        resolveP({ ok: false, error: `parse: ${e.message}` });
      }
    };
    child.stdout.on("data", onData);
  });
}

const INTERNAL_LABEL_RE = /^(default(:[^\s]+)?|fail-closed:[^\s]+|validator:[^\s]+)$/i;

function normalizeForCompare(s) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchExpected(verdict, expected, policyText) {
  const allowedVerdicts = expected.verdict_in ?? [expected.verdict];
  if (!allowedVerdicts.includes(verdict.verdict)) {
    return `verdict ${verdict.verdict} not in expected ${JSON.stringify(allowedVerdicts)}`;
  }
  if (expected.policy_includes_any_of) {
    const matched = verdict.policy_matched ?? [];
    const hit = expected.policy_includes_any_of.some((rule) =>
      matched.some((m) => m.toUpperCase().includes(rule.toUpperCase())),
    );
    if (!hit) {
      return `policy_matched ${JSON.stringify(matched)} does not include any of ${JSON.stringify(expected.policy_includes_any_of)}`;
    }
  }
  if (expected.policy_matched_grounded === true) {
    const policyNorm = normalizeForCompare(policyText);
    const ungrounded = (verdict.policy_matched ?? []).filter(
      (m) => !INTERNAL_LABEL_RE.test(m) && !policyNorm.includes(normalizeForCompare(m)),
    );
    if (ungrounded.length > 0) {
      return `policy_matched contains ungrounded labels (not in policy file): ${JSON.stringify(ungrounded)}`;
    }
  }
  if (expected.reason_must_not_contain) {
    for (const forbidden of expected.reason_must_not_contain) {
      if ((verdict.reason ?? "").toLowerCase().includes(forbidden.toLowerCase())) {
        return `reason contains forbidden token "${forbidden}": ${JSON.stringify(verdict.reason)}`;
      }
    }
  }
  return null;
}

const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json")).sort();
let passed = 0, failed = 0;
for (const f of files) {
  const fixture = JSON.parse(readFileSync(join(FIXTURES_DIR, f), "utf8"));
  process.stdout.write(`▶ ${fixture.name}... `);
  const started = Date.now();
  const result = await runOne(fixture);
  const dt = Date.now() - started;
  if (!result.ok) {
    console.log(`FAIL (${dt}ms): ${result.error}`);
    failed++;
    continue;
  }
  const policyForAssertion = readFileSync(
    fixture.policy_path ? resolve(__dirname, fixture.policy_path) : POLICY_PATH,
    "utf8",
  );
  const mismatch = matchExpected(result.verdict, fixture.expected, policyForAssertion);
  if (mismatch) {
    console.log(`FAIL (${dt}ms): ${mismatch}  →  ${JSON.stringify(result.verdict)}`);
    failed++;
  } else {
    console.log(`OK  (${dt}ms)  verdict=${result.verdict.verdict}  policy=${JSON.stringify(result.verdict.policy_matched)}`);
    passed++;
  }
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
