# IBM Bob Usage Statement

IBM Bob built uncaught. Bob wrote the mutation runner, the scout, every planted bug and every added test. Claude (Anthropic) wrote the design brief, reviewed each Bob task, re-ran every result independently, and built the demo page. After two cold reviews, Claude made two fixes to the runner (verification log, entries 10 and 11). Bob drafted this statement (task 13); review corrected it (entry 9).

## Features used

**Plan mode** (task 01). Bob proposed 10 failure patterns in `quick-lru` with exact line references (`docs/PLAN.md`). Review found 5 design gaps; Bob rewrote the plan.

**Agent mode** (tasks 04, 08, 10). Bob wrote the runner (baseline gate, flaky-test detection, any library) and the scout that ranks functions by how thinly they are tested.

**Two custom modes.** Saboteur can only write bug files and its pattern catalog; Guardian can only write tests. Saboteur (tasks 03, 07, 09, 11) planted 32 bugs in five rounds, plus one honest skip. Guardian (tasks 05, 06, 12) wrote 27 tests in 5 files.

**A custom skill.** `realistic-mutant` tells Bob how to plant one honest bug: real location, minimal edit, honest `semantic` or `classic-operator` label, production impact.

**Parallel subagents** (task 13). Two subagents drafted the upstream pull requests while the parent task wrote this statement.

All 13 tasks ran on the hackathon account and used 39.54 of 40 Bobcoins. Screenshots are in `bob_sessions/`.

## What Bob got wrong, and how review caught it

- **Invalid JSON behind a clean summary.** Bob reported all mutant files written; 7 of 20 were not valid JSON. Bob escaped them.
- **False catches.** One original test fails under CPU load, and the runner scored that as catches. It now runs the baseline 3 times first.
- **A test that could never fail.** `size()` caps its answer at `maxSize`, which hid the double count. Bob first swapped in an easier test and removed the only `size()` test; asked again, it found a real state where the bug shows.
- **Facts in drafts.** The subagents miscounted tests and described a scenario the test does not cover.
- **A syntax error scored as a catch.** A cold review found the runner expanded `$&` in one bug's text and broke the file; every test failed, which counted as caught. Edits are now inserted literally; edits that do not parse are rejected.
- **A gate that passed a red suite.** A second review found the baseline gate could pass a library whose own tests failed. That now stops the run.

The human was wrong twice too (entries 7 and 8).

## What Bob found

Across two libraries with 75 million weekly npm downloads, 4 planted bugs got past a green suite. All 4 are now caught by tests Bob wrote. For the `dot-prop` bug, which can collapse two keys into one path, Bob's test uses an oversized index; the `'1abc'` input is not covered yet.
