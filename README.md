# uncaught

**Your tests are green. Are they guarding anything?**

uncaught plants the kinds of bugs real systems ship, runs your test suite once per bug, and shows which bugs got through. IBM Bob then writes the missing tests. uncaught checks those tests the same way, on bugs they were never shown, and keeps attacking until the suite holds.

Built with IBM Bob for the IBM Bob 2.0 Hackathon (lablab.ai, September 2026).

- **Demo page:** https://uncaught-simplecikis-projects.vercel.app
- **Test results are read from `results/*.json`** and the current ones can be reproduced with the commands in [Reproduce](#reproduce). Download counts, versions and Bobcoins come from `site/subjects.json`.

## The problem

A pull request changes code, CI is green, the reviewer merges. Green means no test failed. It does not mean a test *would* fail if the code were wrong. Checking that by hand means breaking the code on purpose, one bug at a time, and re-running the suite each time, so nobody does it. Blind spots are found in production.

Classic mutation tools automate this with operator flips (`<` to `<=`) and produce hundreds of mutants, many of them noise. uncaught plants bugs **modelled on common production failure modes**: stale data served as fresh, the same key counted twice, two names for one key, a safety check quietly narrowed, an empty result treated as success.

## What it found

Two popular MIT-licensed libraries, pinned to fixed commits. Neither has a bug: the bugs are planted, and the new tests close coverage gaps.

| Library | Weekly npm downloads | Original tests | Result |
|---|---|---|---|
| [quick-lru](https://github.com/sindresorhus/quick-lru) `a2190eb` | 33.7M | 115 | 2 of 10 planted bugs got past the green suite |
| [dot-prop](https://github.com/sindresorhus/dot-prop) `d5d11c7` | 41.4M | 77 | 6 of 6 caught; a scout-guided round then found 1 blind spot |

Downloads: api.npmjs.org, 2026-09-17 to 2026-09-23; the raw responses are in [`data/`](data/).

### The loop, run on quick-lru

| Round | Tests | Caught | File |
|---|---|---|---|
| 1. Realistic bugs | original 115 | 8 / 10 | `results/before.json` |
| 2. Bob writes one test per survivor | 115 + 2 | 10 / 10 | `results/after.json` |
| 3. Bugs Bob never saw (held out) | 115 + 2 | 8 / 9 | `results/heldout.json` |
| 3b. Bob's tests alone on the held-out bugs | 2 | FP-08-H **survives** | `results/heldout-bob-only.json` |
| 4. Bob rewrites the tests for the whole pattern | 115 + 26 | 9 / 9 | `results/heldout-r3.json` |
| 5. Red team: Saboteur reads the new tests and aims at their gaps | 115 + 26 | 4 / 4 | `results/round3.json` |

Round 3b is the point of the project. Bob's first test fixed the line it was shown (`expiresIn()` reading the stale copy of a key). The same mistake in `peek()` got straight past it. The tests an AI writes need the same scrutiny as the tests a human writes, so uncaught checks them on bugs they were never shown.

### On dot-prop

A first round of 6 bugs was fully caught. Bob then built a **scout**: it ranks each public function by how many lines of the test file mention it. It ranked `unflatten` 19, `escapePath` 22 and `deepKeys` 32 mentions, versus 164 for `getProperty`. The next round attacked `escapePath` and two helpers behind `deepKeys`; `unflatten` was not attacked. One bug got through all 77 tests: a looser number check in `normalizeEntries`. On an array with an extra key `'1abc'`, it makes `deepKeys()` return `list[1]` twice instead of `list[1]` and `list.1abc`: two different keys, one path. Run `node docs/examples/dp-r2-3-collision.mjs` to see it. Bob's test now catches the bug (`results/dot-prop-r2-after.json`, 3 / 3) using an oversized index; the `'1abc'` input itself is not covered yet.

### Back to the maintainers

Both repositories limit pull requests to collaborators, so the new tests were offered as issues, each linking a one-commit branch that passes the project's own `npm test` (lint included):

- quick-lru: [sindresorhus/quick-lru#59](https://github.com/sindresorhus/quick-lru/issues/59), 24 tests
- dot-prop: [sindresorhus/dot-prop#130](https://github.com/sindresorhus/dot-prop/issues/130), 1 test

On the upstream code, FP-10-H and DP-R2-3 are caught only by the new tests.

## By hand vs uncaught

We timed the manual way once, on one bug (FP-08 in quick-lru): edit the line, run the suite, check the result, revert, run again.

| | By hand, 1 bug | uncaught, 10 bugs |
|---|---|---|
| Wall-clock time (one run each) | 4 min 38 s | 4.9 s (`results/before.json`, `runtimeMs`, including three baseline runs) |
| Misleading results | The first run after planting the bug said "1 test failed", which looks like a catch. It was a timing-sensitive test; it failed again later on the original code | That test is found in the baseline runs and set aside automatically |
| Judgment needed | Is this failure the bug, or noise? Rerun and compare | None: a bug counts as caught only if a test that is stable on the original code fails |

Most of the manual time went into telling the bug from the noise. These are single observations of different tasks (one bug by hand, ten bugs automated), not a benchmark or a speed-up figure.

## How IBM Bob was used

Bob is the engine: it wrote the runner, the scout, every planted bug and every added test. See [`docs/BOB-USAGE.md`](docs/BOB-USAGE.md) for the full statement and [`bob_sessions/`](bob_sessions/) for the 13 task summaries.

| Bob feature | Where |
|---|---|
| Plan mode | Task 01: the first plan, reviewed before any code (`docs/PLAN.md`) |
| Agent mode | Runner with baseline gate and flaky-test detection; `--subject` for any library; the scout |
| Custom mode **Saboteur** | Can only write bug files and its pattern catalog. Planted 32 bugs across both libraries (plus one honest skip) |
| Custom mode **Guardian** | Can only write tests. Wrote 27 tests in 5 files, with a frozen clock instead of real time |
| Custom skill **realistic-mutant** | How to plant one honest bug: real location, minimal edit, honest label, production impact |
| Parallel **subagents** | Drafted the two upstream pull request descriptions while the parent task wrote the usage statement |

39.54 of 40 Bobcoins used, all on the hackathon account.

### Who did what

| | IBM Bob | Claude (Anthropic) |
|---|---|---|
| Runner, validator, scout (`runner/`) | all | after two cold reviews: literal mutant replacement, a parse check, per-subject commit, scout `--out`, a stricter baseline gate (log entries 10 and 11) |
| Added tests (`tests-added/`) | all | 0 |
| Planted bugs and pattern catalog | all | 0 |
| Custom modes and skill (`.bob/`) | all | 2 folder names added to a Saboteur write rule |
| Design brief, verification log, review of every task, independent re-runs | | all |
| Demo page (`site/`), this README, the demo script in `docs/examples/` | | all |

Recompute the Bob side: `wc -l runner/*.js runner/*.json tests-added/*/*.js`, `ls mutants*/*.json mutants-dot-prop/r2/*.json | wc -l`, and `git log --stat` for each commit; every Bob commit message names its task.

## We checked Bob, and ourselves

[`docs/VERIFICATION-LOG.md`](docs/VERIFICATION-LOG.md) lists 11 times a result looked done and was not, each with the commit that fixed it. Some examples: 7 of 20 bug files were invalid JSON behind a clean summary; our own runner reported false catches caused by a test that fails under CPU load with no bug planted; a Bob test could never fail because `size()` caps its answer; twice, the human was the one who was wrong; and a cold review by a second AI (Codex) found that our runner had scored a bug that broke the file's syntax as "caught" (entry 10), and a second one that the baseline gate could pass a library that was not green (entry 11).

## Reproduce

Requires Node 24. From the repo root:

```bash
npm install
node runner/run.js --subject quick-lru --set mutants --tests original --out .work/before.json
node runner/run.js --subject quick-lru --set mutants-heldout --tests original+added --out .work/heldout-r3.json
node runner/run.js --subject dot-prop --set mutants-dot-prop/r2 --tests original --out .work/dot-prop-r2.json
node runner/run.js --subject dot-prop --set mutants-dot-prop --tests original --out .work/dot-prop-before.json
node runner/run.js --subject dot-prop --set mutants-dot-prop/r2 --tests original+added --out .work/dot-prop-r2-after.json
node runner/run.js --subject quick-lru --set mutants-round3 --tests original+added --out .work/round3.json
node runner/scout.js --subject dot-prop --out .work/dot-prop-scout.json
node docs/examples/dp-r2-3-collision.mjs
```

Each run first validates every bug file, then runs the unmodified library three times to detect flaky tests (a test that fails every time on the unmodified library stops the run), then runs one isolated copy per bug. It aborts if the library's source checksum changes. Compare the statuses with the matching file in `results/` (the second command uses all of Bob's current tests, so it matches `results/heldout-r3.json`). The other files in `results/` (`after.json`, `heldout*.json` except `heldout-r3.json`) were run with the tests that existed at the commit that added them; check out that commit to reproduce them.

To view the demo page locally: `python -m http.server 8765 --bind 127.0.0.1`, then open `http://127.0.0.1:8765/site/`.

## Limits

- Three baseline runs lower the chance of a false catch from a flaky test. They do not remove it.
- 12 of the 32 runnable bugs are classic operator flips, labelled `classic-operator`; the other 20 are labelled `semantic`. The failure modes are common ones, not taken from cited incidents.
- quick-lru's first round caught more than we expected. Its suite is good. That is also the point: even a good suite has blind spots.
- The `'1abc'` collision in dot-prop is shown by a demo script. Bob's test covers the oversized-index case of the same bug; the `'1abc'` case is not covered yet. It will be added to the upstream branch after judging, when this repository is no longer frozen as submitted.
- The loop is fully closed on quick-lru only. dot-prop had no held-out round: its fix is shown to catch the bug it was written for, not yet bugs it was never shown.
- The scout counts lines that mention a function name. It is a cheap heuristic, not coverage measurement.

## Repository layout

```
subject/            unmodified copies of the two libraries (see subject/README.md)
patterns/           failure-pattern catalog
mutants*/           planted bugs, one JSON file each
tests-added/        tests written by Bob, per library
runner/             run.js, validate.js, scout.js, subjects.json
results/            every run's output
site/               demo page, reads results/ at load time
docs/               brief, plan, verification log, usage statement, upstream drafts
bob_sessions/       IBM Bob task summary screenshots
```

## Data and license

MIT, see [LICENSE](LICENSE). The two libraries are MIT-licensed and copied unmodified; see [DATA_SOURCES.md](DATA_SOURCES.md). No client data, personal information or social media data is used.

This repository was created from the IBM hackathon template. Its `.gitignore`, `.bobignore` and [SECURITY.MD](SECURITY.MD) credential safeguards are kept.
