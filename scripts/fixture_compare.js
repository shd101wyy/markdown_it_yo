#!/usr/bin/env node
// Compare markdown_it_yo CLI output against markdown-it JS for fixture files.
// Usage: node scripts/fixture_compare.js <fixture_file> [--verbose]
//
// Fixture format (markdown-it style):
//   Title:
//   .
//   markdown input
//   .
//   expected html
//   .

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const enableHtml = process.argv.includes('--html');
const enableTypographer = process.argv.includes('--typographer');
const noLangPrefix = process.argv.includes('--no-lang-prefix');

const mdOpts = {};
if (enableHtml) mdOpts.html = true;
if (enableTypographer) mdOpts.typographer = true;
if (noLangPrefix) mdOpts.langPrefix = '';
const md = require('markdown-it')(mdOpts);

const fixtureFile = process.argv.find(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]);
const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

if (!fixtureFile) {
  console.error('Usage: node scripts/fixture_compare.js <fixture_file> [-v] [--html] [--typographer] [--no-lang-prefix]');
  process.exit(1);
}

const yoBin = path.join(__dirname, '..', 'markdown_it');
const yoFlags = [];
if (enableHtml) yoFlags.push('--html');
if (enableTypographer) yoFlags.push('--typographer');
if (noLangPrefix) yoFlags.push('--no-lang-prefix');

function parseFixtures(content) {
  const fixtures = [];
  const lines = content.split('\n');
  let i = 0;
  
  while (i < lines.length) {
    // Skip empty lines
    if (lines[i].trim() === '') { i++; continue; }
    
    // Look for title (non-empty line followed by '.')
    let title = '';
    while (i < lines.length && lines[i].trim() !== '.') {
      title += (title ? ' ' : '') + lines[i].trim();
      i++;
    }
    if (i >= lines.length) break;
    i++; // skip '.'
    
    // Read markdown input until '.'
    const inputLines = [];
    while (i < lines.length && lines[i] !== '.') {
      inputLines.push(lines[i]);
      i++;
    }
    if (i >= lines.length) break;
    i++; // skip '.'
    
    // Read expected HTML until '.'
    const expectedLines = [];
    while (i < lines.length && lines[i] !== '.') {
      expectedLines.push(lines[i]);
      i++;
    }
    if (i >= lines.length) break;
    i++; // skip '.'
    
    fixtures.push({
      title,
      input: inputLines.join('\n') + '\n',
      expected: expectedLines.join('\n') + '\n',
    });
  }
  
  return fixtures;
}

const content = fs.readFileSync(fixtureFile, 'utf8');
const fixtures = parseFixtures(content);

let passed = 0, failed = 0, jsMatchFailed = 0;

for (const fix of fixtures) {
  // Get JS markdown-it output
  const jsOutput = md.render(fix.input);
  
  // Get Yo output
  let yoOutput;
  try {
    yoOutput = execSync([yoBin, ...yoFlags].join(' '), { input: fix.input, encoding: 'utf8', timeout: 5000, shell: true });
  } catch (e) {
    yoOutput = `[ERROR: ${e.message}]`;
  }
  
  const jsMatch = jsOutput === fix.expected;
  const yoMatch = yoOutput === fix.expected;
  const yoMatchesJs = yoOutput === jsOutput;
  
  if (!jsMatch) {
    // The fixture expected doesn't match JS — skip (fixture may use different options)
    jsMatchFailed++;
    if (verbose) {
      console.log(`⊘ SKIP: ${fix.title} (JS doesn't match fixture expected)`);
    }
    continue;
  }
  
  if (yoMatch) {
    passed++;
    if (verbose) {
      console.log(`✓ PASS: ${fix.title}`);
    }
  } else {
    failed++;
    console.log(`✗ FAIL: ${fix.title}`);
    if (verbose || failed <= 10) {
      console.log(`  Expected:\n${fix.expected.split('\n').map(l => '    ' + l).join('\n')}`);
      console.log(`  Got:\n${yoOutput.split('\n').map(l => '    ' + l).join('\n')}`);
    }
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed, ${jsMatchFailed} skipped (JS mismatch) out of ${fixtures.length} total ===`);
process.exit(failed > 0 ? 1 : 0);
