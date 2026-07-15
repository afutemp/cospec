#!/usr/bin/env python3
"""Remove transcript timestamps while preserving speaker labels and original wording."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


TIME = r"(?:\d{1,2}:)?\d{1,2}:\d{2}(?::\d{2})?"

PATTERNS = [
    # [00:01:10] C1 Name:
    (re.compile(rf"^\s*\[\s*{TIME}\s*\]\s*"), ""),
    # (00:01:10) C1 Name:
    (re.compile(rf"^\s*\(\s*{TIME}\s*\)\s*"), ""),
    # Speaker 00:01:10
    (re.compile(rf"(?P<label>\S.*?\S)\s+{TIME}\s*$"), r"\g<label>"),
    # Speaker [00:01:10]
    (re.compile(rf"(?P<label>\S.*?\S)\s+\[\s*{TIME}\s*\]\s*$"), r"\g<label>"),
    # Speaker (00:01:10)
    (re.compile(rf"(?P<label>\S.*?\S)\s+\(\s*{TIME}\s*\)\s*$"), r"\g<label>"),
]


def strip_line(line: str) -> str:
    current = line.rstrip("\n")
    for pattern, replacement in PATTERNS:
        current = pattern.sub(replacement, current)
    return current.rstrip()


def default_output(input_path: Path) -> Path:
    suffix = input_path.suffix or ".txt"
    return input_path.with_name(f"{input_path.stem}_去时间戳{suffix}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Remove timestamps from meeting transcript speaker lines.")
    parser.add_argument("input", type=Path, help="Input transcript file.")
    parser.add_argument("-o", "--output", type=Path, help="Output path. Defaults to <name>_去时间戳.<ext>.")
    parser.add_argument("--force", action="store_true", help="Overwrite output if it exists.")
    args = parser.parse_args()

    input_path = args.input
    output_path = args.output or default_output(input_path)

    if not input_path.exists():
        parser.error(f"input file does not exist: {input_path}")
    if output_path.exists() and not args.force:
        parser.error(f"output exists, use --force or choose another path: {output_path}")

    text = input_path.read_text(encoding="utf-8")
    cleaned = "\n".join(strip_line(line) for line in text.splitlines())
    if text.endswith("\n"):
        cleaned += "\n"
    output_path.write_text(cleaned, encoding="utf-8")
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
