# markdown_it_yo

A high-performance Markdown parser written in [Yo](https://github.com/shd101wyy/yo) programming language — a direct 1:1 port of the popular [markdown-it](https://github.com/markdown-it/markdown-it) JavaScript library.

> **See also:** [markdown_yo](https://github.com/nicolo-ribaudo/markdown_yo) — a custom implementation inspired by markdown-it, [md4c](https://github.com/mity/md4c), and [markdown-wasm](https://github.com/nicolo-ribaudo/markdown-wasm), optimized for speed. markdown_it_yo faithfully mirrors the original JS architecture for easier maintenance, while markdown_yo is a **ground-up rewrite** for maximum performance.

## Features

- 100% CommonMark compliance
- Extensions: tables, strikethrough, typographer, smartquotes, linkify
- Fast native compilation via Yo → C11 → clang
- CLI tool for converting markdown files/stdin to HTML

## Prerequisites

- [Yo compiler](https://www.npmjs.com/package/@shd101wyy/yo) (`npm install -g @shd101wyy/yo`)
- A C compiler (clang recommended)

## Build

```bash
yo build          # Build executable + static library
yo build run      # Build and run (reads from stdin)
```

## Usage

```bash
# Read from stdin
echo "# Hello **World**" | ./yo-out/$TARGET/bin/markdown_it_yo -

# Read from file
./yo-out/$TARGET/bin/markdown_it_yo README.md

# CLI options
./yo-out/$TARGET/bin/markdown_it_yo --html --typographer input.md
./yo-out/$TARGET/bin/markdown_it_yo --commonmark input.md
./yo-out/$TARGET/bin/markdown_it_yo --no-lang-prefix input.md
```

### CLI Flags

| Flag               | Description                                   |
| ------------------ | --------------------------------------------- |
| `--html`           | Enable HTML tags in source                    |
| `--typographer`    | Enable typographic replacements               |
| `--commonmark`     | Use CommonMark preset                         |
| `--no-lang-prefix` | Disable language prefix on fenced code blocks |

## Test

### Unit Tests (Yo)

```bash
yo build test     # Run token, ruler, and other unit tests
```

### Fixture Tests (vs markdown-it JS)

Compare output against the reference JavaScript implementation:

```bash
npm install                      # Install markdown-it JS dependency
node scripts/run_fixture_tests.js  # Run 826 fixture tests
```

Current results: **815 passed**, 0 failed, 11 skipped across 9 test suites.

## Benchmark

### Running Benchmarks

```bash
# Generate benchmark input files (1MB and 5MB of repeated markdown)
node benchmark/generate_samples.js

# Run benchmark comparing JS and Yo
node benchmark/run.js
```

### Manual Benchmarking

```bash
# Build with system allocator for best performance on macOS
clang -std=c11 -w -O3 yo-out/aarch64-macos/bin/markdown_it_yo.c -o bench_native

# Time native execution
/usr/bin/time bench_native bench_1mb.md > /dev/null

# Time JavaScript execution
/usr/bin/time node -e "const md = require('markdown-it')(); const fs = require('fs'); md.render(fs.readFileSync('bench_1mb.md', 'utf8'));"
```

### Results (Apple M4, macOS 26.3.1)

All implementations produce **byte-identical HTML output** for the same input.

#### Wall Clock Time

| Input | markdown_it_yo (Native) | markdown_it_yo (WASM) | markdown-it (Node.js) |
| ----- | ----------------------- | --------------------- | --------------------- |
| 1 MB  | **0.06s**               | 0.22s                 | 0.11s                 |
| 5 MB  | **0.32s**               | 0.93s                 | 0.42s                 |
| 20 MB | **1.29s**               | 3.60s                 | 1.67s                 |

#### CPU Time (user) — single-thread work

| Input | markdown_it_yo (Native) | markdown_it_yo (WASM) | markdown-it (Node.js) |
| ----- | ----------------------- | --------------------- | --------------------- |
| 1 MB  | **0.05s**               | 0.36s                 | 0.21s                 |
| 5 MB  | **0.29s**               | 0.97s                 | 0.69s                 |
| 20 MB | **1.17s**               | 3.28s                 | 2.45s                 |

**markdown_it_yo native is the fastest** — 1.3–1.8× faster wall clock and 2–4× less CPU time than JS. WASM is ~2–3× slower than native due to Emscripten overhead.

#### Memory Usage (RSS)

| Input | markdown_it_yo (Native) | markdown_it_yo (WASM) | markdown-it (Node.js) |
| ----- | ----------------------- | --------------------- | --------------------- |
| 1 MB  | **96 MB**               | 132 MB                | 194 MB                |
| 5 MB  | 467 MB                  | **334 MB**            | 549 MB                |
| 20 MB | 1844 MB                 | **1095 MB**           | 1683 MB               |

WASM has the **lowest memory usage** at 5 MB and 20 MB thanks to Emscripten's compact linear memory. Native uses less memory than JS at 1 MB (2× less). At 20 MB, native's per-token RC objects consume slightly more than V8's generational GC.

#### WASM Build

```bash
# Using build system
yo build wasm

# Or compile directly with Emscripten
yo compile src/main.yo --release --cc emcc \
  --cflags='-sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=256MB -sMAXIMUM_MEMORY=4GB' \
  -o yo-out/wasm/markdown_it_yo.js

# Run with Node.js
node yo-out/wasm/markdown_it_yo.js input.md
```

### Optimizations Applied

The port achieves competitive performance through several key optimizations:

1. **Enum token types** — Token `type_name` uses an `enum` instead of `String`, eliminating millions of string allocations and comparisons (2× speedup)
2. **Value-type token tags** — Token `tag` uses `str` (16-byte value type, pointer+length) instead of `String` (RC heap object), eliminating heap allocations for every token creation
3. **Buffer-pattern renderer** — Renderer appends to a pre-allocated `String` buffer via `push_str`/`push_string` instead of string concatenation
3. **Zero-allocation HTML escaping** — `escape_html_to()` appends escaped content directly to the output buffer using run-batching and `extend_from_ptr`, avoiding intermediate String objects
4. **`push_str` for literals** — All string literal appends use `push_str("...")` (str type) instead of `push_string(\`...\`)` (String type), avoiding RC object creation
5. **libc allocator** — macOS system malloc outperforms mimalloc by 3.3× for this allocation pattern (many small RC objects). Set via `build.Allocator.Libc` in `build.yo`
6. **Pre-allocated buffers** — Render buffer pre-allocated to 1.5× source size; `escape_html` pre-allocates with headroom
7. **O(1) length checks** — `bytes_len()` for byte count instead of `len()` which counts Unicode characters
8. **Bulk memory operations** — `String.substring` and `String.trim` use `memcpy`/`extend_from_ptr` instead of byte-by-byte copying
9. **Pointer-based access** — `ArrayList.get_ptr` returns pointers to elements without copying, avoiding RC overhead in hot loops
10. **Regex caching** — Compiled regex patterns cached as module-level variables instead of recompiled per call
11. **Pre-allocated arrays** — Parser state arrays pre-allocated to expected capacity

### Verifying Correctness

The benchmark verifies that Yo and JS produce byte-identical HTML output:

```bash
# Quick correctness check
./bench_native input.md > /tmp/yo.html
node -e "const md = require('markdown-it')(); const fs = require('fs'); process.stdout.write(md.render(fs.readFileSync('input.md', 'utf8')))" > /tmp/js.html
diff /tmp/yo.html /tmp/js.html  # Should produce no output
```

## Project Structure

```
markdown_it_yo/
├── build.yo              # Build system configuration
├── src/
│   ├── main.yo           # CLI entry point
│   ├── lib.yo            # Library entry point
│   ├── markdown_it.yo    # Core MarkdownIt class
│   ├── options.yo        # Configuration presets
│   ├── token.yo          # Token type definition
│   ├── ruler.yo          # Rule chain manager
│   ├── renderer.yo       # HTML renderer
│   ├── common/           # Shared utilities (re-exports from Yo std)
│   ├── helpers/          # Parse helpers
│   ├── parser/           # Parser implementations
│   │   ├── core.yo       # Core parser (normalize, blocks, inline, linkify)
│   │   ├── block.yo      # Block-level parser
│   │   └── inline.yo     # Inline-level parser
│   └── rules/            # Parsing rules
│       ├── core/         # Core rules
│       ├── block/        # Block rules
│       └── inline/       # Inline rules
├── tests/
│   ├── *.test.yo         # Yo unit tests
│   └── fixtures/         # markdown-it fixture files
├── scripts/
│   └── run_fixture_tests.js  # Fixture test runner
└── benchmark/
    └── run.js            # Benchmark script
```

## License

ISC (same as markdown-it)

## Acknowledgments

This project is a direct port of [markdown-it](https://github.com/markdown-it/markdown-it) by Vitaly Puzrin and Alex Kocharin. All credit for the parser design and algorithms goes to the original authors.
