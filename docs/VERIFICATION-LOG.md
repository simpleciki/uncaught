# Verification log

Every output IBM Bob produces is checked by an independent script before it is committed. The check reads files from disk and does not rely on Bob's summary. This log records what those checks found.

| # | Date (CDT) | Bob task | What Bob reported | What the independent check found | Resolution |
|---|---|---|---|---|---|
| 1 | 2026-09-25 | Task 01, Plan mode | A plan with 10 failure patterns and exact line references | All 10 line references match `subject/quick-lru/index.js`. Review found 5 design gaps: no baseline gate, test dependencies unresolvable from a system temp folder, 3 operator flips not labelled as such, a "check Bob's tests" step that re-used the same mutants (it could only pass), and a `file://` site that browsers block | Bob rewrote the plan with all 5 corrections (`docs/PLAN.md`) |
| 2 | 2026-09-25 | Task 02, custom modes | Saboteur and Guardian modes created | The Saboteur write rule did not include `patterns/`, so the mode could not write the catalog it was built to write | Bob fixed the rule |
| 3 | 2026-09-25 | Task 03, Saboteur mode | "10 + 10 + 10. All files written", with a clean summary table | **7 of 20 mutant files were not valid JSON.** Multi-line `find` strings contained raw tab and newline characters. The runner would have crashed on the first of them | Bob escaped the 7 files. Re-check: 19 valid, 1 honestly skipped, 0 invalid. Every `find` matches the source exactly once, and no mutant shares a `find` with another |
| 4 | 2026-09-25 | Task 03, Agent mode | Runner reported FP-03, FP-04, FP-05, FP-09, FP-10 as "caught" | **False catches caused by a timing-sensitive test.** Running the unmutated subject 4 times in parallel showed "expiresIn() returns remaining ms for expiring item" fails 3/4 times under CPU load; it asserts an exact millisecond value. FP-05 was confirmed by hand to survive when run alone. The runner also exited with code 1, which Bob explained away instead of fixing | Runner rewritten: baseline is run 3 times in parallel to collect `flakyTests`; a mutant is `caught` only if its failing tests minus `flakyTests` are non-empty; otherwise status is `survived` with `onlyFlakyFailures: true`. Windows `shell: true` (DEP0190) replaced with `npx.cmd` direct invocation to eliminate the spurious non-zero exit |

The check script is the same one the runner uses before any mutation run.
