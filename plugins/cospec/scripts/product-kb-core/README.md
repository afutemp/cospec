# product-kb-core

Shared deterministic implementation for the product-planning knowledge-base lifecycle Skills. This directory is not a user-triggerable Skill.

Core owns source collection, attachment download/parsing, normalized snapshots, canonical fingerprints, managed-file safety, update diffs, validation, evaluation report merging, and local query. User-facing orchestration lives in sibling `product-kb-*` Skills.

Runtime: Node.js 18+ CommonJS. Text/HTML parsing uses Node built-ins; PDF/DOCX/XLSX/PPTX extraction uses `scripts/parse_attachment.py` with Python `pypdf`, `python-docx`, `openpyxl`, and `python-pptx`.
