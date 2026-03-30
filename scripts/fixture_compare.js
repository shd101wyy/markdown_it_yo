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

const md = require('markdown-it')();

const fixtureFile = process.argv[2];
const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

if (!fixtureFile) {
  console.error('Usage: node scripts/fixture_compare.js <fixture_file> [-v]');
  process.exit(1);
}

const yoBin = path.join(__dirname, '..', 'markdown_it');

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
    yoOutput = execSync(yoBin, { input: fix.input, encoding: 'utf8', timeout: 5000 });
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
