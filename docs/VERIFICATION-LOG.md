# Verification log

Every output IBM Bob produces is checked by an independent script before it is committed. The check reads files from disk and does not rely on Bob's summary. This log records what those checks found.

| # | Date (CDT) | Bob task | What Bob reported | What the independent check found | Resolution |
|---|---|---|---|---|---|
| 1 | 2026-09-25 | Task 01, Plan mode | A plan with 10 failure patterns and exact line references | All 10 line references match `subject/quick-lru/index.js`. Review found 5 design gaps: no baseline gate, test dependencies unresolvable from a system temp folder, 3 operator flips not labelled as such, a "check Bob's tests" step that re-used the same mutants (it could only pass), and a `file://` site that browsers block | Bob rewrote the plan with all 5 corrections (`docs/PLAN.md`) |
| 2 | 2026-09-25 | Task 02, custom modes | Saboteur and Guardian modes created | The Saboteur write rule did not include `patterns/`, so the mode could not write the catalog it was built to write | Bob fixed the rule |
| 3 | 2026-09-25 | Task 03, Saboteur mode | "10 + 10 + 10. All files written", with a clean summary table | **7 of 20 mutant files were not valid JSON.** Multi-line `find` strings contained raw tab and newline characters. The runner would have crashed on the first of them | Bob escaped the 7 files. Re-check: 19 valid, 1 honestly skipped, 0 invalid. Every `find` matches the source exactly once, and no mutant shares a `find` with another |

The check script is the same one the runner uses before any mutation run.
