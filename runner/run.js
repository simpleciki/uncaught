#!/usr/bin/env node
/**
 * runner/run.js
 *
 * Usage:
 *   node runner/run.js --subject <name>
 *                      --set <mutants|mutants-heldout>
 *                      --tests <original|original+added|added-only>
 *                      --out <file>
 *
 * --subject defaults to "quick-lru". Subject metadata is loaded from
 * runner/subjects.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { validateSet, applyMutant } from './validate.js';

// ─── CLI parsing ─────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.set || !args.tests || !args.out) {
  console.error('Usage: node runner/run.js [--subject <name>] --set <mutants|mutants-heldout> --tests <original|original+added|added-only> --out <file>');
  process.exit(1);
}

// ─── Subject resolution ───────────────────────────────────────────────────────
const ROOT = path.resolve('.');
const SUBJECTS_FILE = path.join(ROOT, 'runner', 'subjects.json');

let subjects;
try {
  subjects = JSON.parse(fs.readFileSync(SUBJECTS_FILE, 'utf8'));
} catch (err) {
  console.error(`[run] Cannot read runner/subjects.json: ${err.message}`);
  process.exit(1);
}

const subjectName = args.subject ?? 'quick-lru';

if (!subjects[subjectName]) {
  console.error(`[run] Unknown subject "${subjectName}". Known subjects: ${Object.keys(subjects).join(', ')}`);
  process.exit(1);
}

const subjectMeta = subjects[subjectName];
const SUBJECT_DIR = path.join(ROOT, subjectMeta.dir);
const SUBJECT_FILE = path.join(SUBJECT_DIR, subjectMeta.source);

// ─── Paths ───────────────────────────────────────────────────────────────────
const SET_DIR = path.join(ROOT, args.set);
const TESTS_ADDED_DIR = path.join(ROOT, 'tests-added', subjectName);
const WORK_DIR = path.join(ROOT, '.work');
const OUT_FILE = path.resolve(args.out);

// Run ava via its CLI entry point directly with the current Node.js binary.
// This avoids npx entirely (no shell, no DEP0190 on Windows).
const NODE = process.execPath;
const AVA_BIN = path.join(ROOT, 'node_modules', 'ava', 'entrypoints', 'cli.mjs');

// ─── Helpers ─────────────────────────────────────────────────────────────────
function checksum(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function rmDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

/**
 * Run `npx ava <testFiles>` in the given cwd with a 60-second timeout.
 * Returns { exitCode, stdout, stderr, timedOut }
 */
function runAva(cwd, testFiles) {
  const testArgs = [AVA_BIN, ...testFiles, '--tap'];

  return new Promise(resolve => {
    const proc = spawn(NODE, testArgs, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
    }, 60_000);

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', code => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, stdout, stderr, timedOut });
    });
  });
}

/**
 * Parse failing test titles from ava TAP output or stderr.
 */
function parseFailingTests(stdout, stderr) {
  const titles = [];
  // TAP: "not ok N - <title>"
  const tapRe = /^not ok \d+ - (.+)$/gm;
  let m;
  while ((m = tapRe.exec(stdout)) !== null) {
    titles.push(m[1].trim());
  }
  if (titles.length === 0) {
    // fallback: ava's "✘ <title>" lines in stderr
    const avaRe = /[✘✗]\s+(.+)/g;
    while ((m = avaRe.exec(stderr)) !== null) {
      titles.push(m[1].trim());
    }
  }
  return titles;
}

/**
 * Determine which test files to run for a given working copy directory,
 * based on --tests mode. Returns array of filenames (relative to workDir).
 * Also applies any needed file operations to the workDir.
 */
function prepareTestFiles(workDir, addedFiles) {
  const originalTest = subjectMeta.testFile;

  if (args.tests === 'added-only') {
    if (addedFiles.length === 0) {
      throw new Error('--tests added-only requires at least one file in tests-added/<subject>/');
    }
    fs.rmSync(path.join(workDir, originalTest), { force: true });
    for (const f of addedFiles) {
      fs.copyFileSync(f, path.join(workDir, path.basename(f)));
    }
    return addedFiles.map(f => path.basename(f));
  }

  if (args.tests === 'original+added' && addedFiles.length > 0) {
    for (const f of addedFiles) {
      fs.copyFileSync(f, path.join(workDir, path.basename(f)));
    }
    return [originalTest, ...addedFiles.map(f => path.basename(f))];
  }

  // 'original' or 'original+added' with empty tests-added/<subject>/
  return [originalTest];
}

