#!/usr/bin/env node
// Benchmark: markdown-it (JS) vs markdown_it_yo (native)
//
// Runs both implementations on sample markdown files of various sizes
// and reports median throughput.
//
// Usage:
//   node benchmark/run.js              # Run all benchmarks
//   node benchmark/run.js --size 1mb   # Run only 1MB benchmark

const { execSync, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const getArg = (name, defaultVal) => {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
};

const sizeFilter = getArg("--size", null);
const ITERATIONS = parseInt(getArg("--iterations", "10"));
const WARMUP = parseInt(getArg("--warmup", "3"));

// ---------------------------------------------------------------------------
// 1. Resolve paths and generate samples
// ---------------------------------------------------------------------------

const samplesDir = path.join(__dirname, "samples");

// Generate samples if missing
if (!fs.existsSync(samplesDir) || fs.readdirSync(samplesDir).filter(f => f.endsWith(".md")).length === 0) {
  console.log("Generating benchmark samples...");
  execSync(`node ${path.join(__dirname, "generate_samples.js")}`, { stdio: "inherit" });
}

// Resolve Yo binary — search yo-out/<target>/bin/
const yoOutDir = path.join(__dirname, "..", "yo-out");
let yoBinary = null;
let wasmBinary = null;
if (fs.existsSync(yoOutDir)) {
  for (const target of fs.readdirSync(yoOutDir)) {
    if (target.startsWith("wasm")) {
      const candidate = path.join(yoOutDir, target, "bin", "markdown_it_yo_wasm.js");
      if (fs.existsSync(candidate)) wasmBinary = candidate;
    } else {
      const candidate = path.join(yoOutDir, target, "bin", "markdown_it_yo");
      if (fs.existsSync(candidate)) yoBinary = candidate;
    }
  }
}
if (!yoBinary) {
  console.error("ERROR: Binary not found in yo-out/*/bin/markdown_it_yo\nRun `yo build` first.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Discover sample files
// ---------------------------------------------------------------------------

const sizeOrder = { "1mb": 0, "5mb": 1, "20mb": 2 };

let samples = fs.readdirSync(samplesDir)
  .filter(f => f.endsWith(".md"))
  .sort((a, b) => {
    const getSize = name => {
      const m = name.match(/bench_(\w+)\.md/);
      return m ? (sizeOrder[m[1]] ?? 99) : 99;
    };
    return getSize(a) - getSize(b);
  });

if (sizeFilter) {
  samples = samples.filter(f => f.includes(sizeFilter));
}

if (samples.length === 0) {
  console.error("No sample files found!");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 3. Benchmark helpers
// ---------------------------------------------------------------------------

function benchmarkJS(content, warmup, iterations) {
  const md = require("markdown-it")({ html: true, typographer: true });
  for (let i = 0; i < warmup; i++) md.render(content);
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    md.render(content);
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1e6);
  }
  return times;
}

const REPEAT_BY_SIZE = { "1mb": 20, "5mb": 10, "20mb": 3 };

function getRepeat(sizeName) {
  const key = sizeName.toLowerCase();
  return REPEAT_BY_SIZE[key] || 10;
}

function benchmarkNative(binary, filePath, sizeName, warmup, iterations) {
  const repeat = getRepeat(sizeName);
  for (let i = 0; i < warmup; i++) {
    execFileSync(binary, ["--repeat", String(repeat), filePath], {
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 200 * 1024 * 1024,
    });
  }
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    execFileSync(binary, ["--repeat", String(repeat), filePath], {
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 200 * 1024 * 1024,
    });
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1e6 / repeat);
  }
  return times;
}

function benchmarkWasm(filePath, sizeName, warmup, iterations) {
  const repeat = getRepeat(sizeName);
  for (let i = 0; i < warmup; i++) {
    execFileSync("node", [wasmBinary, "--repeat", String(repeat), filePath], {
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 200 * 1024 * 1024,
    });
  }
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    execFileSync("node", [wasmBinary, "--repeat", String(repeat), filePath], {
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 200 * 1024 * 1024,
    });
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1e6 / repeat);
  }
  return times;
}

