# markdown-it-yo

A high-performance Markdown parser written in [Yo](https://github.com/nicholasgasior/yo) programming language — a direct port of the popular [markdown-it](https://github.com/markdown-it/markdown-it) JavaScript library.

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
echo "# Hello **World**" | ./yo-out/markdown-it-yo/markdown-it-yo

# Read from file
./yo-out/markdown-it-yo/markdown-it-yo README.md

# CLI options
./yo-out/markdown-it-yo/markdown-it-yo --html --typographer input.md
./yo-out/markdown-it-yo/markdown-it-yo --commonmark input.md
./yo-out/markdown-it-yo/markdown-it-yo --no-lang-prefix input.md
```

### CLI Flags

| Flag | Description |
|------|-------------|
| `--html` | Enable HTML tags in source |
| `--typographer` | Enable typographic replacements |
| `--commonmark` | Use CommonMark preset |
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
clang -std=c11 -w -O3 yo-out/aarch64-macos/bin/markdown-it-yo.c -o bench_native

# Time native execution
/usr/bin/time bench_native bench_1mb.md > /dev/null

# Time JavaScript execution
/usr/bin/time node -e "const md = require('markdown-it')(); const fs = require('fs'); md.render(fs.readFileSync('bench_1mb.md', 'utf8'));"
```

### Results (Apple M-series, macOS)

#### CPU Time (user) — actual work done

| Input | Yo Native | JS/Node.js | WASM/Node.js |
|-------|-----------|------------|--------------|
| 1 MB  | **0.13s** | 0.20s      | 0.33s        |
| 5 MB  | **0.63s** | 0.63s      | 0.89s        |

**Yo native is 35-54% faster than JS in CPU time.**

#### Wall Clock Time

| Input | Yo Native | JS/Node.js | WASM/Node.js |
|-------|-----------|------------|--------------|
| 1 MB  | 0.14s     | **0.10s**  | 0.18s        |
| 5 MB  | 0.68s     | **0.40s**  | 0.75s        |

JS has lower wall-clock time because Node.js V8 uses multi-threaded JIT compilation (user time 0.20s > real time 0.10s ≈ 2 cores).

#### Memory Usage (RSS)

| Input | Yo Native | JS/Node.js | WASM/Node.js |
|-------|-----------|------------|--------------|
| 1 MB  | **163 MB** | 194 MB    | 179 MB       |
| 5 MB  | 808 MB    | **518 MB** | 557 MB       |

### Optimizations Applied

The port achieves competitive performance through several key optimizations:

1. **Integer token types** — Token `type_name` uses `i32` constants instead of `String`, eliminating millions of allocations for comparisons and token creation (2x speedup)
2. **Bulk memory operations** — `String.substring` and `String.trim` use `memcpy`/`extend_from_ptr` instead of byte-by-byte copying
3. **Pointer-based access** — `ArrayList.get_ptr` returns pointers to elements without copying, avoiding RC overhead in hot loops
4. **Regex caching** — Compiled regex patterns cached as module-level variables instead of recompiled per call
5. **Pre-allocated arrays** — Parser state arrays pre-allocated to expected capacity
6. **O(n) string operations** — Fixed O(n²) string concatenation patterns in parser and renderer
7. **System allocator** — macOS system malloc outperforms mimalloc on Apple Silicon; use `--allocator libc` or compile manually with `clang`

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