/**
 * Determine which extra test files to copy (from tests-added/<subject>/).
 */
function getAddedTestFiles() {
  if (!fs.existsSync(TESTS_ADDED_DIR)) return [];
  return fs.readdirSync(TESTS_ADDED_DIR)
    .filter(f => f.endsWith('.js') || f.endsWith('.ts'))
    .map(f => path.join(TESTS_ADDED_DIR, f));
}

// ─── Main ────────────────────────────────────────────────────────────────────
(async () => {
  const startTime = Date.now();

  console.log(`[run] Subject: ${subjectName} (${SUBJECT_DIR})`);

  // 1. Validate mutant set
  console.log(`[run] Validating ${args.set}…`);
  let valid, skipped;
  try {
    ({ valid, skipped } = validateSet(SET_DIR, SUBJECT_FILE, subjectName));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  console.log(`[run] ${valid.length} valid, ${skipped.length} skipped.`);
  if (skipped.length > 0) {
    console.log('[run] Skipped:', skipped.map(m => m.id).join(', '));
  }

  // 2. Record subject checksum at startup
  const subjectChecksumBefore = checksum(SUBJECT_FILE);

  // 3. Determine added test files
  const addedFiles = getAddedTestFiles();

  // 4 + 5. Baseline gate + flaky detection — run 3 copies in parallel.
  //
  // A test is "flaky" if it fails in any baseline run (the unmutated subject
  // must not have real failures, so every failure under load is timing noise).
  // The gate aborts only if a non-flaky test fails (i.e. a test that passes in
  // every single baseline run yet fails on the mutant — impossible here, so
  // effectively: gate passes iff no test is "stable-failing" across ALL 3 runs).
  //
  // Simpler stated: collect all failures from all 3 runs → flakySet.
  // If any run timed out, that's a real error → abort.
  // Gate passes unconditionally otherwise (flaky failures are expected noise).
  console.log('[run] Running baseline gate + flaky detection (3 parallel runs)…');
  ensureDir(WORK_DIR);

  async function makeBaselineCopy(suffix) {
    const dir = path.join(WORK_DIR, `baseline-${suffix}`);
    rmDir(dir);
    fs.cpSync(SUBJECT_DIR, dir, { recursive: true });
    return dir;
  }

  async function runOneBaseline(index) {
    const dir = await makeBaselineCopy(String(index));
    try {
      const testFiles = prepareTestFiles(dir, addedFiles);
      const result = await runAva(dir, testFiles);
      return result;
    } finally {
      rmDir(dir);
    }
  }

  const baselineResults = await Promise.all([0, 1, 2].map(i => runOneBaseline(i)));

  // Guard 1: any timeout → broken environment, abort
  for (const r of baselineResults) {
    if (r.timedOut) {
      console.error('[run] Baseline gate FAILED: a baseline run timed out. Aborting.');
      process.exit(1);
    }
  }

  // Count test total from the first run's TAP header
  const tapTotalMatch = baselineResults[0].stdout.match(/^1\.\.(\d+)/m);
  const baselineTestCount = tapTotalMatch ? parseInt(tapTotalMatch[1], 10) : 115;

  // Guard 2: if any single run has >3 failing tests the environment is broken
  for (const [i, r] of baselineResults.entries()) {
    if (r.exitCode !== 0) {
      const failing = parseFailingTests(r.stdout, r.stderr);
      if (failing.length > 3) {
        console.error(`[run] Baseline gate FAILED: baseline run ${i} had ${failing.length} failing tests (max allowed: 3). Environment is broken.`);
        for (const t of failing) console.error(`  - ${t}`);
        process.exit(1);
      }
    }
  }

  // Guard 4: a failed run must name the tests that failed. A non-zero exit with no
  // readable test name (a crash, a syntax error in a test file) is never "flaky".
  for (const [i, r] of baselineResults.entries()) {
    if (r.exitCode !== 0 && parseFailingTests(r.stdout, r.stderr).length === 0) {
      console.error(`[run] Baseline gate FAILED: baseline run ${i} exited with code ${r.exitCode} but no failing test could be read. Aborting.`);
      process.exit(1);
    }
  }

  // Collect per-run failure sets
  const perRunFailing = baselineResults.map(r =>
    r.exitCode !== 0 ? new Set(parseFailingTests(r.stdout, r.stderr)) : new Set(),
  );

  // flakySet = union of all per-run failures
  const flakySet = new Set();
  for (const s of perRunFailing) {
    for (const t of s) flakySet.add(t);
  }

  // Guard 3: if >3 distinct tests are flaky the environment is unstable
  if (flakySet.size > 3) {
    console.error(`[run] Baseline gate FAILED: ${flakySet.size} distinct flaky tests detected (max allowed: 3). Environment is unstable.`);
    for (const t of [...flakySet].sort()) console.error(`  - ${t}`);
    process.exit(1);
  }

  // alwaysFailingInBaseline = tests that failed in ALL 3 parallel runs
  const alwaysFailingSet = new Set(
    [...perRunFailing[0]].filter(t => perRunFailing[1].has(t) && perRunFailing[2].has(t)),
  );

  // Guard 5: a test that failed in all 3 parallel runs is either broken on the untouched
  // library or timing-sensitive. Re-run the untouched library alone, up to 3 times. A test
  // that passes even once on the original code is flaky; one that fails every time means the
  // original suite is not green, so no score would mean anything: abort.
  if (alwaysFailingSet.size > 0) {
    console.log(`[run] ${alwaysFailingSet.size} test(s) failed in all 3 parallel baseline runs; re-running the untouched library alone…`);
    let stillFailing = new Set(alwaysFailingSet);
    for (let attempt = 1; attempt <= 3 && stillFailing.size > 0; attempt++) {
      const solo = await runOneBaseline(`solo-${attempt}`);
      if (solo.timedOut) {
        console.error('[run] Baseline gate FAILED: a solo baseline run timed out. Aborting.');
        process.exit(1);
      }
      const soloFailing = new Set(solo.exitCode !== 0 ? parseFailingTests(solo.stdout, solo.stderr) : []);
      if (solo.exitCode !== 0 && soloFailing.size === 0) {
        console.error(`[run] Baseline gate FAILED: a solo baseline run exited with code ${solo.exitCode} but no failing test could be read. Aborting.`);
        process.exit(1);
      }
      stillFailing = new Set([...stillFailing].filter(t => soloFailing.has(t)));
    }
    if (stillFailing.size > 0) {
      console.error('[run] Baseline gate FAILED: these tests fail every time on the untouched library, so the suite is not green. Aborting.');
      for (const t of [...stillFailing].sort()) console.error(`  - ${t}`);
      process.exit(1);
    }
    console.log('[run] Each of them passed at least once on the untouched library: treated as flaky.');
  }

  console.log('[run] Baseline gate passed.');

  const flakyTests = [...flakySet].sort();
  const alwaysFailingInBaseline = [...alwaysFailingSet].sort();

  if (flakyTests.length > 0) {
    console.log(`[run] Flaky tests detected (${flakyTests.length}):`);
    for (const t of flakyTests) console.log(`  - ${t}`);
  } else {
    console.log('[run] No flaky tests detected.');
  }


  // 6. Run mutants (up to 4 in parallel)
  const CONCURRENCY = 4;
  const results = [];

  async function runMutant(mutant) {
    const workDir = path.join(WORK_DIR, mutant.id);
    rmDir(workDir);
    ensureDir(workDir);

    try {
      // Clone subject
      fs.cpSync(SUBJECT_DIR, workDir, { recursive: true });

      // Verify subject unchanged
      const currentChecksum = checksum(SUBJECT_FILE);
      if (currentChecksum !== subjectChecksumBefore) {
        throw new Error('Subject file was modified during run!');
      }

      // Apply mutant edit to the subject's source file (e.g. index.js)
      const sourcePath = path.join(workDir, subjectMeta.source);
      const original = fs.readFileSync(sourcePath, 'utf8');
      const mutated = applyMutant(original, mutant.find, mutant.replace);

      if (mutated === original) {
        return {
          id: mutant.id,
          kind: mutant.kind,
          status: 'invalid',
          reason: 'string-not-found',
          failingTests: [],
        };
      }

      fs.writeFileSync(sourcePath, mutated, 'utf8');

      // Prepare test files (copies added tests, handles added-only mode)
      const testFiles = prepareTestFiles(workDir, addedFiles);

      // Run ava
      const result = await runAva(workDir, testFiles);

      if (result.timedOut) {
        return { id: mutant.id, kind: mutant.kind, status: 'invalid', reason: 'timeout', failingTests: [] };
      }

      if (result.exitCode === 0) {
        return { id: mutant.id, kind: mutant.kind, status: 'survived', failingTests: [] };
      }

      // Non-zero exit — check for assertion failures
      const failingTests = parseFailingTests(result.stdout, result.stderr);
      if (failingTests.length === 0) {
        // No assertion failures — crash/syntax error
        return { id: mutant.id, kind: mutant.kind, status: 'invalid', reason: 'crash', failingTests: [] };
      }

      // Filter out flaky tests
      const nonFlakyFailures = failingTests.filter(t => !flakySet.has(t));

      if (nonFlakyFailures.length === 0) {
        // Only flaky tests failed — treat as survived
        return {
          id: mutant.id,
          kind: mutant.kind,
          status: 'survived',
          onlyFlakyFailures: true,
          failingTests,      // preserve the raw list for traceability
          nonFlakyFailures: [],
        };
      }

      return {
        id: mutant.id,
        kind: mutant.kind,
        status: 'caught',
        failingTests: nonFlakyFailures,
      };

    } finally {
      rmDir(workDir);
    }
  }

  // Process in batches of CONCURRENCY
  for (let i = 0; i < valid.length; i += CONCURRENCY) {
    const batch = valid.slice(i, i + CONCURRENCY);
    console.log(`[run] Running batch: ${batch.map(m => m.id).join(', ')}`);
    const batchResults = await Promise.all(batch.map(runMutant));
    for (const r of batchResults) {
      const tag = r.onlyFlakyFailures ? ' (only-flaky)' : '';
      console.log(`  ${r.id}: ${r.status}${r.reason ? ` (${r.reason})` : ''}${tag}${r.failingTests?.length ? ` [${r.failingTests.length} failing]` : ''}`);
      results.push(r);
    }
  }

  // Add skipped entries
  for (const m of skipped) {
    results.push({ id: m.id, kind: m.kind, status: 'skipped', failingTests: [] });
  }

  // Sort by id
  results.sort((a, b) => a.id.localeCompare(b.id));

  // 7. Verify subject unchanged after all mutants
  const subjectChecksumAfter = checksum(SUBJECT_FILE);
  const checksumMatch = subjectChecksumBefore === subjectChecksumAfter;

  const runtimeMs = Date.now() - startTime;

  // 8. Write results
  const output = {
    date: new Date().toISOString(),
    subject: subjectName,
    subjectCommit: subjectMeta.commit,
    testsUsed: args.tests,
    testCount: baselineTestCount,
    runtimeMs,
    subjectChecksumBefore,
    subjectChecksumAfter,
    checksumMatch,
    flakyTests,
    alwaysFailingInBaseline,
    mutants: results,
  };

  ensureDir(path.dirname(OUT_FILE));
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n[run] Done. Results written to ${OUT_FILE}`);
  console.log(`[run] Runtime: ${runtimeMs}ms`);
  console.log(`[run] Checksum match: ${checksumMatch}`);
  console.log(`[run] Flaky tests: ${flakyTests.length}`);

  if (!checksumMatch) {
    console.error(`[run] ERROR: subject checksum mismatch — ${SUBJECT_FILE} was modified!`);
    process.exit(1);
  }

  // Completed run — exit 0
  process.exit(0);
})();