function stats(times) {
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const min = times[0];
  const max = times[times.length - 1];
  return { median, mean, min, max };
}

// ---------------------------------------------------------------------------
// 4. Run benchmarks
// ---------------------------------------------------------------------------

console.log(`\n${"═".repeat(72)}`);
console.log(`  markdown_it_yo Benchmark — ${WARMUP} warmup, ${ITERATIONS} iterations`);
if (wasmBinary) console.log(`  WASM: ${wasmBinary}`);
console.log(`${"═".repeat(72)}\n`);

const results = [];

for (const sample of samples) {
  const filePath = path.join(samplesDir, sample);
  const content = fs.readFileSync(filePath, "utf8");
  const sizeMB = (content.length / 1024 / 1024).toFixed(0);
  const sizeName = sample.replace("bench_", "").replace(".md", "").toUpperCase();

  process.stdout.write(`  ${sizeName.padEnd(6)} (${sizeMB} MB):\n`);

  // JS benchmark
  const jsTimes = benchmarkJS(content, WARMUP, ITERATIONS);
  const jsStats = stats(jsTimes);
  process.stdout.write(`    JS       ${jsStats.median.toFixed(1).padStart(8)} ms  (baseline)\n`);

  // Native benchmark
  const nativeTimes = benchmarkNative(yoBinary, filePath, sizeName, WARMUP, ITERATIONS);
  const nativeStats = stats(nativeTimes);
  const speedup = (jsStats.median / nativeStats.median).toFixed(1);
  process.stdout.write(`    Native   ${nativeStats.median.toFixed(1).padStart(8)} ms  ${speedup}×\n`);

  // WASM benchmark (if available)
  let wasmStats = null;
  let wasmSpeedup = null;
  if (wasmBinary) {
    const wasmTimes = benchmarkWasm(filePath, sizeName, WARMUP, ITERATIONS);
    wasmStats = stats(wasmTimes);
    wasmSpeedup = (jsStats.median / wasmStats.median).toFixed(1);
    process.stdout.write(`    WASM     ${wasmStats.median.toFixed(1).padStart(8)} ms  ${wasmSpeedup}×\n`);
  }

  results.push({ sizeName, sizeMB, jsStats, nativeStats, speedup, wasmStats, wasmSpeedup });
}

// Summary table
console.log(`\n${"─".repeat(72)}`);
console.log("  Summary (median times):");
console.log(`${"─".repeat(72)}`);

if (wasmBinary) {
  console.log(
    "  " +
    "Size".padEnd(8) +
    "markdown-it".padEnd(16) +
    "Native".padEnd(16) +
    "WASM".padEnd(16) +
    "Native×  WASM×"
  );
  console.log(`  ${"─".repeat(64)}`);

  for (const r of results) {
    console.log(
      "  " +
      r.sizeName.padEnd(8) +
      `${r.jsStats.median.toFixed(1)} ms`.padEnd(16) +
      `${r.nativeStats.median.toFixed(1)} ms`.padEnd(16) +
      `${r.wasmStats ? r.wasmStats.median.toFixed(1) + " ms" : "n/a"}`.padEnd(16) +
      `${r.speedup}×`.padEnd(9) +
      `${r.wasmSpeedup || "n/a"}×`
    );
  }
} else {
  console.log(
    "  " +
    "Size".padEnd(8) +
    "markdown-it (JS)".padEnd(20) +
    "markdown_it_yo".padEnd(20) +
    "Speedup"
  );
  console.log(`  ${"─".repeat(56)}`);

  for (const r of results) {
    console.log(
      "  " +
      r.sizeName.padEnd(8) +
      `${r.jsStats.median.toFixed(1)} ms`.padEnd(20) +
      `${r.nativeStats.median.toFixed(1)} ms`.padEnd(20) +
      `${r.speedup}×`
    );
  }
}

console.log(`${"═".repeat(72)}\n`);
