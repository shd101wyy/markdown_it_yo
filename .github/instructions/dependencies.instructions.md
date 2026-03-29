---
applyTo: "src/entities/**, src/mdurl/**, src/punycode/**, src/linkify/**, src/unicode/**"
description: "Guidelines for implementing dependency modules that replace npm packages. These do NOT require 1:1 JS translation but must produce identical results."
---

# Dependency Module Implementation

These modules replace npm packages that markdown-it depends on. Unlike the core parser files, these are **clean Yo implementations** — they should be idiomatic Yo code, not line-by-line JS ports.

## Requirements

- **Identical results:** Given the same input, produce the same output as the JS npm package
- **Idiomatic Yo:** Use Yo patterns, types, and conventions naturally
- **Self-contained:** No external dependencies beyond Yo's std library
- **Well-tested:** Each module has its own test file validating against known JS outputs

## Module Specifications

### `src/entities/` — Replaces `entities` npm package

- **Purpose:** HTML entity encoding and decoding
- **Key function:** `decode_html(input: String) -> String` — decode `&amp;`, `&#123;`, `&#x1F;`, `&nbsp;`, etc.
- **Data:** HashMap of 2,231 named HTML entities → Unicode codepoint(s)
- **Reference:** https://html.spec.whatwg.org/multipage/named-characters.html
- **Candidate for `std/encoding/html_entities`**

### `src/mdurl/` — Replaces `mdurl` npm package

- **Purpose:** URL percent-encoding, decoding, parsing, formatting
- **Key functions:**
  - `encode(url: String) -> String` — percent-encode special chars
  - `decode(url: String) -> String` — percent-decode
  - `parse(url: String) -> Url` — parse URL into components
  - `format(parsed: Url) -> String` — format back to string
- **Note:** Yo already has `std/url` — consider extending it rather than duplicating
- **Candidate for enhancing `std/url`**

### `src/punycode/` — Replaces `punycode.js` npm package

- **Purpose:** Punycode encoding/decoding for internationalized domain names (IDN)
- **Key functions:**
  - `to_ascii(domain: String) -> String` — encode Unicode domain to ASCII
  - `to_unicode(domain: String) -> String` — decode ASCII to Unicode domain
- **Reference:** RFC 3492
- **Candidate for `std/encoding/punycode`**

### `src/linkify/` — Replaces `linkify-it` npm package

- **Purpose:** Detect and extract URLs from plain text
- **Key function:** `match(text: String) -> ArrayList(LinkMatch)` — find all URLs
- **Complexity:** This is the largest dependency (~1,200 lines in JS). Port incrementally.
- **Strategy:** Start with basic HTTP/HTTPS URL detection, add email and protocol-less URLs later

### `src/unicode/` — Replaces `uc.micro` npm package

- **Purpose:** Unicode character category detection (Punctuation, Symbol subcategories)
- **Key functions:**
  - `is_punct_char(ch: rune) -> bool` — Unicode P category (Pc|Pd|Pe|Pf|Pi|Po|Ps)
  - `is_symbol_char(ch: rune) -> bool` — Unicode S category (part of it)
- **Strategy:** Use Unicode codepoint range tables (same approach as uc.micro's generated regexes)
- **Candidate for enhancing `std/data/rune`**

## Testing Strategy

For each module, create test cases by running the JS npm package on known inputs and capturing outputs:

```javascript
// Generate test vectors (run in Node.js):
const { decodeHTML } = require('entities');
console.log(JSON.stringify(decodeHTML('&amp;')));  // "&"
console.log(JSON.stringify(decodeHTML('&#38;')));   // "&"
```

Then write Yo tests that assert the same results.
