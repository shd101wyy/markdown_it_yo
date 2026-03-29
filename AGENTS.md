---
mode: agent
---

You are porting the markdown-it JavaScript library to the Yo programming language. The goal is **100% behavioral parity** with markdown-it v14.1.1 — same input produces same HTML output.

Detailed instructions for specific areas are in `.github/instructions/`. Always read and follow the relevant file before working in that area.

| Area                         | Instruction file                                          |
| ---------------------------- | --------------------------------------------------------- |
| JS → Yo translation patterns | `.github/instructions/translation.instructions.md`        |
| Yo coding conventions        | `.github/instructions/yo-conventions.instructions.md`     |
| Testing                      | `.github/instructions/testing.instructions.md`            |
| Dependency modules           | `.github/instructions/dependencies.instructions.md`       |

---

## Architecture

markdown-it uses a **three-stage parsing pipeline** with a pluggable Ruler system:

```
Input string
    │
    ▼
┌─────────────┐
│ Parser Core  │  Rules: normalize → block → inline → linkify → replacements → smartquotes → text_join
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Parser Block │  11 rules: table, code, fence, blockquote, hr, list, reference, html_block, heading, lheading, paragraph
└──────┬──────┘
       │
       ▼
┌──────────────┐
│ Parser Inline│  13 rules + Ruler2 post-processing
└──────┬───────┘
       │
       ▼
┌──────────┐
│ Renderer │  Token stream → HTML string
└──────────┘
```

### Key directories

| Path                    | Role                                              | JS Source                      |
| ----------------------- | ------------------------------------------------- | ------------------------------ |
| `src/token.yo`          | Token struct (parsed markdown element)             | `lib/token.mjs`                |
| `src/ruler.yo`          | Rule chain manager (enable/disable/ordering)       | `lib/ruler.mjs`                |
| `src/renderer.yo`       | Token stream → HTML conversion                     | `lib/renderer.mjs`             |
| `src/markdown_it.yo`    | Main MarkdownIt entry point                        | `lib/index.mjs`                |
| `src/parser_core.yo`    | Core pipeline orchestrator                         | `lib/parser_core.mjs`          |
| `src/parser_block.yo`   | Block-level tokenizer                              | `lib/parser_block.mjs`         |
| `src/parser_inline.yo`  | Inline-level tokenizer                             | `lib/parser_inline.mjs`        |
| `src/common/`           | Shared utilities, HTML patterns                    | `lib/common/`                  |
| `src/helpers/`          | Link parsing helpers                               | `lib/helpers/`                 |
| `src/rules_core/`       | 7 core rules + StateCore                           | `lib/rules_core/`              |
| `src/rules_block/`      | 11 block rules + StateBlock                        | `lib/rules_block/`             |
| `src/rules_inline/`     | 13 inline rules + StateInline + post-processing    | `lib/rules_inline/`            |
| `src/presets/`           | Configuration presets (default, commonmark, zero)   | `lib/presets/`                 |
| `src/entities/`          | HTML entity decode (replaces `entities` npm)        | *custom implementation*        |
| `src/mdurl/`             | URL encode/decode/parse (replaces `mdurl` npm)      | *custom implementation*        |
| `src/punycode/`          | Punycode IDN encoding (replaces `punycode.js` npm)  | *custom implementation*        |
| `src/linkify/`           | URL auto-detection (replaces `linkify-it` npm)       | *custom implementation*        |
| `src/unicode/`           | Unicode char categories (replaces `uc.micro` npm)    | *custom implementation*        |
| `tests/`                 | All test files                                      | `test/`                        |
| `tests/fixtures/`        | Test fixture data files                              | `test/fixtures/`               |
| `benchmark/`             | Performance benchmarks                               | `benchmark/`                   |

---

## Translation Philosophy

**Core parser files** (`token`, `ruler`, `renderer`, all `rules_*`, `parser_*`, `markdown_it`) are **near 1:1 translations** of the original JavaScript. This means:

- Preserve the same function names, variable names, and control flow
- Preserve the same algorithm structure and order of operations
- Only change what the language requires (types, syntax, memory management)
- Add comments referencing the JS source line when the translation is non-obvious

**Dependency modules** (`entities`, `mdurl`, `punycode`, `linkify`, `unicode`) are **clean Yo implementations** — they don't need to mirror the JS source structure but must produce identical results.

---

## Build & Test Commands

```bash
# Build (from the Yo compiler directory)
cd /path/to/Yo
bun run build

# Run a specific test file
./yo-cli test /path/to/markdown_it_yo/tests/token.test.yo --bail -v

# Compile and run the CLI
./yo-cli compile /path/to/markdown_it_yo/src/main.yo --release -o markdown-it-yo && ./markdown-it-yo

# Emit C only (for debugging)
./yo-cli compile /path/to/markdown_it_yo/src/main.yo --emit-c --skip-c-compiler --release

# Run with AddressSanitizer
./yo-cli compile /path/to/markdown_it_yo/src/main.yo --release --sanitize address --allocator libc -o test && ./test
```

---

## Reference

- **Original JS repo:** https://github.com/markdown-it/markdown-it (v14.1.1)
- **CommonMark spec:** https://spec.commonmark.org/0.31.2/
- **Yo compiler:** `../Yo/` (sibling directory)
- **Porting plan:** `PLAN.md`
