# markdown_it_yo

A high-performance Markdown parser written in [Yo](https://github.com/shd101wyy/yo) programming language — a direct 1:1 port of the popular [markdown-it](https://github.com/markdown-it/markdown-it) JavaScript library.

> **See also:** [markdown_yo](https://github.com/shd101wyy/markdown_yo) — a custom implementation inspired by markdown-it, [md4c](https://github.com/mity/md4c), and [markdown-wasm](https://github.com/shd101wyy/markdown-wasm), optimized for speed. markdown_it_yo faithfully mirrors the original JS architecture for easier maintenance, while markdown_yo is a **ground-up rewrite** for maximum performance.

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

### Results (Apple M4, macOS)

Parse time only — median of 10 runs, 3 warmup, `--repeat` to amortize process startup:

| Input | markdown-it (JS) | markdown_it_yo (Native) | Ratio |
| ----- | ----------------- | ----------------------- | ----- |
| 1 MB  | 14.6 ms           | 129 ms                  | 0.1×  |
| 5 MB  | 73 ms             | 656 ms                  | 0.1×  |
| 20 MB | 342 ms            | 2646 ms                 | 0.1×  |

The 1:1 port is currently ~9× slower than the JS original due to reference counting overhead on the Token-based AST (each Token is a heap-allocated RC object with String fields). See [markdown_yo](https://github.com/shd101wyy/markdown_yo) for a custom implementation that is **2-2.5× faster** than JS through a SAX architecture with value-type tokens.

### Optimizations Applied

Despite being a faithful 1:1 port, several optimizations have been applied to reduce overhead:

1. **Enum token types** — Token `type_name` uses an `enum` instead of `String`, eliminating millions of string allocations and comparisons
2. **Value-type token tags** — Token `tag` uses `str` (16-byte value type, pointer+length) instead of `String` (RC heap object)
3. **Buffer-pattern renderer** — Renderer appends to a pre-allocated `String` buffer via `push_str`/`push_string` instead of string concatenation
4. **Zero-allocation HTML escaping** — `escape_html_to()` appends escaped content directly to the output buffer
5. **`push_str` for literals** — String literal appends use `push_str("...")` (str type) instead of `push_string(\`...\`)` (String type)
6. **libc allocator** — System malloc outperforms mimalloc for this allocation pattern (many small RC objects). Set via `build.Allocator.Libc` in `build.yo`
7. **Pre-allocated buffers** — Render buffer pre-allocated to 1.5× source size
8. **Bulk memory operations** — `String.substring` and `String.trim` use `memcpy`/`extend_from_ptr` instead of byte-by-byte copying
9. **Pointer-based access** — `ArrayList.get_ptr` returns pointers to elements without copying, avoiding RC overhead in hot loops
10. **Regex caching** — Compiled regex patterns cached as module-level variables

The remaining performance gap is primarily due to reference counting overhead on Token objects — each of the ~3 tokens/line is a heap-allocated RC object. V8's generational GC handles this pattern more efficiently.

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
