---
applyTo: "**/*.yo"
description: "Yo language coding conventions specific to the markdown_it_yo project. Covers struct design, memory management, naming, and module organization."
---

# Yo Coding Conventions for markdown_it_yo

## Module Organization

- One Yo file per JS source file (1:1 mapping)
- Each file starts with: `// Ported from: lib/<path>.mjs (markdown-it v14.1.1)`
- Use `open import` for frequently used std modules (`std/fmt`, `std/string`)
- Use destructured imports for project-internal modules: `{ Token } :: import "./token.yo";`
- Do NOT import `std/prelude` — it is auto-loaded

## Naming Conventions

- **Struct names:** PascalCase, matching JS class names (`Token`, `Ruler`, `StateBlock`)
- **Function names:** snake_case or camelCase — **match the JS original** for 1:1 files
- **Constants:** UPPER_SNAKE_CASE for regex patterns and lookup tables
- **Type aliases:** PascalCase (`BlockRuleFn`, `InlineRuleFn`, `StringPair`)

## Common Type Aliases

Define these in a shared types module or at point of use:

```rust
// String pair for HTML attributes: ["name", "value"]
StringPair :: struct(name: String, value: String);

// Rule function signatures
BlockRuleFn :: fn(state: *(StateBlock), startLine: i32, endLine: i32, silent: bool) -> bool;
InlineRuleFn :: fn(state: *(StateInline), silent: bool) -> bool;
CoreRuleFn :: fn(state: *(StateCore)) -> unit;
```

## Struct Design

- Use `struct(...)` for value types (Token, StateBlock, etc.)
- Fields that are `null` in JS → `Option(T)` in Yo
- Fields that are empty strings in JS → use template string `` ` ` `` for default empty `String`
- Fields that are `0` in JS → `i32(0)`
- Fields that are `false` in JS → `false`
- Arrays that start as `[]` → `ArrayList(T).new()`
- Arrays that start as `null` → `Option(ArrayList(T))` with `.None`

## Memory Management

- Yo uses reference counting. Be mindful of ownership.
- Use `*(T)` pointers for mutable function parameters (state objects passed to rules)
- Avoid unnecessary copies of large strings — pass by reference where possible
- `ArrayList` and `HashMap` are reference-counted objects

## String Handling

- **Template strings** `` `text` `` produce `String` type — use for string construction and concatenation
- **Double-quoted strings** `"text"` produce `str` type at runtime — use for literal comparisons
- **String concatenation:** Use template string interpolation `` `${a}${b}` `` instead of repeated `.concat()`
- **Character code access:** For ASCII-only parsing, byte-level access is fastest
- **Regex:** Use `Regex.new(pattern, flags)` from `std/regex`

## Error Handling

- Use `assert(condition, "message")` for programming errors (e.g., rule not found)
- Use `Result(T, E)` for recoverable errors
- Use `Option(T)` for values that may be absent

## Code Style

- Always parenthesize binary operations: `((a + b) * c)`
- Always use `cond(...)` with parentheses, not bare `cond`
- Always use `match(...)` with parentheses
- Use begin blocks `{ stmt1; stmt2; result }` for multi-statement bodies
- End function bodies with the return expression (no trailing semicolon for the last expression that should be returned)
