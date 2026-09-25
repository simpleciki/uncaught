# IBM Bob Usage Statement

IBM Bob built uncaught. Bob wrote the mutation runner, the scout, every planted bug and every added test. Claude (Anthropic) wrote the design brief, reviewed each Bob task, re-ran every result independently, and built the demo page. After a cold review, Claude made one fix to the runner (verification log, entry 10). Bob drafted this statement in task 13; review corrected its facts (entry 9).

## Features used

**Plan mode** (task 01). Bob read `quick-lru`, proposed 10 failure patterns with exact line references, and produced `docs/PLAN.md`. Review found 5 design gaps; Bob rewrote the plan.

**Agent mode** (tasks 04, 08, 10). Bob wrote the runner with its baseline gate and flaky-test detection, generalised it to any subject, and wrote the scout that ranks functions by how thinly the tests cover them.

**Two custom modes.** Saboteur can only write bug files and its pattern catalog; Guardian can only write tests. Saboteur (tasks 03, 07, 09, 11) planted 32 bugs in five rounds, plus one honest skip. Guardian (tasks 05, 06, 12) wrote 27 tests in 5 files.

**A custom skill.** `realistic-mutant` tells Bob how to plant one honest bug: the line where the failure would really happen, a minimal edit, an honest `semantic` or `classic-operator` label, and a plain production-impact sentence.

**Parallel subagents** (task 13). Two subagents drafted the upstream pull requests while the parent task wrote this statement.

All 13 tasks ran on the hackathon account and used 39.54 of 40 Bobcoins. Screenshots are in `bob_sessions/`.

## What Bob got wrong, and how review caught it

- **Invalid JSON behind a clean summary.** Bob reported all mutant files written; 7 of 20 were not valid JSON. Bob escaped them.
- **False catches.** The runner counted bugs as caught because one original test fails under CPU load with no bug at all. The runner now runs the baseline 3 times and ignores flaky failures.
- **A test that could never fail.** `size()` caps its answer at `maxSize`, which hid the double count. Bob first swapped in an easier test and removed the only `size()` test; asked again, it found a real state where the bug shows.
- **Facts in drafts.** The subagents miscounted tests and described a scenario the test does not cover.
- **A syntax error scored as a catch.** A cold review found the runner expanded `$&` in one bug's text and broke the file; every test failed, which counted as caught. Edits are now inserted literally, and edits that do not parse are rejected.

The human side was wrong twice too: a duplicate rule that rejected real bugs, and a count that Bob's scout corrected.

## What Bob found

Across two libraries with 75 million weekly npm downloads, 4 planted bugs got past a green suite. All 4 are now caught by tests Bob wrote. For the `dot-prop` bug, which can collapse two keys into one path, Bob's test uses an oversized index; the `'1abc'` input is not covered yet.
