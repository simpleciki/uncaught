---
name: realistic-mutant
description: Use when turning a failure pattern into one mutant JSON file for the uncaught project. Guides picking the right line, keeping the edit minimal, labeling the kind honestly, and writing a production-impact sentence.
---

# realistic-mutant

Follow these steps to produce one well-formed mutant from a failure pattern.

## Step 1 — Pick the line

Open `subject/quick-lru/index.js`.
Find the function or block named in the pattern's `targetFunction` field.
Choose the single line where the pattern would most plausibly occur in a real codebase --
prefer the line that a developer would change during a routine edit rather than an
adversarial one.
Record the 1-based line number as `targetLine`.

## Step 2 — Write find and replace

Copy the exact source text you will change into `find`. Run a case-sensitive substring
search over the whole file and confirm the string appears exactly once. If it appears
more than once, narrow `find` to include enough surrounding context to make it unique.
Write the minimal replacement into `replace`: change the fewest characters needed to
express the bug. Do not reformat, rename variables, or touch anything outside the one
logical change.

## Step 3 — Label kind honestly

Use `"classic-operator"` when the edit changes a comparison operator, arithmetic
operator, logical operator, or boundary constant (`<` to `<=`, `+` to `-`, etc.).
Use `"semantic"` for everything else: missing guards, wrong cache lookups, incorrect
slice offsets, inverted conditions that are not simple operator flips, etc.
Do not use any other value.

## Step 4 — Write productionImpact

Write one or two plain sentences that answer: what goes wrong at runtime, and who
or what is hurt? Name the real downstream consequence (e.g. "callers receive expired
auth tokens", "the cache shrinks to zero when it should hold one item"). Avoid vague
words like "incorrect behavior" or "may cause issues". Be concrete.

## Step 5 — Assemble the JSON

Produce the JSON object with all required fields:

```json
{
  "id": "<pattern-id>",
  "kind": "<semantic|classic-operator>",
  "pattern": "<slug matching patterns/<slug>.md>",
  "description": "<one sentence>",
  "file": "subject/quick-lru/index.js",
  "find": "<exact source text, unique in the file>",
  "replace": "<minimal replacement>",
  "targetLine": 0,
  "targetFunction": "<method name>",
  "productionImpact": "<one to two plain sentences>",
  "detectedBy": null
}
```

Set `detectedBy` to `null`. The runner fills it in.

## Step 6 — Verify before writing

Before calling `write_file`, re-read `subject/quick-lru/index.js` and count how many
times `find` appears. It must appear exactly once. If it does not, revise `find` and
repeat.
Write the file to `mutants/<id>.json` (or `mutants-heldout/<id>-heldout.json` for a
held-out variant). Never write to `subject/`.
