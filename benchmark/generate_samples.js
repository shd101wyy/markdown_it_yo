#!/usr/bin/env node
// Generate benchmark sample files of various sizes.
// Uses markdown-it fixture data as the base, repeated to fill target sizes.

const fs = require("fs");
const path = require("path");

const SIZES = {
  "1mb": 1 * 1024 * 1024,
  "5mb": 5 * 1024 * 1024,
};

function extractMarkdownFromFixtures() {
  const fixtureDir = path.join(__dirname, "..", "tests", "fixtures");
  const files = [
    path.join(fixtureDir, "commonmark", "good.txt"),
    path.join(fixtureDir, "markdown_it", "commonmark_extras.txt"),
    path.join(fixtureDir, "markdown_it", "tables.txt"),
    path.join(fixtureDir, "markdown_it", "strikethrough.txt"),
    path.join(fixtureDir, "markdown_it", "typographer.txt"),
  ];

  const chunks = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");
    let inMarkdown = false;
    let dotCount = 0;
    for (const line of lines) {
      if (line.trim() === ".") {
        dotCount++;
        if (dotCount % 2 === 1) {
          inMarkdown = true;
          continue;
        } else {
          inMarkdown = false;
          continue;
        }
      }
      if (inMarkdown) chunks.push(line);
    }
  }
  return chunks.join("\n") + "\n";
}

const base = extractMarkdownFromFixtures();
const baseBytes = Buffer.byteLength(base, "utf-8");
console.log(`Base markdown extracted: ${(baseBytes / 1024).toFixed(1)} KB`);

const samplesDir = path.join(__dirname, "samples");
fs.mkdirSync(samplesDir, { recursive: true });

for (const [name, targetSize] of Object.entries(SIZES)) {
  const repeats = Math.ceil(targetSize / baseBytes);
  let content = "";
  for (let i = 0; i < repeats; i++) content += base;
  content = content.slice(0, targetSize);
  const outPath = path.join(samplesDir, `bench_${name}.md`);
  fs.writeFileSync(outPath, content);
  console.log(
    `Generated ${outPath}: ${(Buffer.byteLength(content) / 1024 / 1024).toFixed(2)} MB`
  );
}

// Also write to repo root for manual testing
for (const [name, targetSize] of Object.entries(SIZES)) {
  const outPath = path.join(__dirname, "..", `bench_${name}.md`);
  if (!fs.existsSync(outPath)) {
    const repeats = Math.ceil(targetSize / baseBytes);
    let content = "";
    for (let i = 0; i < repeats; i++) content += base;
    content = content.slice(0, targetSize);
    fs.writeFileSync(outPath, content);
    console.log(`Generated ${outPath}`);
  }
}

console.log("Done.");
