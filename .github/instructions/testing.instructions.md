---
applyTo: "tests/**"
description: "Testing conventions for the markdown-it-yo project. Covers test file structure, fixture-based testing, and benchmark patterns."
---

# Testing Conventions

## Test File Structure

Each test file follows the pattern:

```rust
// Tests for: <module name>
// Ported from: test/<source>.mjs (markdown-it v14.1.1)

open import "std/fmt";
{ Token } :: import "../src/token.yo";

test "Token — constructor", {
  tok := Token.new(`paragraph_open`, `p`, i32(1));
  assert((tok.type_name == `paragraph_open`), "type should match");
  assert((tok.tag == `p`), "tag should match");
  assert((tok.nesting == i32(1)), "nesting should match");
};
```

## Running Tests

```bash
# From the Yo compiler directory:
cd /path/to/Yo
bun run build

# Run specific test file
./yo-cli test /path/to/markdown_it_yo/tests/token.test.yo --bail -v

# Run with verbose output saved to file
./yo-cli test /path/to/markdown_it_yo/tests/token.test.yo --bail -v &> test_output.txt
```

## Fixture-Based Tests

markdown-it uses a text fixture format where test cases are separated by `.` lines:

```
Test description
.
markdown input
.
expected HTML output
.
```

We port these fixture files verbatim into `tests/fixtures/` and build a Yo fixture parser to read and run them.

## Test Coverage Priority

1. **Unit tests** for Token, Ruler, utils — port first (Phase 0)
2. **Integration tests** via fixture files — port with each parser phase
3. **CommonMark spec** — `tests/fixtures/commonmark/good.txt` (~600 examples)
4. **Pathological input** — ReDoS and edge cases
5. **Benchmarks** — separate from correctness tests

## Assertions

- `assert(condition, "descriptive message")` — runtime assertion
- Compare strings with `==`: `assert((result == expected), "mismatch")`
- For fixture tests, print both expected and actual on failure for debugging

## WASM Testing

- Add `// @skip_wasm` directive to test files that use features unavailable on WASM
- File I/O tests should be skipped on WASM targets
- Pure parsing tests should work on all targets
