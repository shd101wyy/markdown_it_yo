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

```bash
node benchmark/run.js
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
