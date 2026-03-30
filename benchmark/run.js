#!/usr/bin/env node
// Benchmark: markdown-it (JS) vs markdown-it-yo (native)
//
// Runs both implementations on the same markdown input multiple times
// and reports average throughput.

const { execSync, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ITERATIONS = 50;
const WARMUP = 5;

// ---------------------------------------------------------------------------
// 1. Build sample markdown from fixture files
// ---------------------------------------------------------------------------

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
    // Extract markdown blocks (between first and second `.` lines)
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
      if (inMarkdown) {
        chunks.push(line);
      }
    }
  }
  return chunks.join("\n");
}

// ---------------------------------------------------------------------------
// 2. Benchmark helpers
// ---------------------------------------------------------------------------

function benchmarkJS(markdown, iterations) {
  const md = require("markdown-it")({ html: true, typographer: true });

  // Warmup
  for (let i = 0; i < WARMUP; i++) md.render(markdown);

  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    md.render(markdown);
    times.push(performance.now() - start);
  }
  return times;
}

function benchmarkYo(markdown, iterations, binary) {
  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    try {
      execFileSync(binary, { input: markdown, stdio: ["pipe", "pipe", "pipe"] });
    } catch {
      console.error("ERROR: Yo binary failed. Did you run `yo build`?");
      process.exit(1);
    }
  }

  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    execFileSync(binary, {
      input: markdown,
      stdio: ["pipe", "pipe", "pipe"],
    });
    times.push(performance.now() - start);
  }
  return times;
}

// ---------------------------------------------------------------------------
// 3. Stats
// ---------------------------------------------------------------------------

function stats(times) {
  times.sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  const avg = sum / times.length;
  const median = times[Math.floor(times.length / 2)];
  const min = times[0];
  const max = times[times.length - 1];
  // stddev
  const variance =
    times.reduce((s, t) => s + (t - avg) ** 2, 0) / times.length;
  const stddev = Math.sqrt(variance);
  return { avg, median, min, max, stddev };
}

function fmt(ms) {
  return ms.toFixed(2) + " ms";
}

// ---------------------------------------------------------------------------
// 4. Main
// ---------------------------------------------------------------------------

function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  markdown-it (JS) vs markdown-it-yo (native) benchmark");
  console.log("═══════════════════════════════════════════════════════\n");

  // Resolve Yo binary — search yo-out/<target>/bin/
  const yoOutDir = path.join(__dirname, "..", "yo-out");
  let yoBinary = null;
  if (fs.existsSync(yoOutDir)) {
    for (const target of fs.readdirSync(yoOutDir)) {
      const candidate = path.join(yoOutDir, target, "bin", "markdown-it-yo");
      if (fs.existsSync(candidate)) {
        yoBinary = candidate;
        break;
      }
    }
  }
  if (!yoBinary) {
    console.error(
      `ERROR: Binary not found in yo-out/*/bin/markdown-it-yo\nRun \`yo build\` first.`
    );
    process.exit(1);
  }

  // Generate input
  const markdown = extractMarkdownFromFixtures();
  const inputKB = (Buffer.byteLength(markdown, "utf-8") / 1024).toFixed(1);
  console.log(`Input size: ${inputKB} KB`);
  console.log(`Iterations: ${ITERATIONS}  (warmup: ${WARMUP})\n`);

  // Benchmark JS
  process.stdout.write("Running markdown-it (JS)...");
  const jsTimes = benchmarkJS(markdown, ITERATIONS);
  const jsStats = stats(jsTimes);
  console.log(" done");

  // Benchmark Yo (native)
  process.stdout.write("Running markdown-it-yo (native)...");
  const yoTimes = benchmarkYo(markdown, ITERATIONS, yoBinary);
  const yoStats = stats(yoTimes);
  console.log(" done\n");

  // Report
  const speedup = jsStats.avg / yoStats.avg;

  console.log("Results");
  console.log("─────────────────────────────────────────────────────");
  console.log(
    `  markdown-it (JS):     avg ${fmt(jsStats.avg)}  median ${fmt(jsStats.median)}  min ${fmt(jsStats.min)}  max ${fmt(jsStats.max)}  stddev ${fmt(jsStats.stddev)}`
  );
  console.log(
    `  markdown-it-yo:       avg ${fmt(yoStats.avg)}  median ${fmt(yoStats.median)}  min ${fmt(yoStats.min)}  max ${fmt(yoStats.max)}  stddev ${fmt(yoStats.stddev)}`
  );
  console.log("─────────────────────────────────────────────────────");

  if (speedup >= 1) {
    console.log(
      `  Yo is ${speedup.toFixed(2)}x faster than JS (avg)\n`
    );
  } else {
    console.log(
      `  JS is ${(1 / speedup).toFixed(2)}x faster than Yo (avg)\n`
    );
  }

  // Throughput
  const inputMB = Buffer.byteLength(markdown, "utf-8") / (1024 * 1024);
  const jsMBs = (inputMB / (jsStats.avg / 1000)).toFixed(2);
  const yoMBs = (inputMB / (yoStats.avg / 1000)).toFixed(2);
  console.log(`  Throughput (JS):  ${jsMBs} MB/s`);
  console.log(`  Throughput (Yo):  ${yoMBs} MB/s`);
}

main();
