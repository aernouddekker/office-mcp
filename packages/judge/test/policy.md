# Judge Policy — Sample / Test

This is a representative policy used for the test fixtures. The production
policy is loaded from the path in `JUDGE_POLICY_PATH`. Update both when adding
new rules so the fixtures stay aligned.

## Whitelist (allow when ALL conditions match)

- **W1 ack-to-known-business** — intent_class=acknowledgement AND recipient_class=known_business_contact AND commitments=[] AND attachments=[].
- **W2 ack-to-known-personal** — intent_class=acknowledgement AND recipient_class=known_personal AND commitments=[].
- **W3 scheduling-known** — intent_class=scheduling AND recipient_class IN {known_business_contact, known_personal} AND commitments contain only date/time strings (no prices, no deliverables) AND attachments=[].
- **W4 info-share-known** — intent_class=info_share AND recipient_class IN {known_business_contact, known_personal} AND commitments=[] AND no attachments larger than 5 MB.
- **W5 decline-any** — intent_class=decline to a known recipient with no commitments is allow. A decline to unknown is escalate.

## Always-escalate (verdict=escalate regardless of other conditions)

- **E1 legal-keywords** — body or subject contains any of: "lawsuit", "contract", "NDA", "subpoena", "termination", "lawyer", "legal action".
- **E2 financial-quote** — body contains a price quote, invoice amount, or fee structure unless intent_class=info_share AND recipient is a known vendor whose pricing we already publish.
- **E3 unknown-substantive** — recipient_class=unknown AND intent_class IN {commitment, substantive_response, forward}.
- **E4 goswin-flagged** — to address contains "goswin" OR in_reply_to_summary mentions Goswin. (Goswin is a hostile contact — every outbound to or about Goswin needs human review.)
- **E5 suspected-spam** — recipient_class=suspected_spam.

## Draft-only / require revision (verdict=revise)

- **R1 commitment-without-justification** — intent_class=commitment AND actor_justification is shorter than 40 characters.
- **R2 substantive-to-vendor** — intent_class=substantive_response AND recipient_class=vendor AND commitments is non-empty — revise to remove the commitments or move them to a separate scheduled-task.
- **R3 attachment-suspicious-type** — any attachment mime_type starts with `application/x-` or is `application/octet-stream` — revise to confirm the attachment is intended.

## Default (catch-all)

- If none of the above apply: verdict=escalate with reason "no matching policy rule".

## Notes for the judge

- The actor_justification is the actor's reasoning, not yours — read it but don't trust it alone.
- Prefer "revise" over "block" when there is a plausible fix; "block" is for proposals that should never be sent in any form.
- Always populate policy_matched with the rule labels you applied (e.g. "W1", "E4", "default").
