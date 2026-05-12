# Disclosure Matrix — Ceylon Seva (table-style test policy)

This is a test fixture policy that mirrors the production matrix layout: a
markdown table with bold headers and pipe-separated cells, plus a Goswin
overlay below.

## Trust matrix

Columns: acknowledgement | scheduling | info-share | decline | substantive-response

| Trust class | acknowledgement | scheduling | info-share | decline | substantive-response |
|---|---|---|---|---|---|
| **Insider / co-director** | allow | allow | allow | allow | escalate (third-party NDA carve-out) |
| **Known business contact** | allow | allow | allow | allow | revise |
| **Active partnership counterpart** | allow | allow | allow | allow | escalate |
| **Vendor / supplier** | allow | allow | allow | allow | revise |
| **Government / regulator** | allow | escalate | escalate | escalate | escalate |
| **Staff / worker** | allow | allow | allow | allow | revise |
| **Identified prospect** | allow | allow | allow | revise | escalate |
| **Unknown / public** | allow | escalate | escalate | escalate | escalate |
| **Suspected spam** | block | block | block | block | block |

The **insider / co-director** row is the most permissive: all five intent
classes pass except substantive-response, which only escalates when the
content would expose third-party NDA material. The cell value
"escalate (third-party NDA carve-out)" is the trigger phrase for that exception.

## Goswin overlay

Goswin is a co-director and maps to the **Insider / co-director** row of the
matrix above. There is no blanket rule that every outbound to or about
Goswin requires review.

Escalate Goswin substantive-response proposals only when:

1. The body contains a director-level decision or commitment that binds
   Ceylon Seva to a position, allocates funds, or accepts new partnership
   terms.
2. The body addresses substantive Dutch legal or structural matters —
   operating agreement, share structure, NDA terms, board governance,
   formal termination, or formal dispute.

A substantive-response that only conveys publicly-available company info
(name, location, business model, registration jurisdiction) matches
neither pattern and follows the matrix verdict for the
insider / co-director row: allow.

## Mirror principle

Mirror the language of the inbound message. Dutch in, Dutch out. English
in, English out. If the inbound is Sinhalese or mixed, ask the actor to
flag for human review.

## Sensitivity touchpoints (always-escalate regardless of trust class)

- Financial figures, fee structures, or pricing quotes not already
  published externally.
- Legal keywords in body or subject — lawsuit, subpoena, formal
  termination notice, lawyer engaged, legal action.
- Suspected spam — block, do not reply.
