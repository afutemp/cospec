# Large Context Handling

Use this when meeting content is long, there are many files, or loading all content risks context loss.

## Goal

Reduce context length without destroying evidence. Do not summarize away the original words that support product decisions.

## Process

1. Inventory before reading everything:
   - List files, sizes, line counts, titles, dates, and likely meeting boundaries.
   - Prefer shell tools such as `rg`, `wc`, `sed`, and `nl` for local files.
   - If timestamp-heavy transcript lines waste context, run `scripts/remove_timestamps.py <input> -o <cleaned-output>` and analyze the cleaned copy.
2. Normalize source into chunks:
   - Chunk by meeting first, then by topic, time range, or speaker turns.
   - Keep chunks large enough to preserve context, usually 200-500 lines for text transcripts.
   - Add line numbers when possible.
3. Create compact speaker aliases:
   - `C1`, `C2`, `C3` for customer speakers.
   - `Us1`, `Us2` for our side.
   - Keep a short alias table instead of repeating full names and titles.
4. Remove low-value noise only after checking:
   - Remove greetings, repeated meeting-room logistics, filler, transcription artifacts, and unrelated small talk.
   - Keep any logistics that affects product validation, such as deployment constraints, support ownership, procurement, environment access, data security, or rollout risk.
5. Extract per chunk:
   - `topics`
   - `approved`
   - `challenged`
   - `needs/pain points`
   - `candidate product validation inputs`
   - `evidence handles` with internal file + line range + exact quote
6. Merge after extraction:
   - Cluster equivalent needs.
   - Resolve contradictions by source, role, and meeting context.
   - Keep representative quotes from the strongest evidence.

## Evidence Handle Format

Use compact evidence handles during intermediate work:

```text
E01: file=会议纪要.txt lines=120-136 speaker=C1 quote="..."
```

In final output, expand only the customer quote text needed to support major conclusions. Do not expose file paths, line ranges, or Markdown source links in the delivered report.

## Context Protection Rules

- Never rely on one global summary of a long transcript as the only input.
- Do not discard exact quotes before final synthesis.
- Do not combine multiple customer quotes into one fabricated quote.
- Do not infer a distribution ratio from chunk count; calculate from meeting/customer coverage.
- If content is too large to finish in one pass, write the partial Markdown report with completed coverage and remaining unprocessed sources explicitly marked.
