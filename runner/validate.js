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
  const findStrings = new Map(); // find → id

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

    // 5. No two mutants share a "find"
    if (findStrings.has(mutant.find)) {
      throw new Error(
        `[validate] ${file} (${mutant.id}): "find" string already used by ${findStrings.get(mutant.find)}`,
      );
    }
    findStrings.set(mutant.find, mutant.id);

    valid.push(mutant);
  }

  return { valid, skipped };
}
