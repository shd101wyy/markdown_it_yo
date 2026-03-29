---
applyTo: "src/**/*.yo"
description: "Use when translating markdown-it JavaScript source code to Yo. Covers 1:1 translation patterns for all JS constructs."
---

# JS → Yo Translation Patterns

This project performs a near **1:1 translation** of markdown-it's JavaScript source to Yo. Preserve the original structure, names, and algorithms. Only change what the language requires.

## General Rules

- **Preserve JS function/variable names** — use the same names (snake_case is fine, JS already uses camelCase in some places; keep the original).
- **Add a comment** at the top of each file referencing the JS source: `// Ported from: lib/token.mjs (markdown-it v14.1.1)`
- **Preserve algorithm structure** — same loops, same conditions, same order of operations.
- **Do NOT optimize** the algorithms during translation. Correctness first.

## Type Mappings

| JS Type / Pattern | Yo Type |
|-------------------|---------|
| `string` | `String` |
| `number` (integer) | `i32` |
| `number` (char code) | `i32` (for charCodeAt) or `u8` (for byte access) |
| `boolean` | `bool` |
| `null` | `.None` (via `Option(T)`) |
| `Array` | `ArrayList(T)` |
| `Object` (as map) | `HashMap(String, T)` |
| `Object` (as struct) | Named `struct(...)` |
| `RegExp` | `Regex` from `std/regex` |
| `function` | Named `fn` type or function pointer |
| `undefined` / missing | `Option(T)` with `.None` |

## Constructor / Class → Struct + impl

JS classes become Yo structs with methods via `impl`. **Use parentheses `StructName(field: value)` for struct literals, NOT curly braces `{}`** — curly braces create anonymous structs in Yo:

```javascript
// JS:
function Token(type, tag, nesting) {
  this.type = type;
  this.tag = tag;
  this.nesting = nesting;
  this.level = 0;
  this.content = '';
}
Token.prototype.attrIndex = function(name) { ... }
```

```rust
// Yo:
Token :: struct(
  type_name : String,
  tag : String,
  nesting : i32,
  level : i32,
  content : String
);

impl(Token,
  new : (fn(type_name: String, tag: String, nesting: i32) -> Self)(
    Self(
      type_name: type_name,
      tag: tag,
      nesting: nesting,
      level: i32(0),
      content: ``
    )
  ),

  attrIndex : (fn(self: *(Self), name: String) -> i32)({
    // ...
  })
)
```

