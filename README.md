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
yo build          # Build native executable + static library
yo build run      # Build and run (reads from stdin)
yo build wasm     # Build WASM target (requires emscripten)
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

### Results (Apple M4, macOS)

**Parse + render time** — median of 10 runs, 3 warmup, `--repeat` to amortize process startup:

| Input | markdown-it (JS) | Native | WASM | Native× | WASM× |
| ----- | ----------------- | ------ | ---- | ------- | ----- |
| 1 MB  | 14.6 ms           | 10.5 ms | 16.0 ms | 1.4× | 0.9× |
| 5 MB  | 72.1 ms           | 57.9 ms | 82.6 ms | 1.2× | 0.9× |
| 20 MB | 340.2 ms          | 241.3 ms | 340.7 ms | 1.4× | 1.0× |

The native build is **1.2–1.4× faster** than JS. WASM matches JS at large inputs (1.0×) and is within 10% at small inputs (0.9×).

> **Note on wall-clock benchmarks:** Single-run wall-clock timings (e.g., `/usr/bin/time`) can be misleading — Node.js startup adds ~30-60ms of overhead for WASM (module compilation + runtime init) that amortizes away with higher repeat counts. The numbers above use `--repeat 100/20/10` for 1MB/5MB/20MB to properly amortize startup.

### Optimizations Applied

Despite being a faithful 1:1 port, several optimizations bring performance well beyond JS parity:

1. **Enum token types** — Token `type_name` uses an `enum` instead of `String`, eliminating millions of string allocations
2. **Value-type token tags** — Token `tag` uses `str` (value type) instead of `String` (RC heap object)
3. **Buffer-pattern renderer** — Pre-allocated `String` buffer via `push_str`/`push_string`
4. **Zero-allocation HTML escaping** — `escape_html_to()` appends directly to output buffer
5. **libc allocator** — System malloc outperforms mimalloc for this allocation pattern
6. **Pre-allocated buffers** — Render buffer (1.5× source), token arrays, inline children
7. **Bulk memory operations** — `String.substring`/`String.trim` use `memcpy`
8. **Pointer-based access** — `ArrayList.get_ptr` avoids RC copies in hot loops
9. **Regex caching** — Compiled regex patterns cached as module-level variables
10. **Regex VM buffer reuse** — Swap+clear pattern for thread lists (81% fewer allocations)
11. **Lazy HashMap** — StateInline backticks HashMap only allocated when backticks are present
12. **HashMap-free delimiter processing** — `process_delimiters` uses parallel ArrayLists instead of HashMap
13. **String buffer reuse** — `push_pending` uses `clone()`+`clear()` to reuse the pending buffer
14. **Inline RC functions** — `__yo_incr_rc`/`__yo_decr_rc` marked `static inline`
15. **Manual autolink/entity matching** — Hot inline rules use hand-coded char matching instead of regex
16. **RC borrow chain optimization** — Linked-list traversal patterns avoid redundant dup/drop pairs
17. **URL fast-paths** — `normalize_link`, `encode`, `_is_bad_protocol` skip allocations for common cases (plain ASCII URLs, no protocol)
18. **Zero-alloc hostname check** — `_should_recode_hostname` uses byte-level comparison instead of `String.to_lowercase()`
19. **Deferred children allocation** — Block rules skip creating empty `ArrayList(Token)` for children since `_core_inline` always replaces them
20. **Force-inlined RC functions** — `___drop`/`___dup`/`___dispose` use `__attribute__((always_inline))` for better codegen at `-Os`

### Performance Analysis

The main performance bottleneck is **Token disposal** (~25% of CPU time). Each Token is 152 bytes with 3 RC-able fields (attrs, children, _content_owned). For a 20MB input, the parser creates ~3M tokens. Disposing the token array requires iterating 480MB of memory and checking 3 Option fields per token — most of which are `None`.

V8's generational GC handles short-lived objects nearly for free (young generation bump allocation ~2-3ns), while RC incurs per-operation overhead on every increment/decrement (~5-10ns each). Despite this structural disadvantage, the optimizations above make the native build 1.2–1.4× faster than JS.

For WASM, the `-Os` optimization level provides the best tradeoff between compile time (<30s) and runtime performance. The `-sENVIRONMENT=node` flag strips unused browser glue code. WASM matches JS at large inputs thanks to efficient memory access patterns, though small inputs show ~10% overhead from WASM module compilation and runtime initialization.

See [markdown_yo](https://github.com/shd101wyy/markdown_yo) for a **ground-up rewrite** using a SAX architecture with value-type tokens, targeting 2-5× faster than JS.

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
