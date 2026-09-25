# uncaught — build plan

> Read BRIEF.md before every task. This file is the ordered task list and design reference.

---

## 1 — Failure-Pattern Candidates

Ten patterns targeting semantic behaviors a classic operator-flipper would miss,
because they involve structural invariants, dual-cache logic, and time semantics
unique to QuickLRU's design.

| id | kind | one-line name | target in `index.js` | production impact |
|----|------|---------------|----------------------|-------------------|
| **FP-01** | semantic | Stale-promoted-as-fresh | `get()` line 113-115: `#moveToRecent` called even after expiry check returns `false` | An expired item is re-inserted into `#cache` with its old expiry; it gets a free TTL extension and is served as live data until the next rotation |
| **FP-02** | classic-operator | Silent eviction suppression | `#emitEvictions()` line 31: invert the `!== 'function'` guard | Eviction callbacks never fire; downstream cache-invalidation listeners believe items are still live, producing stale reads system-wide |
| **FP-03** | semantic | Size counter desync on update | `set()` lines 125-129: call `#set()` for existing keys (double-counts `#size`) | `#size` overshoots `#maxSize`, triggering early rotation and evicting live items that should have survived |
| **FP-04** | semantic | Old-cache shadow on iteration | `[Symbol.iterator]()` line 246: drop `!this.#cache.has(key)` guard | Keys in both caches are yielded twice; consumers counting entries or building derived maps get duplicates |
| **FP-05** | classic-operator | Expiry boundary off-by-one | `#deleteIfExpired()` line 41: `<=` → `<` | Items at the exact expiry millisecond are served instead of expired; zero-duration TTL items are never cleaned up |
| **FP-06** | semantic | resize() drops newest instead of oldest | `resize()` line 197: take `items.slice(0, newSize)` instead of `items.slice(removeCount)` | When shrinking, most-recently-used items are evicted; the LRU guarantee is inverted |
| **FP-07** | classic-operator | evict() protects last item incorrectly | `evict()` line 212: `items.length - 1` → `items.length` | All items including the last become evictable; "evict all but one" clears the cache entirely |
| **FP-08** | semantic | expiresIn() wrong cache wins | `expiresIn()` line 160: check `#oldCache` before `#cache` | Stale expiry from `#oldCache` returned for mid-migration keys; callers schedule re-fetches on a wrong deadline |
| **FP-09** | semantic | delete() size underflow | `delete()` line 168-170: remove `if (deleted)` guard, always decrement `#size` | Deleting an `#oldCache`-only key drives `#size` below zero; next rotation is one insertion late |
| **FP-10** | semantic | Ascending iterator yields duplicates | `#entriesAscending()` line 88: drop `!this.#cache.has(key)` guard | `resize()`, `evict()`, and `entriesAscending()` build arrays from the inflated stream; `removeCount` arithmetic evicts the wrong number of items |

---

## 2 — Mutant File JSON Shape

```json
{
  "id": "FP-05",
  "kind": "classic-operator",
  "pattern": "expiry-boundary-off-by-one",
  "description": "Item at exact expiry millisecond is served instead of expired",
  "file": "subject/quick-lru/index.js",
  "find": "item.expiry <= Date.now()",
  "replace": "item.expiry < Date.now()",
  "targetLine": 41,
  "targetFunction": "#deleteIfExpired",
  "productionImpact": "Items whose TTL expires at precisely this millisecond remain in the cache and are returned to callers. Clients relying on hard expiry deadlines (e.g. auth tokens, rate-limit windows) receive data they should not receive.",
  "detectedBy": null
}
```

**Field contract:**
- `id` — unique across `mutants/` and `mutants-heldout/`; matches pattern catalog
- `kind` — `"semantic"` or `"classic-operator"`; honest label, not marketing
- `pattern` — slug linking to `patterns/<slug>.md`
- `file` — path relative to repo root; always inside `subject/`
- `find` / `replace` — exact strings; runner does `readFileSync`, `String.replace(find, replace)`, writes to the working copy
- `targetLine` — informational; runner does not use it for the edit
- `targetFunction` — private or public method containing the bug
- `productionImpact` — one to three sentences; becomes the site copy
- `detectedBy` — `null` before the run; runner fills it with `"caught"`, `"survived"`, or `"invalid"`

---

## 3 — Runner Design

### Dependencies

A root `package.json` lists `ava ^5.3.1` as the only `devDependency` (same version
the subject uses). Working copies live in `.work/` inside the repo so ava resolves
from the root `node_modules`. `.work/` is added to both `.gitignore` and `.bobignore`.

### Steps

**Step 1 — Baseline gate.**
Copy `subject/quick-lru/` into `.work/baseline/`. Run:
```
npx ava test.js
```
with `cwd` set to `.work/baseline/`. If the exit code is non-zero, log the error and
abort the entire run. The baseline must pass all 115 tests before any mutant is
attempted. Log the baseline test count and runtime into the results file.

