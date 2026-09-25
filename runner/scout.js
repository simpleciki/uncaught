#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: { subject: { type: 'string' } },
  strict: true,
});

if (!values.subject) {
  console.error('Usage: node runner/scout.js --subject <name>');
  process.exit(1);
}

const subjects = JSON.parse(readFileSync(new URL('./subjects.json', import.meta.url)));
const config = subjects[values.subject];
if (!config) {
  console.error(`Unknown subject: ${values.subject}`);
  process.exit(1);
}

const sourceText = readFileSync(join(config.dir, config.source), 'utf8');
const testText   = readFileSync(join(config.dir, config.testFile), 'utf8');
const testLines  = testText.split('\n');

// Collect exported functions: "export function NAME"
const exportRe = /^export\s+(?:async\s+)?function\s+(\w+)/;
const fns = [];
sourceText.split('\n').forEach((line, idx) => {
  const m = exportRe.exec(line);
  if (m) {
    fns.push({ name: m[1], definedAt: idx + 1 });
  }
});

// Count mentions per function in the test file
for (const fn of fns) {
  const re = new RegExp(`\\b${fn.name}\\b`);
  fn.mentions = testLines.filter(l => re.test(l)).length;
}

// Sort fewest → most mentions
fns.sort((a, b) => a.mentions - b.mentions || a.name.localeCompare(b.name));

// Collect subject commit
let commit = 'unknown';
try {
  commit = execSync(`git log -1 --format=%H -- ${join(config.dir, config.source)}`, { stdio: ['pipe', 'pipe', 'pipe'] })
    .toString().trim();
} catch { /* ignore */ }

const output = {
  subject: values.subject,
  date: new Date().toISOString(),
  commit,
  ranked: fns.map(({ name, mentions, definedAt }) => ({ name, mentions, definedAt })),
};

mkdirSync('results', { recursive: true });
const outPath = `results/${values.subject}-scout.json`;
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
