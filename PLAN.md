# markdown-it → Yo Porting Plan

## Goal

Port [markdown-it](https://github.com/markdown-it/markdown-it) (v14.1.1) — a modern, pluggable CommonMark-compliant markdown parser — from JavaScript to Yo.

**Success criteria:**

1. **100% behavioral parity** with markdown-it's JS implementation (same input → same HTML output)
2. **Full test suite** ported from markdown-it's Mocha/fixture-based tests to Yo test files
3. **Benchmark harness** comparing markdown-it-yo (native + WASM) against markdown-it (Node.js)
4. **Compilation targets:** native (macOS/Linux) and WASM (Emscripten / WASI)

---

## Architecture: markdown-it Overview

markdown-it uses a **three-stage pipeline** with a pluggable **Ruler** system:

```
Input string
    │
    ▼
┌─────────────┐
│ Parser Core  │  7 rules: normalize → block → inline → linkify → replacements → smartquotes → text_join
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Parser Block │  11 rules: table, code, fence, blockquote, hr, list, reference, html_block, heading, lheading, paragraph
└──────┬──────┘
       │
       ▼
┌──────────────┐
│ Parser Inline│  13 rules + Ruler2 (post-processing): text, linkify, newline, escape, backticks, strikethrough,
│              │  emphasis, link, image, autolink, html_inline, entity + balance_pairs, fragments_join
└──────┬───────┘
       │
       ▼
┌──────────┐
│ Renderer │  Token stream → HTML string
└──────────┘
```

### Source Files (lib/)

| File | Role | Approx Lines |
|------|------|-------------|
| `index.mjs` | Main `MarkdownIt` class — `parse()`, `render()`, `use()`, presets | ~450 |
| `token.mjs` | Token data structure | ~100 |
| `ruler.mjs` | Rule chain manager (enable/disable, before/after/push) | ~220 |
| `renderer.mjs` | Token → HTML conversion | ~230 |
| `parser_core.mjs` | Core pipeline orchestrator | ~40 |
| `parser_block.mjs` | Block-level tokenizer | ~110 |
| `parser_inline.mjs` | Inline-level tokenizer (ruler + ruler2) | ~150 |
| `common/utils.mjs` | HTML escape, entity decode, Unicode helpers | ~200 |
| `common/html_blocks.mjs` | HTML block tag names | ~20 |
| `common/html_re.mjs` | HTML regex patterns | ~30 |
| `helpers/parse_link_*.mjs` | Link destination, label, title parsers | ~3×50 |
| `rules_core/*.mjs` | 7 core rules | ~350 total |
| `rules_block/*.mjs` | 11 block rules + `state_block.mjs` | ~900 total |
| `rules_inline/*.mjs` | 13 inline rules + `state_inline.mjs` | ~750 total |
| `presets/*.mjs` | 3 presets (default, commonmark, zero) | ~150 total |
| **Total** | | **~3,800 lines** |

### JS Dependencies to Reimplement

| JS Package | Purpose | Yo Strategy |
|------------|---------|-------------|
| `entities` | HTML entity encoding/decoding (2,231 named entities) | Build `src/entities/` module with lookup table |
| `mdurl` | URL parsing/encoding (percent-encode, decode, parse) | Build `src/mdurl/` module |
| `linkify-it` | Auto-link URL detection | Build `src/linkify/` module |
| `punycode.js` | IDN domain Punycode encoding | Build `src/punycode/` module |
| `uc.micro` | Unicode character categories (regex-based) | Use Yo's `rune` + Unicode support in `std/regex` |

---

## Yo Std Library Gap Analysis

### ✅ Available and Sufficient

| Capability | Yo Module | Notes |
|-----------|-----------|-------|
| String manipulation | `std/string` | split, replace, substring, indexOf, trim, etc. |
| Dynamic arrays | `std/collections/array_list` | ArrayList(T) — push, pop, get, set, slice, sort |
| Hash maps | `std/collections/hash_map` | HashMap(K, V) — insert, get, remove, iterate |
| Hash sets | `std/collections/hash_set` | HashSet(T) |
| Regex engine | `std/regex` | Full NFA-based engine with captures, flags, Unicode |
| Unicode | `std/data/rune` | is_whitespace, is_digit, is_alphabetic, etc. |
| Formatting | `std/fmt` | println, print, ToString trait |
| File I/O | `std/fs` | File read for CLI and benchmarks |
| Testing | `std/testing` | assert, bench with timing stats |
| JSON | `std/encoding/json` | For potential config/fixture loading |

### ⚠️ Needs Custom Implementation (within this project)

| Need | JS Source | Approach |
|------|-----------|----------|
| HTML entity map | `entities` npm package | `src/entities/` — HashMap of 2,231 named HTML entities → codepoints |
| HTML escaping | `utils.mjs: escapeHtml()` | `src/common/utils.yo` — `&`, `<`, `>`, `"` escaping |
| URL encoding | `mdurl` npm package | `src/mdurl/` — percent-encode/decode, URL parse |
| Punycode | `punycode.js` npm package | `src/punycode/` — IDN encoding (RFC 3492) |
| Linkify engine | `linkify-it` npm package | `src/linkify/` — URL auto-detection state machine |
| Unicode categories | `uc.micro` npm package | `src/unicode/` — Unicode Pc/Pd/Pe/Pf/Pi/Po/Ps character ranges |

---

## Project Structure

```
markdown_it_yo/
├── build.yo                         # Build configuration
├── PLAN.md                          # This file
├── src/
│   ├── lib.yo                       # Public library API (re-exports)
│   ├── main.yo                      # CLI: stdin/file → HTML
│   ├── markdown_it.yo               # MarkdownIt class (main entry)
│   ├── token.yo                     # Token struct
│   ├── ruler.yo                     # Ruler(T) generic rule manager
│   ├── renderer.yo                  # Token[] → HTML renderer
│   ├── parser_core.yo               # Core pipeline
│   ├── parser_block.yo              # Block-level parser
│   ├── parser_inline.yo             # Inline-level parser
│   ├── common/
│   │   ├── utils.yo                 # escapeHtml, unescapeMd, normalizeLink, etc.
│   │   ├── html_blocks.yo           # Block-level HTML tag names
│   │   └── html_re.yo              # HTML regex patterns
│   ├── helpers/
│   │   ├── parse_link_destination.yo
│   │   ├── parse_link_label.yo
│   │   └── parse_link_title.yo
│   ├── rules_core/
│   │   ├── state_core.yo
│   │   ├── normalize.yo
│   │   ├── block.yo
│   │   ├── inline.yo
│   │   ├── linkify.yo
│   │   ├── replacements.yo
│   │   ├── smartquotes.yo
│   │   └── text_join.yo
│   ├── rules_block/
│   │   ├── state_block.yo
│   │   ├── table.yo
│   │   ├── code.yo
│   │   ├── fence.yo
│   │   ├── blockquote.yo
│   │   ├── hr.yo
│   │   ├── list.yo
│   │   ├── reference.yo
│   │   ├── html_block.yo
│   │   ├── heading.yo
│   │   ├── lheading.yo
│   │   └── paragraph.yo
│   ├── rules_inline/
│   │   ├── state_inline.yo
│   │   ├── text.yo
│   │   ├── linkify.yo
│   │   ├── newline.yo
│   │   ├── escape.yo
│   │   ├── backticks.yo
│   │   ├── strikethrough.yo
│   │   ├── emphasis.yo
│   │   ├── link.yo
│   │   ├── image.yo
│   │   ├── autolink.yo
│   │   ├── html_inline.yo
│   │   ├── entity.yo
│   │   ├── balance_pairs.yo
│   │   └── fragments_join.yo
│   ├── presets/
│   │   ├── default.yo
│   │   ├── commonmark.yo
│   │   └── zero.yo
│   ├── entities/                    # Replaces `entities` npm package
│   │   ├── entities.yo              # HashMap: entity name → codepoint(s)
│   │   └── decode.yo                # decodeHTML, decodeHTMLStrict
│   ├── mdurl/                       # Replaces `mdurl` npm package
│   │   ├── encode.yo                # percentEncode, percentDecode
│   │   ├── decode.yo                # URL decode
│   │   ├── parse.yo                 # URL parsing
│   │   └── format.yo                # URL formatting
│   ├── punycode/                    # Replaces `punycode.js`
│   │   └── punycode.yo              # Punycode encode/decode (RFC 3492)
│   ├── linkify/                     # Replaces `linkify-it`
│   │   └── linkify.yo               # URL auto-detection engine
│   └── unicode/                     # Replaces `uc.micro`
│       └── categories.yo            # Unicode Pc, Pd, Pe, Pf, Pi, Po, Ps ranges
├── tests/
│   ├── token.test.yo                # Token tests
│   ├── ruler.test.yo                # Ruler tests
│   ├── utils.test.yo                # Utility function tests
│   ├── renderer.test.yo             # Renderer tests
│   ├── markdown_it.test.yo          # Main integration tests
│   ├── commonmark.test.yo           # CommonMark spec compliance
│   ├── entities.test.yo             # Entity encode/decode tests
│   ├── mdurl.test.yo                # URL encode/decode/parse tests
│   ├── linkify.test.yo              # Linkify tests
│   ├── pathological.test.yo         # ReDoS / pathological input tests
│   └── fixtures/                    # Ported from markdown-it test/fixtures/
│       ├── commonmark/
│       │   ├── good.txt             # CommonMark spec passing cases (~85KB)
│       │   └── spec.txt             # Full CommonMark spec (~205KB)
│       └── markdown_it/
│           ├── commonmark_extras.txt
│           ├── fatal.txt
│           ├── linkify.txt
│           ├── normalize.txt
│           ├── proto.txt
│           ├── smartquotes.txt
│           ├── strikethrough.txt
│           ├── tables.txt
│           ├── typographer.txt
│           └── xss.txt
├── benchmark/
│   ├── bench.yo                     # Yo benchmark runner
│   ├── bench_runner.js              # Node.js runner for markdown-it comparison
│   └── samples/                     # Ported from markdown-it benchmark/samples/
│       ├── block-bq-flat.md
│       ├── block-bq-nested.md
│       ├── block-code.md
│       ├── block-fences.md
│       ├── block-heading.md
│       ├── block-hr.md
│       ├── block-html.md
│       ├── block-lheading.md
│       ├── block-list-flat.md
│       ├── block-list-nested.md
│       ├── block-ref-flat.md
│       ├── block-ref-list.md
│       ├── block-ref-nested.md
│       ├── block-tables.md
│       ├── inline-autolink.md
│       ├── inline-backticks.md
│       ├── inline-em-flat.md
│       ├── inline-em-nested.md
│       ├── inline-em-worst.md
│       ├── inline-entity.md
│       ├── inline-escape.md
│       ├── inline-html.md
│       ├── inline-links-flat.md
│       ├── inline-links-nested.md
│       ├── inline-newlines.md
│       ├── lorem1.txt
│       └── rawtabs.md
└── README.md
```

---

## Implementation Phases

### Phase 0: Foundation & Infrastructure

Set up the project skeleton, build configuration, and implement the foundational types that everything else depends on.

| # | Task | JS Source | Depends On |
|---|------|-----------|------------|
| 0.1 | Update `build.yo` for library + CLI + tests + benchmark | — | — |
| 0.2 | Implement `Token` struct | `token.mjs` | — |
| 0.3 | Implement `Ruler(T)` generic | `ruler.mjs` | — |
| 0.4 | Implement `common/utils.yo` (escapeHtml, isSpace, etc.) | `common/utils.mjs` | — |
| 0.5 | Implement `common/html_blocks.yo` | `common/html_blocks.mjs` | — |
| 0.6 | Implement `common/html_re.yo` | `common/html_re.mjs` | — |
| 0.7 | Port `Token` and `Ruler` tests | `test/token.mjs`, `test/ruler.mjs` | 0.2, 0.3 |
| 0.8 | Port `utils` tests | `test/utils.mjs` | 0.4 |

### Phase 1: Dependencies (Replacing npm Packages)

Build Yo equivalents of the 5 npm packages that markdown-it depends on. These are self-contained and can be tested independently.

| # | Task | JS Source | Approx Size | Depends On |
|---|------|-----------|-------------|------------|
| 1.1 | `entities/` — HTML entity lookup table (2,231 entries) | `entities` npm | ~600 lines (data) | — |
| 1.2 | `entities/decode.yo` — `decodeHTML()`, `decodeHTMLStrict()` | `entities` npm | ~150 lines | 1.1 |
| 1.3 | `mdurl/encode.yo` — percent-encoding | `mdurl` npm | ~100 lines | — |
| 1.4 | `mdurl/decode.yo` — percent-decoding | `mdurl` npm | ~100 lines | — |
| 1.5 | `mdurl/parse.yo` — URL parsing | `mdurl` npm | ~200 lines | — |
| 1.6 | `mdurl/format.yo` — URL formatting | `mdurl` npm | ~50 lines | 1.5 |
| 1.7 | `unicode/categories.yo` — Unicode Punctuation/Space ranges | `uc.micro` npm | ~200 lines | — |
| 1.8 | `punycode/punycode.yo` — IDN encoding (RFC 3492) | `punycode.js` npm | ~200 lines | — |
| 1.9 | `linkify/linkify.yo` — URL auto-detection | `linkify-it` npm | ~500 lines | 1.3, 1.5, 1.8 |
| 1.10 | Tests for all Phase 1 modules | `test/utils.mjs` (partial) | ~400 lines | 1.1–1.9 |

### Phase 2: Link Helpers & State Objects

Small, focused modules used by both block and inline parsers.

| # | Task | JS Source | Depends On |
|---|------|-----------|------------|
| 2.1 | `helpers/parse_link_label.yo` | `helpers/parse_link_label.mjs` | 0.2 |
| 2.2 | `helpers/parse_link_destination.yo` | `helpers/parse_link_destination.mjs` | 1.3 |
| 2.3 | `helpers/parse_link_title.yo` | `helpers/parse_link_title.mjs` | — |
| 2.4 | `rules_core/state_core.yo` (StateCore struct) | `rules_core/state_core.mjs` | 0.2 |
| 2.5 | `rules_block/state_block.yo` (StateBlock struct) | `rules_block/state_block.mjs` | 0.2 |
| 2.6 | `rules_inline/state_inline.yo` (StateInline struct) | `rules_inline/state_inline.mjs` | 0.2 |

### Phase 3: Block Parser Rules

Implement each block-level rule. These are largely independent of each other and can be ported in parallel.

| # | Task | JS Source | Approx Lines | Depends On |
|---|------|-----------|-------------|------------|
| 3.1 | `rules_block/code.yo` (indented code) | `code.mjs` | ~25 | 2.5 |
| 3.2 | `rules_block/fence.yo` (fenced code) | `fence.mjs` | ~80 | 2.5 |
| 3.3 | `rules_block/hr.yo` (horizontal rule) | `hr.mjs` | ~40 | 2.5 |
| 3.4 | `rules_block/heading.yo` (ATX headings) | `heading.mjs` | ~50 | 2.5 |
| 3.5 | `rules_block/lheading.yo` (setext headings) | `lheading.mjs` | ~70 | 2.5 |
| 3.6 | `rules_block/paragraph.yo` (paragraph) | `paragraph.mjs` | ~50 | 2.5 |
| 3.7 | `rules_block/html_block.yo` (raw HTML) | `html_block.mjs` | ~70 | 2.5, 0.5, 0.6 |
| 3.8 | `rules_block/reference.yo` (link references) | `reference.mjs` | ~170 | 2.5, 2.1–2.3 |
| 3.9 | `rules_block/blockquote.yo` (block quotes) | `blockquote.mjs` | ~200 | 2.5 |
| 3.10 | `rules_block/list.yo` (lists) | `list.mjs` | ~300 | 2.5 |
| 3.11 | `rules_block/table.yo` (GFM tables) | `table.mjs` | ~200 | 2.5 |
| 3.12 | `parser_block.yo` — block parser orchestrator | `parser_block.mjs` | ~110 | 0.3, 2.5, 3.1–3.11 |

### Phase 4: Inline Parser Rules

Implement each inline rule. Some depend on Phase 2 helpers.

| # | Task | JS Source | Approx Lines | Depends On |
|---|------|-----------|-------------|------------|
| 4.1 | `rules_inline/text.yo` (plain text) | `text.mjs` | ~60 | 2.6 |
| 4.2 | `rules_inline/newline.yo` (line breaks) | `newline.mjs` | ~35 | 2.6 |
| 4.3 | `rules_inline/escape.yo` (backslash escape) | `escape.mjs` | ~40 | 2.6 |
| 4.4 | `rules_inline/backticks.yo` (code spans) | `backticks.mjs` | ~55 | 2.6 |
| 4.5 | `rules_inline/emphasis.yo` (\*italic\*/\*\*bold\*\*) | `emphasis.mjs` | ~100 | 2.6, 1.7 |
| 4.6 | `rules_inline/strikethrough.yo` (~~strike~~) | `strikethrough.mjs` | ~90 | 2.6 |
| 4.7 | `rules_inline/link.yo` (inline links) | `link.mjs` | ~110 | 2.6, 2.1–2.3 |
| 4.8 | `rules_inline/image.yo` (images) | `image.mjs` | ~100 | 2.6, 2.1–2.3 |
| 4.9 | `rules_inline/autolink.yo` (<url>) | `autolink.mjs` | ~60 | 2.6, 0.6 |
| 4.10 | `rules_inline/html_inline.yo` (inline HTML) | `html_inline.mjs` | ~35 | 2.6, 0.6 |
| 4.11 | `rules_inline/entity.yo` (HTML entities) | `entity.mjs` | ~45 | 2.6, 1.1, 1.2 |
| 4.12 | `rules_inline/balance_pairs.yo` (post-process) | `balance_pairs.mjs` | ~120 | 2.6 |
| 4.13 | `rules_inline/fragments_join.yo` (post-process) | `fragments_join.mjs` | ~40 | 2.6 |
| 4.14 | `rules_inline/linkify.yo` (auto-linkify) | `linkify.mjs` | ~55 | 2.6, 1.9 |
| 4.15 | `parser_inline.yo` — inline parser orchestrator | `parser_inline.mjs` | ~150 | 0.3, 2.6, 4.1–4.14 |

### Phase 5: Core Pipeline & Renderer

Wire everything together.

| # | Task | JS Source | Depends On |
|---|------|-----------|------------|
| 5.1 | `rules_core/normalize.yo` | `normalize.mjs` | 2.4 |
| 5.2 | `rules_core/block.yo` (invoke block parser) | `block.mjs` | 2.4, 3.12 |
| 5.3 | `rules_core/inline.yo` (invoke inline parser) | `inline.mjs` | 2.4, 4.15 |
| 5.4 | `rules_core/linkify.yo` (core-level URL autodetect) | `linkify.mjs` | 2.4, 1.9 |
| 5.5 | `rules_core/replacements.yo` (smart typography) | `replacements.mjs` | 2.4 |
| 5.6 | `rules_core/smartquotes.yo` (quote beautification) | `smartquotes.mjs` | 2.4 |
| 5.7 | `rules_core/text_join.yo` (merge text tokens) | `text_join.mjs` | 2.4 |
| 5.8 | `parser_core.yo` — core pipeline | `parser_core.mjs` | 0.3, 5.1–5.7 |
| 5.9 | `renderer.yo` — HTML renderer | `renderer.mjs` | 0.2, 0.4 |
| 5.10 | `presets/default.yo` | `presets/default.mjs` | — |
| 5.11 | `presets/commonmark.yo` | `presets/commonmark.mjs` | — |
| 5.12 | `presets/zero.yo` | `presets/zero.mjs` | — |
| 5.13 | `markdown_it.yo` — main MarkdownIt class | `index.mjs` | 5.8–5.12 |
| 5.14 | `lib.yo` — public API exports | — | 5.13 |
| 5.15 | `main.yo` — CLI (read file/stdin → render HTML) | `bin/markdown-it.mjs` | 5.13 |

### Phase 6: Test Suite

Port all tests from markdown-it's Mocha test suite to Yo `.test.yo` files.

| # | Task | JS Source | Test Count (approx) | Depends On |
|---|------|-----------|-------------------|------------|
| 6.1 | Copy test fixtures into `tests/fixtures/` | `test/fixtures/` | — | — |
| 6.2 | Build fixture parser utility (read `.txt` fixture format) | — | — | Phase 5 |
| 6.3 | Port `token.test.yo` | `test/token.mjs` | ~10 | 0.2 |
| 6.4 | Port `ruler.test.yo` | `test/ruler.mjs` | ~15 | 0.3 |
| 6.5 | Port `utils.test.yo` | `test/utils.mjs` | ~20 | 0.4 |
| 6.6 | Port `renderer.test.yo` | `test/misc.mjs` (partial) | ~15 | 5.9 |
| 6.7 | Port `markdown_it.test.yo` (integration) | `test/markdown-it.mjs` + `test/misc.mjs` | ~100+ | Phase 5 |
| 6.8 | Port `commonmark.test.yo` (spec compliance) | `test/commonmark.mjs` | ~600+ | Phase 5 |
| 6.9 | Port `pathological.test.yo` (ReDoS safety) | `test/pathological.mjs` | ~10 | Phase 5 |
| 6.10 | Port entity/mdurl/linkify tests | npm package tests | ~50 | Phase 1 |

**markdown-it fixture format** (used in `test/fixtures/`):

```
Header text
.
markdown input
.
expected HTML output
.
```

We need a fixture file parser in Yo to read these and compare results.

### Phase 7: Benchmark

| # | Task | Depends On |
|---|------|------------|
| 7.1 | Copy benchmark sample files into `benchmark/samples/` | — |
| 7.2 | Implement `benchmark/bench.yo` — read each sample, run parse+render N times, measure timing | Phase 5 |
| 7.3 | Implement `benchmark/bench_runner.js` — Node.js script running markdown-it on same samples for comparison | — |
| 7.4 | Add WASM benchmark target (compile to WASM, run via wasmtime/node) | 7.2 |
| 7.5 | Create benchmark comparison report script | 7.2, 7.3 |

### Phase 8: WASM Targets

| # | Task | Depends On |
|---|------|------------|
| 8.1 | Test compilation with `--target wasm32-emscripten` (via `--cc emcc`) | Phase 5 |
| 8.2 | Test compilation with `--target wasm-wasi` (runs via `wasmtime`) | Phase 5 |
| 8.3 | Fix any WASM-specific issues (errno constants, missing syscalls, etc.) | 8.1, 8.2 |
| 8.4 | Add WASM targets to `build.yo` | 8.3 |
| 8.5 | Run full test suite on WASM targets | 8.4 |

---

## Key Design Decisions

### 1. Token Representation

markdown-it's Token is a mutable JS object with 15+ fields. In Yo:

```rust
Token :: struct(
  type_name : String,         // e.g., "heading_open", "paragraph_close"
  tag : String,               // HTML tag name: "h1", "p", ""
  attrs : Option(ArrayList(StringPair)),  // [["href", "url"], ["title", "t"]]
  nesting : i32,              // 1 = open, 0 = self-close, -1 = close
  level : i32,                // Nesting level for indentation
  children : Option(ArrayList(Token)),  // Inline tokens
  content : String,           // Text content
  markup : String,            // Fence info, emphasis marker, etc.
  info : String,              // Fence language, etc.
  meta : Option(Box(TokenMeta)),  // Rule-specific data
  block : bool,               // true = block-level token
  hidden : bool               // true = don't render
);
```

### 2. Ruler System

The JS Ruler uses dynamic arrays with caching. In Yo, we use a generic Ruler(T) where T is the rule function type:

```rust
// Block rule signature:
BlockRuleFn :: fn(state: *(StateBlock), startLine: i32, endLine: i32, silent: bool) -> bool;

// Inline rule signature:
InlineRuleFn :: fn(state: *(StateInline), silent: bool) -> bool;
```

### 3. String Processing Strategy

markdown-it operates on strings via character code access (`charCodeAt`). Yo's `String` is UTF-8; we'll use byte-level access where safe (ASCII-fast paths) and rune-level access for Unicode. This mirrors how markdown operates: most syntax characters are ASCII.

### 4. Mutable State via Pointers

markdown-it mutates state objects heavily. In Yo, pass `*(StateBlock)` / `*(StateInline)` pointers to rule functions for in-place mutation.

### 5. No Plugin System (Initially)

The `use()` plugin API relies on JS dynamic dispatch. We'll defer the plugin system and hard-code all standard rules. Plugin support can be added later via trait objects or function pointers.

---

## CLI Design (main.yo)

`main.yo` is a CLI executable for converting markdown to HTML. Usage:

```bash
# Convert a markdown string
./markdown-it-yo "# Hello **world**"

# Convert a file
./markdown-it-yo input.md

# Read from stdin (pipe)
cat README.md | ./markdown-it-yo
```

This enables easy manual testing during development: write markdown, see HTML output, compare against `npx markdown-it`.

## Compilation & Testing Commands

```bash
# Build library + CLI
cd /path/to/markdown_it_yo
yo build

# Run CLI
yo build run -- input.md

# Run tests
yo build test

# Run specific test file (during development, from Yo repo)
cd /path/to/Yo
./yo-cli test /path/to/markdown_it_yo/tests/token.test.yo --bail -v

# Native benchmark
yo build run -- --benchmark

# WASM compilation
yo build -Dtarget=wasm32-emscripten
yo build -Dtarget=wasm-wasi

# Compare benchmarks
node benchmark/bench_runner.js  # markdown-it (JS)
./benchmark/bench               # markdown-it-yo (native)
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Yo regex engine missing features used by markdown-it | High | markdown-it uses relatively simple regexes; test each pattern early |
| HTML entity table is 2,231 entries — HashMap perf | Medium | Pre-populate at program init; could use perfect hashing |
| String slicing performance (UTF-8 vs JS UTF-16) | Medium | Use byte-level Slice(u8) for ASCII-heavy parsing hot paths |
| linkify-it is complex (~1,200 lines) | High | Port incrementally; start with basic URL detection, add edge cases |
| Yo compiler bugs discovered during porting | Medium | Document in Yo/issues; work around if non-blocking |
| WASM target limitations (missing syscalls) | Low | markdown parsing is pure computation — no I/O needed in core |
| CommonMark spec has 652 examples | Low | Automate with fixture parser; track pass rate incrementally |

---

## Estimated Scope

| Phase | Files | Approx Yo Lines |
|-------|-------|-----------------|
| Phase 0: Foundation | 6 | ~400 |
| Phase 1: Dependencies | 10 | ~2,000 |
| Phase 2: Helpers & State | 6 | ~500 |
| Phase 3: Block Parser | 12 | ~1,400 |
| Phase 4: Inline Parser | 15 | ~1,000 |
| Phase 5: Core & Renderer | 15 | ~800 |
| Phase 6: Tests | 10+ | ~2,000 |
| Phase 7: Benchmark | 3 | ~300 |
| Phase 8: WASM | 0 (config only) | ~50 |
| **Total** | **~77 files** | **~8,500 lines** |

---

## Candidates for Yo Standard Library Promotion

Several modules built during this port are general-purpose and could be upstreamed to `std/` after stabilization:

| Module | Candidate `std/` Path | Rationale |
|--------|----------------------|-----------|
| `src/entities/` | `std/encoding/html_entities` | HTML entity encode/decode is universally useful (HTML templating, sanitization, etc.). Not HTML-parser-specific. |
| `src/mdurl/` | Enhance existing `std/url` | `std/url` already exists with RFC 3986 parsing. The mdurl encode/decode (percent-encoding) could be merged into it. |
| `src/punycode/` | `std/encoding/punycode` | IDN/Punycode (RFC 3492) is a standalone algorithm used by DNS, email, browsers. General-purpose. |
| `src/unicode/categories.yo` | Enhance `std/data/rune` | Unicode Punctuation/Space category ranges complement the existing `is_whitespace()`, `is_digit()`, etc. on `rune`. |
| Fixture test parser | `std/testing` | Generic "input `.` expected output" fixture runner could benefit other Yo projects. |

**Strategy:** Build them within `markdown_it_yo/src/` first, validate through the full test suite, then propose PRs to upstream them into Yo's `std/`.

---

## Notes

- The markdown-it JS codebase is ~3,800 lines. The Yo port will be larger (~8,500) because:
  - JS dependencies (entities, mdurl, linkify-it, punycode, uc.micro) must be reimplemented (~2,000 lines)
  - Yo requires more explicit type annotations than JS
  - Test/benchmark infrastructure is additional
- Phase 0–2 can be developed and tested independently before the parser rules
- Block rules (Phase 3) and inline rules (Phase 4) are largely independent and can be worked on in parallel
- The fixture-based test approach means most tests are data-driven — easy to port by copying fixture files and writing a generic fixture runner