**Step 2 — Clone subject into working copy.**
For each mutant, compute a fresh directory `.work/<mutant-id>/`. Copy
`subject/quick-lru/` into it with `fs.cpSync` (source side only; `subject/` is never
written). Assert that `subject/quick-lru/index.js` is unchanged by comparing its
checksum to the one recorded at process start.

**Step 3 — Apply the mutant edit.**
Read the cloned file, call `content.replace(mutant.find, mutant.replace)`, write back
to the clone. If the string was not found (replacement produced no change), record
`detectedBy: "invalid"` with `reason: "string-not-found"` and skip to Step 5.

**Step 4 — Run ava against the clone.**
Spawn:
```
npx ava test.js
```
with `cwd` set to `.work/<mutant-id>/` and a 60-second timeout. Classify the result:
- Exit code `0` → `"survived"`
- Exit code non-zero with at least one assertion failure in the output → `"caught"`; record the names of all failing tests
- Process timeout → `"invalid"` with `reason: "timeout"`
- Crash or syntax error (no assertion failures, non-zero exit) → `"invalid"` with `reason: "crash"`

`"invalid"` results are recorded separately and never counted as caught.

**Step 5 — Clean up.**
Delete `.work/<mutant-id>/` in a `finally` block after each mutant, whether it passed
or failed.

**Step 6 — Write results.**
After all mutants, write the full result array to `results/<run-name>.json`. Every
results file includes:
```json
{
  "date": "<ISO-8601>",
  "subjectCommit": "a2190eb",
  "testCount": 115,
  "runtimeMs": 0,
  "mutants": [ ... ]
}
```

**Subject safety guarantee:** The only paths where `fs.writeFileSync` or
`fs.cpSync` (destination side) are ever called are under `.work/`. The runner opens
`subject/` only with `fs.readFileSync` and `fs.cpSync` (source). A checksum of
`subject/quick-lru/index.js` is taken at startup and re-verified after every mutant
cycle.

---

## 4 — Held-Out Variant Set

For every pattern in `mutants/`, one **variant** mutant targeting a different code
location that exercises the same failure pattern is stored in `mutants-heldout/`.

The purpose: before Task 4, `mutants-heldout/` is added to `.bobignore`. The tests
in `tests-added/` must be written without seeing the held-out variants. Task 5 then
runs those tests against `mutants-heldout/` to determine whether the new tests
understood the *pattern* or only patched the one line they were shown.

---

## 5 — Ordered Task List

### Task 1 — Failure-pattern catalog
**Done when:** `patterns/` contains one `.md` file per pattern (10 files). Each file
has: id, kind, name, description, target function, production impact. No code yet.

### Task 2 — Mutant files and held-out variants
**Done when:** `mutants/` contains 10 `.json` files and `mutants-heldout/` contains
10 `.json` files (one variant per pattern), all following the schema in Section 2.
`find` strings are copy-pasted verbatim from `index.js` and confirmed to match
exactly once in the file. `mutants-heldout/` is added to `.bobignore`.

### Task 3 — Root `package.json` and runner script
**Done when:** A root `package.json` exists with `ava ^5.3.1` as the only
`devDependency`. `runner/run.js` exists and, when executed with `node runner/run.js`,
runs the baseline gate, applies each mutant in `mutants/` to a `.work/` copy, runs
`npx ava test.js`, writes `results/before.json` (with date, subject commit, test
count, and runtime), and deletes each `.work/<mutant-id>/` copy. `.work/` is in
`.gitignore` and `.bobignore`. The checksum of `subject/quick-lru/index.js` matches
before and after the run.

### Task 4 — `tests-added/` (surviving-mutant tests)
**Done when:** For each mutant that survived in `results/before.json`, a new ava test
exists in `tests-added/` that fails on the mutant and passes on the original. Running
the runner against `mutants/` with `tests-added/` produces `results/after.json` where
every previously-surviving mutant is now caught. Tests were written without access to
`mutants-heldout/`.

### Task 5 — Held-out generalization check
**Done when:** The runner is executed with `tests-added/` against `mutants-heldout/`
and writes `results/heldout.json` (with date, subject commit, test count, runtime).
This file records which new tests caught a variant of the same pattern at a different
code location, revealing whether the tests understood the pattern or only patched one
line.

### Task 6 — Static site (`site/`)
**Done when:** `site/index.html` works when served by any static server (no `file://`
requirement). It reads `results/before.json`, `results/after.json`, and
`results/heldout.json` via `fetch` and renders the five demo steps from the brief in
order: green baseline badge, caught/survived counts, per-survivor details (pattern,
code change, production impact), new-test results, held-out generalization score. No
numbers are hard-coded; every count comes from the JSON files.