**Self-referential fields** must use `Self`, not the struct name (the name isn't available during definition):

```rust
// WRONG:
Token :: struct(children : Option(ArrayList(Token)));

// CORRECT:
Token :: struct(children : Option(ArrayList(Self)));
```

## Null Checks → Option Pattern

```javascript
// JS:
if (this.attrs) { ... }
if (!this.attrs) { return -1; }
this.attrs = [attrData];
```

```rust
// Yo:
match(self.*.attrs,
  .Some(attrs) => { ... },
  .None => { return i32(-1); }
);
self.*.attrs = .Some(ArrayList(StringPair).new());
```

## Array Operations

```javascript
// JS:
arr.push(item);
arr.length;
arr[i];
arr.indexOf(x);
arr.splice(index, 0, item);  // insert
arr.splice(index, 1);        // remove
arr.forEach(fn);
arr.slice(start, end);
```

```rust
// Yo:
arr.push(item);
arr.length();
arr.get(i);
arr.index_of(x);
arr.insert(index, item);
arr.remove(index);
// forEach → use while loop with index
// slice → arr.slice(start, end)
```

## String Operations

```javascript
// JS:
str.charCodeAt(i);
str.charAt(i);
str.indexOf(substr);
str.slice(start, end);
str.trim();
str.replace(regex, replacement);
str.toLowerCase();
str.toUpperCase();
str.length;
str.split(sep);
```

```rust
// Yo:
// charCodeAt → byte access for ASCII, or .at(i) for rune
str.index_of(substr);
str.substring(start, end);
str.trim();
str.replace(old, new_str);
str.to_lowercase();
str.to_uppercase();
str.length();
str.split(sep);
```

## Control Flow

```javascript
// JS:
for (let i = 0; i < len; i++) { ... }
while (condition) { ... }
if (cond) { ... } else if (cond2) { ... } else { ... }
switch (x) { case 1: ...; break; case 2: ...; break; default: ... }
```

```rust
// Yo:
(i : i32) = i32(0);
while (i < len), {
  // ...
  i = (i + i32(1));
};

while condition, {
  // ...
};

cond(
  cond1 => { ... },
  cond2 => { ... },
  true => { ... }
);

// switch → cond or match
cond(
  (x == i32(1)) => { ... },
  (x == i32(2)) => { ... },
  true => { ... }
);
```

## Regex

```javascript
// JS:
const re = /pattern/flags;
re.test(str);
str.match(re);
str.replace(re, replacement);
```

```rust
// Yo:
re := Regex.new(`pattern`, `flags`).unwrap();
re.test(str);
re.exec(str);
re.replace(str, replacement);
```

## Mutation via Pointers

JS mutates objects freely. In Yo, pass `*(T)` pointers for mutable access:

```javascript
// JS:
function rule(state) {
  state.pos++;
  state.tokens.push(token);
}
```

```rust
// Yo:
rule :: (fn(state: *(StateInline)) -> unit)({
  state.*.pos = (state.*.pos + i32(1));
  state.*.tokens.push(token);
});
```

## Error Handling

```javascript
// JS:
throw new Error('Parser rule not found: ' + name);
```

```rust
// Yo — for now, use assert or a simple error pattern:
assert(false, `Parser rule not found: ${name}`);
// Or use Result(T, E) where appropriate
```

## Important: Reserved Words

These JS identifiers conflict with Yo keywords and must be renamed:

| JS Name | Yo Name | Reason |
|---------|---------|--------|
| `type` | `type_name` | `type` is reserved in Yo |
| `match` | `match_result` or context-specific | `match` is a keyword in Yo |
| `import` | `import_module` or context-specific | `import` is a keyword in Yo |
| `export` | `export_value` or context-specific | `export` is a keyword in Yo |
| `return` | fine as keyword | used normally |

## `::` vs `:=` — comptime vs runtime bindings

- `::` — compile-time constant binding. Only valid for types, functions, and compile-time values (e.g., `str` literals from `"..."`)
- `:=` — runtime binding. Required for runtime values like `String` (template strings with interpolation)

```rust
// CORRECT — double-quoted strings are comptime str:
pattern :: "([a-zA-Z]+)";

// WRONG — template strings with interpolation produce runtime String:
full_pattern :: `^(?:${pattern})`;

// CORRECT — use := for runtime String values:
full_pattern := `^(?:${pattern})`;
```

## Generic (forall) functions

JS generic patterns become `forall` in Yo. **Always specify the type constraint** (`T : Type`):

```rust
// WRONG — missing type constraint:
arrayReplaceAt :: (fn(forall(T), src: ArrayList(T)) -> ArrayList(T))(...);

// CORRECT:
arrayReplaceAt :: (fn(forall(T : Type), src: ArrayList(T)) -> ArrayList(T))(...);
```

## Enum variant type inference in begin blocks

When returning an enum variant like `.Some(...)` or `.None` from a begin block `{ ... }`, Yo may fail to infer the enum type. Assign to a typed variable first:

```rust
// WRONG — "Failed to infer enum variant type":
attrGet : (fn(self: *(Self), name: String) -> Option(String))({
  match(self.*.attrs,
    .Some(attrs) => {
      (pair : StringPair) = attrs.get(usize(idx)).unwrap();
      .Some(pair.value)  // <-- type inference fails here
    },
    .None => .None
  )
})

// CORRECT — use typed variable:
attrGet : (fn(self: *(Self), name: String) -> Option(String))({
  match(self.*.attrs,
    .Some(attrs) => {
      (pair : StringPair) = attrs.get(usize(idx)).unwrap();
      (result : Option(String)) = .Some(pair.value);
      result
    },
    .None => {
      (result : Option(String)) = .None;
      result
    }
  )
})
```

Also note: the last expression in a begin block `{ ... }` must NOT have a trailing semicolon if you want it returned as the block's value. `result;` returns `unit`, `result` returns the value.

## ArrayList API

Yo's `ArrayList(T)` differs from JS arrays in key ways:

| JS | Yo `ArrayList(T)` |
|---|---|
| `arr.length` | `arr.len()` (returns `usize`) |
| `arr[i]` | `arr.get(usize(i))` (returns `Option(T)`, use `.unwrap()`) |
| `arr[i] = v` | `arr.set(usize(i), v)` (returns `Result`) |
| `arr.push(v)` | `arr.push(v)` (returns `Result`, can ignore) |
| `arr.pop()` | `arr.pop()` (returns `Option(T)`) |
| `arr.splice(i, n)` | `arr.remove(usize(i), count: usize(n))` |
| `arr.splice(i, 0, v)` | No `insert` — use manual approach |
| `arr.indexOf(v)` | `arr.index_of(v)` (returns `Option(usize)`) |
| `arr.includes(v)` | `arr.contains(v)` (returns `bool`) |
| `arr.slice(s, e)` | `arr.slice(usize(s), usize(e))` (returns `Result`) |

**No `insert` method** — to insert at a position, build a new list or use slice+concat.

## `impl` blocks must end with semicolon

Every `impl(...)` call must end with `);` — the semicolon is required:

```rust
// CORRECT:
impl(Token,
  new : (fn() -> Self)(Self(field: val))
);

// WRONG — missing semicolon causes "Invalid function call on type" error:
impl(Token,
  new : (fn() -> Self)(Self(field: val))
)
```

## Preserving Line References

When a translation is non-trivial (e.g., restructuring a loop, splitting a complex expression), add a comment:

```rust
// JS: line 42-55 of ruler.mjs — splice + cache invalidation
```
