export const VERDICT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "reason", "revision_notes", "escalation_summary", "policy_matched"],
  properties: {
    verdict: { type: "string", enum: ["allow", "revise", "block", "escalate"] },
    reason: { type: "string", minLength: 1, maxLength: 600 },
    revision_notes: { type: ["string", "null"], maxLength: 1200 },
    escalation_summary: { type: ["string", "null"], maxLength: 200 },
    policy_matched: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: 120 },
      maxItems: 12,
    },
  },
} as const;

export interface Verdict {
  verdict: "allow" | "revise" | "block" | "escalate";
  reason: string;
  revision_notes: string | null;
  escalation_summary: string | null;
  policy_matched: string[];
}
