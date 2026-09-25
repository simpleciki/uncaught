/**
 * runner/validate.js
 * Validates all mutant JSON files in the chosen set before a run.
 */
import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_FIELDS = [
  'id', 'kind', 'pattern', 'description', 'file',
  'find', 'replace', 'targetLine', 'targetFunction',
  'productionImpact', 'detectedBy',
];

/**
 * @param {string} setDir  - path to mutants/ or mutants-heldout/
 * @param {string} subjectFile - absolute path to subject/quick-lru/index.js
 * @returns {{ valid: object[], skipped: object[] }}  throws on any error
 */
export function validateSet(setDir, subjectFile) {
  const files = fs.readdirSync(setDir)
    .filter(f => f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    throw new Error(`No JSON files found in ${setDir}`);
  }

  const subjectContent = fs.readFileSync(subjectFile, 'utf8');

  // Pre-compute mutated sources from mutants/ (the canonical baseline set),
  // unless we ARE running mutants/ itself (avoid double-loading).
  const ROOT = path.resolve('.');
  const BASELINE_DIR = path.join(ROOT, 'mutants');
  const mutatedSources = new Map(); // mutated-source → id  (for duplicate detection)

  if (path.resolve(setDir) !== BASELINE_DIR && fs.existsSync(BASELINE_DIR)) {
    for (const f of fs.readdirSync(BASELINE_DIR).filter(f => f.endsWith('.json'))) {
      let m;
      try {
        m = JSON.parse(fs.readFileSync(path.join(BASELINE_DIR, f), 'utf8'));
      } catch { continue; }
      if (m.skip === true || typeof m.find !== 'string' || typeof m.replace !== 'string') continue;
      const mutated = subjectContent.replace(m.find, m.replace);
      if (mutated !== subjectContent) {
        mutatedSources.set(mutated, m.id);
      }
    }
  }

  const valid = [];
  const skipped = [];

  for (const file of files) {
    const filePath = path.join(setDir, file);

    // 1. Must parse
    let mutant;
    try {
      mutant = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      throw new Error(`[validate] ${file}: JSON parse error — ${err.message}`);
    }

    // 2. Skip flag
    if (mutant.skip === true) {
      skipped.push(mutant);
      continue;
    }

    // 3. Required fields
    for (const field of REQUIRED_FIELDS) {
      if (!(field in mutant)) {
        throw new Error(`[validate] ${file}: missing required field "${field}"`);
      }
    }

    // 4. "find" must occur exactly once in subject file
    const occurrences = subjectContent.split(mutant.find).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `[validate] ${file} (${mutant.id}): "find" string occurs ${occurrences} times in index.js (expected exactly 1)`,
      );
    }

    // 5. No two mutants produce the same mutated source (within the set or
    //    against mutants/).  Two mutants with the same "find" but different
    //    "replace" are fine; two mutants whose apply produces identical source
    //    are duplicates regardless of how "find"/"replace" are written.
    const mutatedSource = subjectContent.replace(mutant.find, mutant.replace);
    if (mutatedSources.has(mutatedSource)) {
      throw new Error(
        `[validate] ${file} (${mutant.id}): produces the same mutated source as ${mutatedSources.get(mutatedSource)}`,
      );
    }
    mutatedSources.set(mutatedSource, mutant.id);

    valid.push(mutant);
  }

  return { valid, skipped };
}
