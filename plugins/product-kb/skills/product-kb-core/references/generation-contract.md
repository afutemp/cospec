# Generation Contract

All generation tasks read one `.source/source-snapshot.json`. They never call IPD.

Order:

1. Batch 1 (parallel): strategy/value, roles, problems/JTBD, milestones.
2. Batch 2 (parallel after Batch 1): journey, backlog/priority, release scope/roadmap.
3. Batch 3: one parallel task per Feature using Feature + descendants + related comments + parsed attachment content + lifecycle. Attachment evidence cites both Issue and Attachment IDs; non-parsed attachments are never treated as content evidence.
4. Batch 4 (parallel): quality/compliance, dependencies/risks, metrics/experiments, asset index.
5. Final README from actual generated files and source scope.

Every managed document includes full template frontmatter and a `product-kb-managed` marker. Unsupported facts use `[OPEN] IPD 未提供`. On validation failure, regenerate only named failed documents, at most two rounds.
